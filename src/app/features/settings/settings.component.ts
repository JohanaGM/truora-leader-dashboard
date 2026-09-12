import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AuthService, MFAStatus, TOTPEnrollment } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  displayName = signal('');
  telegramAlerts = signal(true);
  telegramWeeklySummary = signal(false);
  theme = signal<'light' | 'dark'>(
    (localStorage.getItem('app_theme') as 'light' | 'dark') ?? 'light'
  );
  saveSuccess = signal(false);

  // 2FA / MFA state
  mfaStatus = signal<MFAStatus | null>(null);
  isLoadingMFA = signal(false);
  showEnrollModal = signal(false);
  enrollmentData = signal<TOTPEnrollment | null>(null);
  qrCodeUrl = signal<SafeUrl | null>(null);
  verificationCode = signal('');
  isVerifyingMFA = signal(false);
  mfaError = signal<string | null>(null);
  mfaSuccess = signal<string | null>(null);
  copiedSecret = signal(false);

  constructor() {
    this.authService.currentLeader$.subscribe(leader => {
      if (leader) this.displayName.set(leader.full_name);
    });
    this.applyTheme(this.theme());
  }

  async ngOnInit(): Promise<void> {
    await this.loadMFAStatus();
  }

  async loadMFAStatus(): Promise<void> {
    this.isLoadingMFA.set(true);
    const status = await this.authService.checkMFAStatus();
    this.mfaStatus.set(status);
    this.isLoadingMFA.set(false);
  }

  applyTheme(t: 'light' | 'dark') {
    document.body.classList.toggle('dark-theme', t === 'dark');
    localStorage.setItem('app_theme', t);
    this.theme.set(t);
  }

  saveProfile() {
    localStorage.setItem('leader_display_name', this.displayName());
    this.saveSuccess.set(true);
    setTimeout(() => this.saveSuccess.set(false), 3000);
  }

  // --- 2FA Enrollment methods ---

  async startEnrollment(): Promise<void> {
    this.mfaError.set(null);
    this.mfaSuccess.set(null);
    this.verificationCode.set('');
    this.isLoadingMFA.set(true);

    const result = await this.authService.enrollTOTP();
    this.isLoadingMFA.set(false);

    if (result.success && result.data) {
      this.enrollmentData.set(result.data);
      if (result.data.qrCode) {
        this.qrCodeUrl.set(this.sanitizer.bypassSecurityTrustUrl(result.data.qrCode));
      }
      this.showEnrollModal.set(true);
    } else {
      this.mfaError.set(result.error || 'No se pudo iniciar el proceso de activación de 2FA.');
    }
  }

  async confirmEnrollment(): Promise<void> {
    const code = this.verificationCode().trim();
    if (!/^\d{6}$/.test(code)) {
      this.mfaError.set('Ingresa un código numérico de 6 dígitos.');
      return;
    }

    const factor = this.enrollmentData();
    if (!factor) return;

    this.isVerifyingMFA.set(true);
    this.mfaError.set(null);

    const result = await this.authService.verifyEnrolledFactor(factor.factorId, code);
    this.isVerifyingMFA.set(false);

    if (result.success) {
      this.mfaSuccess.set('¡Autenticación en dos pasos activada exitosamente!');
      this.showEnrollModal.set(false);
      this.enrollmentData.set(null);
      this.verificationCode.set('');
      await this.loadMFAStatus();
      setTimeout(() => this.mfaSuccess.set(null), 4000);
    } else {
      this.mfaError.set(result.error || 'Código inválido o expirado. Intenta nuevamente.');
    }
  }

  async disable2FA(): Promise<void> {
    const factor = this.mfaStatus()?.verifiedFactor;
    if (!factor) return;

    if (!confirm('¿Estás seguro de que deseas desactivar la autenticación de dos pasos? Tu cuenta será menos segura.')) {
      return;
    }

    this.isLoadingMFA.set(true);
    this.mfaError.set(null);

    const result = await this.authService.unenrollTOTP(factor.id);
    this.isLoadingMFA.set(false);

    if (result.success) {
      this.mfaSuccess.set('Autenticación en dos pasos desactivada.');
      await this.loadMFAStatus();
      setTimeout(() => this.mfaSuccess.set(null), 4000);
    } else {
      this.mfaError.set(result.error || 'No se pudo desactivar el 2FA.');
    }
  }

  cancelEnrollment(): Promise<void> | void {
    const factor = this.enrollmentData();
    if (factor) {
      // Clean up unverified factor
      this.authService.unenrollTOTP(factor.factorId);
    }
    this.showEnrollModal.set(false);
    this.enrollmentData.set(null);
    this.verificationCode.set('');
    this.mfaError.set(null);
  }

  copySecret(): void {
    const secret = this.enrollmentData()?.secret;
    if (secret) {
      navigator.clipboard.writeText(secret);
      this.copiedSecret.set(true);
      setTimeout(() => this.copiedSecret.set(false), 2000);
    }
  }
}
