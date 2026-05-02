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
   * All events with status 'pending' from the past 14 days up to today.
   * Deduped by event id.
   */
  pendingTasks = computed((): VirtualEvent[] => {
    this.eventService.events(); // track signal for reactivity
    const todayStr = this.eventService.toDateStr(new Date());
    const seen = new Set<string>();
    const result: VirtualEvent[] = [];

    for (let i = -14; i <= 0; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      for (const ev of this.eventService.getAllForDate(d)) {
        if (!seen.has(ev.id) && ev.status === 'pending' && ev.date <= todayStr) {
          seen.add(ev.id);
          result.push(ev);
        }
      }
    }
    return result.sort((a, b) => a.date.localeCompare(b.date));
  });

  pendingCount = computed(() => this.pendingTasks().length);
  topThree     = computed(() => this.pendingTasks().slice(0, 3));
  hasUrgent    = computed(() =>
    this.pendingTasks().some(e => e.date < this.eventService.toDateStr(new Date()))
  );

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
