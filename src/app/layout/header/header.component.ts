import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services';
import { EventService, VirtualEvent } from '../../core/services/event.service';
import { LeaderScheduleService } from '../../core/services/leader-schedule.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  authService     = inject(AuthService);
  eventService    = inject(EventService);
  scheduleService = inject(LeaderScheduleService);
  private router  = inject(Router);

  currentLeader$ = this.authService.currentLeader$;
  currentDate    = new Date();

  // ── Notification popover ────────────────────────────────────────────────
  notifOpen = signal(false);

  /**
   * Pending tasks for the current week (Mon–Sun), sorted oldest → newest.
   * Truface/Tips recurring events are hidden when the current user is NOT
   * the assigned leader for this week (they appear via scheduledTasks instead).
   */
  pendingTasks = computed((): VirtualEvent[] => {
    this.eventService.events(); // track signal for reactivity
    const isAssignedLeader = this.scheduledTasks().length > 0;
    return this.eventService
      .getEventsForWeek()
      .filter(ev => {
        if (ev.status !== 'pending') return false;
        // Ocultar Truface/Tips del EventService si el líder no está asignado esta semana
        if (!isAssignedLeader && (ev.type === 'truface' || ev.type === 'tips')) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  });

  /** Tareas del cronograma de la semana actual del líder logueado */
  scheduledTasks = computed(() => this.scheduleService.weekTasks());

  /** Total badge: tareas de eventos pendientes + tareas de cronograma */
  pendingCount = computed(() =>
    this.pendingTasks().length + this.scheduledTasks().length
  );

  /** True cuando hay tareas urgentes de eventos O hay tareas de cronograma hoy */
  hasUrgent = computed(() => {
    const todayStr = this.eventService.toDateStr(new Date());
    const urgentEvent = this.pendingTasks().some(e => e.date <= todayStr);
    const urgentSchedule = this.scheduledTasks().some(t => t.fecha === todayStr);
    return urgentEvent || urgentSchedule;
  });

  ngOnInit(): void {
    this.scheduleService.loadWeekTasks();
  }

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
