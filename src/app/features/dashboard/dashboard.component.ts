import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { TipsCounterService } from '../../core/services/tips-counter.service';
import { LeaderScheduleService } from '../../core/services/leader-schedule.service';
import { TipService } from '../../core/services/tip.service';
import { Tip } from '../../core/models';

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
  private tipService = inject(TipService);
  scheduleService = inject(LeaderScheduleService);
  tipsDialogOpen = signal(false);
  tipsSearch = signal('');
  selectedTip = signal<Tip | null>(null);

  tips = signal<Tip[]>([]);
  filteredTips = computed(() => {
    const query = this.tipsSearch().trim().toLowerCase();
    const tips = this.tips();
    if (!query) return tips;
    return tips.filter(tip => [tip.title, tip.topic, tip.description, tip.category]
      .filter(Boolean)
      .some(value => value!.toLowerCase().includes(query)));
  });

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
    { key: 'activities', icon: '📅', label: 'Actividades Hoy',    value: this.statsActivitiesToday(),      color: '#9BD2F3' },
    { key: 'completed',  icon: '✅', label: 'Tareas Completadas', value: this.statsTasksCompleted(),       color: '#9BD2F3' },
    { key: 'pending',    icon: '⏰', label: 'Tareas Pendientes',  value: this.statsTasksPending(),         color: '#9BD2F3' },
    { key: 'tips',       icon: '💡', label: 'Tips Generados',     value: this.tipsCounter.tipsCount(),    color: '#9BD2F3' },
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
    { icon: '📅', label: 'Cronograma',      route: '/schedule',     url: null },
    { icon: '📈', label: 'Métricas',          route: '/metricas',     url: null },
    { icon: '💡', label: 'Generar Tip',     route: '/tip-generator', url: null },
    { icon: '⚙️', label: 'Automatizaciones', route: '/automations',  url: null },
    { icon: '📢', label: 'Crear Aviso',     route: '/avisos',       url: null }
  ];

  ngOnInit(): void {
    this.tipsCounter.fetchCount().subscribe();
    this.scheduleService.loadWeekTasks();
    this.tips.set(this.tipService.getTips());
  }

  openTipsSearch(): void {
    this.tips.set(this.tipService.getTips());
    this.tipsSearch.set('');
    this.selectedTip.set(null);
    this.tipsDialogOpen.set(true);
  }

  closeTipsSearch(): void {
    this.tipsDialogOpen.set(false);
    this.selectedTip.set(null);
  }

  showTip(tip: Tip): void {
    this.selectedTip.set(tip);
  }

  downloadTip(tip: Tip): void {
    const link = document.createElement('a');
    link.href = tip.imageData;
    link.download = `${tip.title.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'tip'}.png`;
    link.click();
  }

  openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
