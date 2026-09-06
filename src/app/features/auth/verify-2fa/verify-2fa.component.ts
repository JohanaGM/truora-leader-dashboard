import { Component, ElementRef, OnDestroy, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-2fa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-2fa.component.html',
  styleUrl: './verify-2fa.component.scss'
})
export class Verify2faComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChildren('codeInput') codeInputs!: QueryList<ElementRef<HTMLInputElement>>;

  digits = signal<string[]>(['', '', '', '', '', '']);
  isLoading = signal(false);
  isResending = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  resendCountdown = signal(60);
  private countdownTimer?: ReturnType<typeof setInterval>;

  get code(): string {
    return this.digits().join('');
  }

  get canVerify(): boolean {
    return /^\d{6}$/.test(this.code) && !this.isLoading();
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(-1);
    const next = [...this.digits()];
    next[index] = value;
    this.digits.set(next);
    input.value = value;
    this.errorMessage.set(null);

    if (value && index < 5) this.focusInput(index + 1);
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.focusInput(index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) this.focusInput(index - 1);
    if (event.key === 'ArrowRight' && index < 5) this.focusInput(index + 1);
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
    if (!pasted) return;
    this.digits.set(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ''));
    this.focusInput(Math.min(pasted.length, 5));
  }

  async verifyCode(): Promise<void> {
    if (!this.canVerify) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const result = await this.authService.verifyTwoFactorCode(this.code);
    this.isLoading.set(false);

    if (result.success) {
      this.successMessage.set('Código verificado. Redirigiendo...');
      setTimeout(() => this.router.navigate(['/dashboard']), 350);
    } else {
      this.errorMessage.set(result.error ?? 'Código inválido o expirado.');
      this.digits.set(['', '', '', '', '', '']);
      this.focusInput(0);
    }
  }

  async resendCode(): Promise<void> {
    if (this.resendCountdown() > 0 || this.isResending()) return;
    this.isResending.set(true);
    this.errorMessage.set(null);
    const result = await this.authService.resendTwoFactorCode();
    this.isResending.set(false);
    if (!result.success) {
      this.errorMessage.set(result.error ?? 'No fue posible reenviar el código.');
      return;
    }
    this.successMessage.set('Código reenviado. Revisa tu aplicación autenticadora.');
    this.startCountdown();
  }

  private startCountdown(): void {
    this.resendCountdown.set(60);
    clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      const next = this.resendCountdown() - 1;
      this.resendCountdown.set(next);
      if (next <= 0) clearInterval(this.countdownTimer);
    }, 1000);
  }

  private focusInput(index: number): void {
    setTimeout(() => this.codeInputs?.get(index)?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    clearInterval(this.countdownTimer);
  }
}
