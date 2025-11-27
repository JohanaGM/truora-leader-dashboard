import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  // Form fields
  email = '';
  password = '';
  rememberMe = false;

  // UI states (usando signals como en tu proyecto)
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private router: Router) {}

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    // Reset error message
    this.errorMessage.set(null);

    // Validate form
    if (!this.email || !this.password) {
      this.errorMessage.set('Por favor completa todos los campos');
      return;
    }

    // Set loading state
    this.isLoading.set(true);

    // TODO: Implementar lógica de autenticación con Supabase
    // Por ahora, simulamos un login exitoso después de 1.5 segundos
    setTimeout(() => {
      // Simular autenticación exitosa
      console.log('Login attempt:', {
        email: this.email,
        rememberMe: this.rememberMe
      });

      this.isLoading.set(false);
      
      // TODO: Aquí irá la lógica real con AuthService
      // this.authService.login(this.email, this.password)
      
      // Redirigir al dashboard (temporalmente)
      this.router.navigate(['/dashboard']);
    }, 1500);
  }

  /**
   * Handle forgot password click
   */
  onForgotPassword(event: Event): void {
    event.preventDefault();
    
    // TODO: Implementar lógica de recuperación de contraseña
    console.log('Forgot password clicked');
    
    // Mostrar mensaje temporal
    this.errorMessage.set('Funcionalidad de recuperación en desarrollo');
    
    setTimeout(() => {
      this.errorMessage.set(null);
    }, 3000);
  }
}
