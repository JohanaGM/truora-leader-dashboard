import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Form fields
  email = '';
  password = '';
  rememberMe = false;

  // UI states
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  /**
   * Handle form submission
   */
  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);

    if (!this.email || !this.password) {
      this.errorMessage.set('Por favor completa todos los campos');
      return;
    }

    this.isLoading.set(true);

    const result = await this.authService.login(this.email, this.password);

    this.isLoading.set(false);

    if (result.success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.errorMessage.set(result.error || 'Error al iniciar sesión');
    }
  }

  /**
   * Handle forgot password click
   */
  onForgotPassword(event: Event): void {
    event.preventDefault();
    this.errorMessage.set('Contacta al administrador para recuperar tu contraseña');
    setTimeout(() => this.errorMessage.set(null), 3000);
  }
}
