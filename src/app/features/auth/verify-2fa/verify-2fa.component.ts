import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AuthService, TOTPEnrollment } from '../../../core/services/auth.service';

type Verify2faMode = 'loading' | 'enroll' | 'challenge';

@Component({
  selector: 'app-verify-2fa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-2fa.component.html',
  styleUrl: './verify-2fa.component.scss'
})
export class Verify2faComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChildren('codeInput') codeInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // 'enroll' = el usuario no tiene 2FA configurado y debe activarlo obligatoriamente.
  // 'challenge' = el usuario ya tiene un factor verificado y solo debe ingresar el código.
  mode = signal<Verify2faMode>('loading');

  digits = signal<string[]>(['', '', '', '', '', '']);
  isLoading = signal(false);
  isResending = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  resendCountdown = signal(60);
  private countdownTimer?: ReturnType<typeof setInterval>;

  // Estado de enrolamiento (cuando mode === 'enroll')
  enrollmentData = signal<TOTPEnrollment | null>(null);
  qrCodeUrl = signal<SafeUrl | null>(null);
  copiedSecret = signal(false);

  get code(): string {
    return this.digits().join('');
  }

  get canVerify(): boolean {
    return /^\d{6}$/.test(this.code) && !this.isLoading();
  }

  async ngOnInit(): Promise<void> {
    const status = await this.authService.checkMFAStatus();

    if (status.hasMFA && status.verifiedFactor) {
      this.mode.set('challenge');
      this.startCountdown();
    } else {
      await this.startEnrollment();
    }
  }

  private async startEnrollment(): Promise<void> {
    this.mode.set('enroll');
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const result = await this.authService.enrollTOTP();
    this.isLoading.set(false);

    if (result.success && result.data) {
      this.enrollmentData.set(result.data);
      if (result.data.qrCode) {
        this.qrCodeUrl.set(this.sanitizer.bypassSecurityTrustUrl(result.data.qrCode));
      }
    } else {
      this.errorMessage.set(result.error ?? 'No se pudo generar el código QR. Intenta de nuevo.');
    }
  }

  copySecret(): void {
    const secret = this.enrollmentData()?.secret;
    if (secret) {
      navigator.clipboard.writeText(secret);
      this.copiedSecret.set(true);
      setTimeout(() => this.copiedSecret.set(false), 2000);
    }
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

    if (this.mode() === 'enroll') {
      await this.confirmEnrollment();
      return;
    }

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

  private async confirmEnrollment(): Promise<void> {
    const factor = this.enrollmentData();
    if (!factor) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    const result = await this.authService.verifyEnrolledFactor(factor.factorId, this.code);
    this.isLoading.set(false);

    if (result.success) {
      this.successMessage.set('¡2FA activado! Redirigiendo...');
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
