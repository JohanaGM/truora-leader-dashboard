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
        this.loadLeaderData(session.user.id);
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
      await this.loadLeaderData(session.user.id);
    }
  }

  // Cargar datos del líder desde la tabla leaders
  private async loadLeaderData(userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('leaders')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      this.currentLeaderSubject.next(data);
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
        const leader = await this.getLeaderById(data.user.id);
        
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
          .eq('id', data.user.id);

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
  private async getLeaderById(userId: string): Promise<Leader | null> {
    const { data, error } = await this.supabase
      .from('leaders')
      .select('*')
      .eq('id', userId)
      .single();
    
    return data || null;
  }

  // Logout
  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.router.navigate(['/login']);
  }

  // Verificar si el usuario está autenticado
  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return !!session;
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
