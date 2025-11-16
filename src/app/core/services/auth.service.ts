import { Injectable, signal } from '@angular/core';
import { User } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSignal = signal<User | null>(this.loadUser());

  readonly currentUser = this.currentUserSignal.asReadonly();

  private loadUser(): User | null {
    const stored = localStorage.getItem('truora_user');
    return stored ? JSON.parse(stored) : this.getMockUser();
  }

  private saveUser(user: User): void {
    localStorage.setItem('truora_user', JSON.stringify(user));
  }

  login(email: string, password: string): User | null {
    // Mock login - en producción conectar con API real
    const mockUser: User = {
      id: '1',
      name: 'Líder de Identidad',
      email: email,
      role: 'leader',
      avatar: 'assets/images/avatar-placeholder.png'
    };
    
    this.currentUserSignal.set(mockUser);
    this.saveUser(mockUser);
    return mockUser;
  }

  logout(): void {
    this.currentUserSignal.set(null);
    localStorage.removeItem('truora_user');
  }

  isAuthenticated(): boolean {
    return this.currentUserSignal() !== null;
  }

  private getMockUser(): User {
    return {
      id: '1',
      name: 'Líder de Identidad',
      email: 'lider@truora.com',
      role: 'leader',
      avatar: 'assets/images/avatar-placeholder.png'
    };
  }
}
