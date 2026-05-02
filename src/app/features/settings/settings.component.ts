import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  authService = inject(AuthService);

  displayName = signal('');
  telegramAlerts = signal(true);
  telegramWeeklySummary = signal(false);
  theme = signal<'light' | 'dark'>(
    (localStorage.getItem('app_theme') as 'light' | 'dark') ?? 'light'
  );
  saveSuccess = signal(false);

  constructor() {
    this.authService.currentLeader$.subscribe(leader => {
      if (leader) this.displayName.set(leader.full_name);
    });
    this.applyTheme(this.theme());
  }

  applyTheme(t: 'light' | 'dark') {
    document.body.classList.toggle('dark-theme', t === 'dark');
    localStorage.setItem('app_theme', t);
    this.theme.set(t);
  }

  saveProfile() {
    // Persist display name to localStorage as a lightweight override
    localStorage.setItem('leader_display_name', this.displayName());
    this.saveSuccess.set(true);
    setTimeout(() => this.saveSuccess.set(false), 3000);
  }
}
