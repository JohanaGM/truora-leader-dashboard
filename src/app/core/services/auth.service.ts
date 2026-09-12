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

export interface TOTPEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri?: string;
}

export interface MFAStatus {
  hasMFA: boolean;
  verifiedFactor: any | null;
  factors: any[];
  currentLevel?: string;
  nextLevel?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly twoFactorPendingKey = 'truora_2fa_pending';
  private readonly twoFactorVerifiedKey = 'truora_2fa_verified';
  private readonly twoFactorUserKey = 'truora_2fa_user';
  private readonly twoFactorChallengeKey = 'truora_2fa_challenge';
  private readonly twoFactorFactorIdKey = 'truora_2fa_factor_id';
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
  async login(email: string, password: string): Promise<{
    success: boolean;
    requiresMFA?: boolean;
    factorId?: string;
    error?: string;
  }> {
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

        // Verificar si el usuario tiene un factor TOTP activo (AAL2)
        const mfaStatus = await this.checkMFAStatus();

        // El 2FA es obligatorio: siempre queda "pendiente" hasta completar el
        // reto (si ya tiene factor verificado) o el enrolamiento (si no tiene).
        sessionStorage.setItem(this.twoFactorPendingKey, 'true');
        sessionStorage.setItem(this.twoFactorUserKey, data.user.id);
        sessionStorage.removeItem(this.twoFactorVerifiedKey);
        sessionStorage.removeItem(this.twoFactorChallengeKey);

        if (mfaStatus.hasMFA && mfaStatus.verifiedFactor) {
          sessionStorage.setItem(this.twoFactorFactorIdKey, mfaStatus.verifiedFactor.id);
        } else {
          sessionStorage.removeItem(this.twoFactorFactorIdKey);
        }

        return {
          success: true,
          requiresMFA: true,
          factorId: mfaStatus.verifiedFactor?.id
        };
      }

      return { success: false, error: 'No se pudo iniciar sesión' };
    } catch (error: any) {
      return { 
        success: false, 
        error: this.getErrorMessage(error.message) 
      };
    }
  }

  // ==========================================
  // MFA / 2FA TOTP Methods (Supabase Auth)
  // ==========================================

  /**
   * 1. Inicia el enrolamiento de un factor TOTP
   * Retorna el factorId, código QR (SVG/URI) y clave secreta
   */
  async enrollTOTP(): Promise<{
    success: boolean;
    data?: TOTPEnrollment;
    error?: string;
  }> {
    try {
      const user = this.getCurrentUser();
      const email = user?.email || 'usuario@truora.com';

      const { data, error } = await this.supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Truora Leader Dashboard',
        friendlyName: email
      });

      if (error) throw error;

      return {
        success: true,
        data: {
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'No fue posible iniciar el registro de 2FA.'
      };
    }
  }

  /**
   * 2. Verifica el factor recién enrolado para activarlo definitivamente
   */
  async verifyEnrolledFactor(factorId: string, code: string): Promise<{ success: boolean; error?: string }> {
    if (!/^\d{6}$/.test(code)) {
      return { success: false, error: 'Ingresa un código de 6 dígitos numéricos.' };
    }

    try {
      const { data: challengeData, error: challengeError } = await this.supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) throw challengeError;

      const { data: verifyData, error: verifyError } = await this.supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code
      });

      if (verifyError) throw verifyError;

      sessionStorage.setItem(this.twoFactorVerifiedKey, 'true');
      sessionStorage.setItem(this.twoFactorUserKey, this.getCurrentUser()?.id ?? '');
      sessionStorage.removeItem(this.twoFactorPendingKey);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Código inválido o expirado. Intenta de nuevo.'
      };
    }
  }

  /**
   * 3. Consulta el estado y factores MFA activos del usuario
   */
  async checkMFAStatus(): Promise<MFAStatus> {
    try {
      const { data: factors, error } = await this.supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactors = factors.totp || [];
      const verifiedFactor = totpFactors.find((f: any) => f.status === 'verified') || null;

      let currentLevel: string | undefined;
      let nextLevel: string | undefined;

      try {
        const { data: aalData } = await this.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData) {
          currentLevel = aalData.currentLevel ?? undefined;
          nextLevel = aalData.nextLevel ?? undefined;
        }
      } catch {
        // Ignorable si no está soportado en la sesión actual
      }

      return {
        hasMFA: !!verifiedFactor,
        verifiedFactor,
        factors: factors.all || totpFactors,
        currentLevel,
        nextLevel
      };
    } catch (error: any) {
      return {
        hasMFA: false,
        verifiedFactor: null,
        factors: [],
        error: error.message
      };
    }
  }

  /**
   * 4. Realiza el challenge y verificación durante el login para elevar la sesión a aal2
   */
  async challengeAndVerify(factorId?: string, code?: string): Promise<{ success: boolean; error?: string }> {
    const verificationCode = (code ?? '').trim();
    if (!/^\d{6}$/.test(verificationCode)) {
      return { success: false, error: 'Ingresa un código de 6 dígitos numéricos.' };
    }

    try {
      let targetFactorId = factorId || sessionStorage.getItem(this.twoFactorFactorIdKey);

      if (!targetFactorId) {
        const mfaStatus = await this.checkMFAStatus();
        if (mfaStatus.verifiedFactor) {
          targetFactorId = mfaStatus.verifiedFactor.id;
        }
      }

      if (!targetFactorId) {
        // Modo fallback para desarrollo si no hay factor activo
        if (!environment.production && verificationCode === '123456') {
          sessionStorage.setItem(this.twoFactorVerifiedKey, 'true');
          sessionStorage.setItem(this.twoFactorUserKey, this.getCurrentUser()?.id ?? '');
          sessionStorage.removeItem(this.twoFactorPendingKey);
          return { success: true };
        }
        return { success: false, error: 'No se encontró un factor 2FA configurado para este usuario.' };
      }

      const { data: challengeData, error: challengeError } = await this.supabase.auth.mfa.challenge({
        factorId: targetFactorId
      });

      if (challengeError) throw challengeError;

      const { data: verifyData, error: verifyError } = await this.supabase.auth.mfa.verify({
        factorId: targetFactorId,
        challengeId: challengeData.id,
        code: verificationCode
      });

      if (verifyError) {
        // Modo fallback para testing si código de prueba
        if (!environment.production && verificationCode === '123456') {
          sessionStorage.setItem(this.twoFactorVerifiedKey, 'true');
          sessionStorage.setItem(this.twoFactorUserKey, this.getCurrentUser()?.id ?? '');
          sessionStorage.removeItem(this.twoFactorPendingKey);
          return { success: true };
        }
        return { success: false, error: 'Código de autenticación inválido o expirado.' };
      }

      sessionStorage.setItem(this.twoFactorVerifiedKey, 'true');
      sessionStorage.setItem(this.twoFactorUserKey, this.getCurrentUser()?.id ?? '');
      sessionStorage.removeItem(this.twoFactorPendingKey);
      sessionStorage.removeItem(this.twoFactorChallengeKey);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error al verificar el código 2FA. Intenta nuevamente.'
      };
    }
  }

  /**
   * 5. Desactiva / elimina un factor TOTP (Unenroll)
   */
  async unenrollTOTP(factorId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.auth.mfa.unenroll({
        factorId
      });

      if (error) throw error;

      sessionStorage.removeItem(this.twoFactorPendingKey);
      sessionStorage.removeItem(this.twoFactorFactorIdKey);
      sessionStorage.setItem(this.twoFactorVerifiedKey, 'true');

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'No fue posible desactivar 2FA.'
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
    return this.challengeAndVerify(undefined, code);
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
