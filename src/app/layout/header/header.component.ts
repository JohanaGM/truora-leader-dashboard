import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services';
import { EventService, VirtualEvent } from '../../core/services/event.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  authService   = inject(AuthService);
  eventService  = inject(EventService);
  private router = inject(Router);

  currentLeader$ = this.authService.currentLeader$;
  currentDate    = new Date();

  // ── Notification popover ────────────────────────────────────────────────
  notifOpen = signal(false);

  /**
   * Pending tasks for the current week (Mon–Sun), sorted oldest → newest.
   * Reacts in real time when any event's status changes.
   */
  pendingTasks = computed((): VirtualEvent[] => {
    this.eventService.events(); // track signal for reactivity
    const todayStr = this.eventService.toDateStr(new Date());
    return this.eventService
      .getEventsForWeek()
      .filter(ev => ev.status === 'pending')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  });

  pendingCount = computed(() => this.pendingTasks().length);

  /** True when at least one pending task is on or before today (overdue within the week). */
  hasUrgent = computed(() => {
    const todayStr = this.eventService.toDateStr(new Date());
    return this.pendingTasks().some(e => e.date <= todayStr);
  });

  toggleNotif() { this.notifOpen.update(v => !v); }
  closeNotif()  { this.notifOpen.set(false); }

  goToTasks() {
    this.notifOpen.set(false);
    this.router.navigate(['/tasks']);
  }

  goToSettings() { this.router.navigate(['/configuracion']); }

  // ── Greeting & misc ─────────────────────────────────────────────────────
  get greeting(): string {
    const hour = this.currentDate.getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  async onLogout(): Promise<void> {
    await this.authService.logout();
  }
}
