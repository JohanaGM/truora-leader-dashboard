import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models';

export interface Leader {
  id: string;
  email: string;
  full_name: string;
  team_name: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly twoFactorPendingKey = 'truora_2fa_pending';
  private readonly twoFactorVerifiedKey = 'truora_2fa_verified';
  private readonly twoFactorUserKey = 'truora_2fa_user';
  private readonly twoFactorChallengeKey = 'truora_2fa_challenge';
  private supabase: SupabaseClient;
  private router = inject(Router);
  
  // Observables para el estado de autenticación
  private currentUserSubject = new BehaviorSubject<SupabaseUser | null>(null);
  private currentLeaderSubject = new BehaviorSubject<Leader | null>(null);
  
  currentUser$ = this.currentUserSubject.asObservable();
  currentLeader$ = this.currentLeaderSubject.asObservable();

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.key
    );
    
    // Escuchar cambios de autenticación
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this.currentUserSubject.next(session.user);
        this.loadLeaderData(session.user.id, session.user.email ?? undefined);
      } else {
        this.currentUserSubject.next(null);
        this.currentLeaderSubject.next(null);
      }
    });
    
    // Verificar sesión existente al iniciar
    this.checkSession();
  }

  // Verificar si hay sesión activa
  private async checkSession(): Promise<void> {
    const { data: { session } } = await this.supabase.auth.getSession();
    if (session?.user) {
      this.currentUserSubject.next(session.user);
      await this.loadLeaderData(session.user.id, session.user.email ?? undefined);
    }
  }

  // Cargar datos del líder desde la tabla leaders
  private async loadLeaderData(userId: string, email?: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('leaders')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      this.currentLeaderSubject.next(data);
      return;
    }

    if (email) {
      const { data: leaderByEmail } = await this.supabase
        .from('leaders')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (leaderByEmail) this.currentLeaderSubject.next(leaderByEmail);
    }
  }

  // Login con email y password
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // Verificar si el líder está activo
        const leader = await this.getLeaderById(data.user.id, data.user.email ?? email);
        
        if (!leader) {
          await this.supabase.auth.signOut();
          return { 
            success: false, 
            error: 'Usuario no registrado como líder' 
          };
        }

        if (!leader.is_active) {
          await this.supabase.auth.signOut();
          return { 
            success: false, 
            error: 'Tu cuenta está desactivada. Contacta al administrador.' 
          };
        }

        // Actualizar last_login
        await this.supabase
          .from('leaders')
          .update({ last_login: new Date().toISOString() })
          .eq('id', leader.id);

        sessionStorage.setItem(this.twoFactorPendingKey, 'true');
        sessionStorage.setItem(this.twoFactorUserKey, data.user.id);
        sessionStorage.removeItem(this.twoFactorVerifiedKey);
        sessionStorage.removeItem(this.twoFactorChallengeKey);
        await this.resendTwoFactorCode();

        return { success: true };
      }

      return { success: false, error: 'No se pudo iniciar sesión' };
    } catch (error: any) {
      return { 
        success: false, 
        error: this.getErrorMessage(error.message) 
      };
    }
  }

  // Obtener líder por ID
  private async getLeaderById(userId: string, email?: string): Promise<Leader | null> {
    const { data } = await this.supabase
      .from('leaders')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) return data;
    if (!email) return null;

    const { data: leaderByEmail } = await this.supabase
      .from('leaders')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    return leaderByEmail || null;
  }

  // Logout
  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.clearTwoFactorState();
    this.router.navigate(['/login']);
  }

  // Verificar si el usuario está autenticado
  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return !!session;
  }

  isTwoFactorPending(): boolean {
    return sessionStorage.getItem(this.twoFactorPendingKey) === 'true'
      && sessionStorage.getItem(this.twoFactorUserKey) === this.getCurrentUser()?.id;
  }

  isTwoFactorVerified(): boolean {
    return sessionStorage.getItem(this.twoFactorVerifiedKey) === 'true'
      && sessionStorage.getItem(this.twoFactorUserKey) === this.getCurrentUser()?.id;
  }

  async verifyTwoFactorCode(code: string): Promise<{ success: boolean; error?: string }> {
    if (!/^\d{6}$/.test(code)) {
      return { success: false, error: 'Ingresa un código de 6 dígitos.' };
    }

    try {
      const { data: factors, error: factorsError } = await this.supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const factor = factors.totp.find(item => item.status === 'verified');
      const challengeId = sessionStorage.getItem(this.twoFactorChallengeKey);

      if (factor && challengeId) {
        const { error } = await this.supabase.auth.mfa.verify({
          factorId: factor.id,
          challengeId,
          code
        });
        if (error) return { success: false, error: 'El código es inválido o expiró.' };
      } else if (!environment.production && code !== '123456') {
        return { success: false, error: 'El código es inválido. Usa el código de prueba 123456.' };
      } else if (environment.production) {
        return { success: false, error: 'No hay un factor 2FA configurado para esta cuenta.' };
      }

      sessionStorage.setItem(this.twoFactorVerifiedKey, 'true');
      sessionStorage.setItem(this.twoFactorUserKey, this.getCurrentUser()?.id ?? '');
      sessionStorage.removeItem(this.twoFactorPendingKey);
      sessionStorage.removeItem(this.twoFactorChallengeKey);
      return { success: true };
    } catch {
      return { success: false, error: 'No fue posible verificar el código. Intenta nuevamente.' };
    }
  }

  async resendTwoFactorCode(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: factors, error: factorsError } = await this.supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = factors.totp.find(item => item.status === 'verified');

      if (factor) {
        const { data, error } = await this.supabase.auth.mfa.challenge({ factorId: factor.id });
        if (error) throw error;
        sessionStorage.setItem(this.twoFactorChallengeKey, data.id);
      }

      return { success: true };
    } catch {
      return { success: false, error: 'No fue posible reenviar el código.' };
    }
  }

  private clearTwoFactorState(): void {
    sessionStorage.removeItem(this.twoFactorPendingKey);
    sessionStorage.removeItem(this.twoFactorVerifiedKey);
    sessionStorage.removeItem(this.twoFactorUserKey);
    sessionStorage.removeItem(this.twoFactorChallengeKey);
  }

  // Obtener usuario actual (síncrono)
  getCurrentUser(): SupabaseUser | null {
    return this.currentUserSubject.value;
  }

  // Obtener líder actual (síncrono)
  getCurrentLeader(): Leader | null {
    return this.currentLeaderSubject.value;
  }

  // Mapear errores a español
  private getErrorMessage(error: string): string {
    const errorMap: { [key: string]: string } = {
      'Invalid login credentials': 'Credenciales inválidas',
      'Email not confirmed': 'Email no confirmado',
      'User not found': 'Usuario no encontrado',
      'Invalid email': 'Email inválido',
      'Password is too weak': 'La contraseña es muy débil'
    };
    return errorMap[error] || 'Error al iniciar sesión';
  }
}
