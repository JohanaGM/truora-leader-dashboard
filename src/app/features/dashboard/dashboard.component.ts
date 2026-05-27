import { Component, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { TipsCounterService } from '../../core/services/tips-counter.service';
import { LeaderScheduleService } from '../../core/services/leader-schedule.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private eventService = inject(EventService);
  private tipsCounter = inject(TipsCounterService);
  scheduleService = inject(LeaderScheduleService);

  // ---- Computed stats (datos reales) ----
  statsActivitiesToday = computed(() => {
    this.eventService.events();
    const isAssignedLeader = this.scheduleService.weekTasks().length > 0;
    return this.eventService.getAllForDate(new Date()).filter(e =>
      isAssignedLeader || (e.type !== 'truface' && e.type !== 'tips')
    ).length;
  });

  statsTasksCompleted = computed(() =>
    this.eventService.getEventsForWeek().filter(e =>
      e.status === 'completed' &&
      (this.scheduleService.weekTasks().length > 0 || (e.type !== 'truface' && e.type !== 'tips'))
    ).length
  );

  statsTasksPending = computed(() =>
    this.eventService.getEventsForWeek().filter(e =>
      e.status === 'pending' &&
      (this.scheduleService.weekTasks().length > 0 || (e.type !== 'truface' && e.type !== 'tips'))
    ).length
  );

  stats = computed(() => [
    { key: 'activities', icon: '📅', label: 'Actividades Hoy',    value: this.statsActivitiesToday(),      color: 'rgb(99 25 50)' },
    { key: 'completed',  icon: '✅', label: 'Tareas Completadas', value: this.statsTasksCompleted(),       color: 'rgb(7 56 65)' },
    { key: 'pending',    icon: '⏰', label: 'Tareas Pendientes',  value: this.statsTasksPending(),         color: 'rgb(131 110 27)' },
    { key: 'tips',       icon: '💡', label: 'Tips Generados',     value: this.tipsCounter.tipsCount(),    color: 'rgb(113 18 137)' },
  ]);

  todayActivities = computed(() => {
    this.eventService.events();
    const isAssignedLeader = this.scheduleService.weekTasks().length > 0;
    return this.eventService.getAllForDate(new Date())
      .filter(e => isAssignedLeader || (e.type !== 'truface' && e.type !== 'tips'))
      .map(e => ({ title: e.title, time: e.startTime, status: e.status, color: e.color }));
  });

  // ---- Rango semana actual (para el card de cronograma) ----
  get weekLabel(): string {
    const { start, end } = this.scheduleService.getWeekRange(new Date());
    const fmt = (s: string) => {
      const [y, m, d] = s.split('-');
      const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
    };
    return `${fmt(start)} – ${fmt(end)}`;
  }

  quickActions = [
    { icon: '📅', label: 'Cronograma',      route: '/schedule',     url: null,                              color: 'rgb(153 171 158)' },
    { icon: '✏️', label: 'Crear Tarea',      route: '/tasks',        url: null,                              color: 'rgb(159 143 143)' },
    { icon: '💡', label: 'Generar Tip',      route: '/tip-generator', url: null,                              color: 'rgb(26 54 73)' },
    { icon: '⚙️', label: 'Automatizaciones', route: '/automations',  url: null,                              color: 'rgb(101 118 175)' },
    { icon: '📢', label: 'Crear Aviso',      route: '/avisos',       url: null,                              color: 'rgb(14 80 110)' }
  ];

  ngOnInit(): void {
    this.tipsCounter.fetchCount().subscribe();
    this.scheduleService.loadWeekTasks();
  }

  openTipsFolder() {
    window.open(this.tipsCounter.TIPS_FOLDER_URL, '_blank', 'noopener,noreferrer');
  }

  openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
