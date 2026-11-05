import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EventService, VirtualEvent } from '../../core/services/event.service';
import { EventStatus } from '../../core/models/event.model';
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

  // ---- Búsqueda remota de "Tips generados" (POST a webhook n8n) ----
  isSearchingTips = signal(false);
  tipsSearchError = signal<string | null>(null);
  remoteTipsResults = signal<any[] | null>(null);
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;

  tips = signal<Tip[]>([]);
  /** Biblioteca completa traída de Drive (vía n8n); la búsqueda filtra en el cliente. */
  private allDriveTips = signal<Tip[] | null>(null);
  /** IDs de tips cuya imagen de Drive no pudo cargarse (archivo privado). */
  failedImages = signal<Set<string>>(new Set());
  onTipImageError(id: string): void { this.failedImages.update(s => new Set(s).add(id)); }
  filteredTips = computed(() => this.remoteTipsResults() ?? this.tips());

  private isAssignedLeader(): boolean {
    return this.scheduleService.weekTasks().length > 0;
  }

  private eventsForDate(date: Date): VirtualEvent[] {
    if (this.isAssignedLeader()) {
      return [
        ...this.eventService.getScheduledForDate(this.scheduleService.weekTasks(), date),
        ...this.eventService.getManualForDate(date),
      ];
    }
    return this.eventService.getAllForDate(date)
      .filter(event => event.type !== 'truface' && event.type !== 'tips');
  }

  eventsForWeek = computed((): VirtualEvent[] => {
    this.eventService.events();
    if (!this.isAssignedLeader()) {
      return this.eventService.getEventsForWeek()
        .filter(event => event.type !== 'truface' && event.type !== 'tips');
    }
    const { start, end } = this.eventService.getWeekBounds();
    const events: VirtualEvent[] = [];
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      events.push(...this.eventsForDate(new Date(date)));
    }
    return events;
  });

  // ---- Computed stats (datos reales) ----
  statsActivitiesToday = computed(() => {
    this.eventService.events();
    return this.eventsForDate(new Date()).length;
  });

  statsTasksCompleted = computed(() =>
    this.eventsForWeek().filter(e => e.status === 'completed').length
  );

  statsTasksPending = computed(() =>
    this.eventsForWeek().filter(e => e.status === 'pending').length
  );

  stats = computed(() => [
    { key: 'activities', icon: '📅', label: 'Actividades Hoy',    value: this.statsActivitiesToday(),      color: '#9BD2F3' },
    { key: 'completed',  icon: '✅', label: 'Tareas Completadas', value: this.statsTasksCompleted(),       color: '#9BD2F3' },
    { key: 'pending',    icon: '⏰', label: 'Tareas Pendientes',  value: this.statsTasksPending(),         color: '#9BD2F3' },
    { key: 'tips',       icon: '💡', label: 'Tips Generados',     value: this.tipsCounter.tipsCount(),    color: '#9BD2F3' },
  ]);

  todayEvents = computed(() => this.eventsForDate(new Date()));

  todayActivities = computed(() => {
    this.eventService.events();
    return this.todayEvents().map(e => ({ id: e.id, title: e.title, time: e.startTime, status: e.status, color: e.color }));
  });

  updateTodayStatus(eventId: string, status: EventStatus): void {
    const event = this.todayEvents().find(item => item.id === eventId);
    if (!event) return;
    if (event.isRecurring) {
      this.eventService.updateRecurringStatus(event.type as 'truface' | 'tips', event.date, status);
    } else {
      this.eventService.updateEvent(event.id, { status });
    }
  }

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
    this.remoteTipsResults.set(null);
    this.tipsSearchError.set(null);
    this.selectedTip.set(null);
    this.tipsDialogOpen.set(true);
    this.buscarTipsRemote();
  }

  closeTipsSearch(): void {
    clearTimeout(this.searchDebounceTimer);
    this.tipsDialogOpen.set(false);
    this.selectedTip.set(null);
  }

  /** Actualiza el término de búsqueda y dispara la búsqueda remota con debounce. */
  onTipsSearchInput(value: string): void {
    this.tipsSearch.set(value);
    this.tipsSearchError.set(null);
    this.applyTipsFilter();
  }

  /** Ejecuta la búsqueda de "Tips generados" (tips cargados en Drive) contra el webhook de n8n. */
  buscarTipsRemote(): void {
    this.isSearchingTips.set(true);
    this.tipsSearchError.set(null);

    this.tipService.buscarTips('').subscribe({
      next: (results) => {
        this.allDriveTips.set(this.normalizeTips(results));
        this.applyTipsFilter();
        this.isSearchingTips.set(false);
      },
      error: () => {
        // Sin conexión con n8n: se muestra la biblioteca local como respaldo.
        this.remoteTipsResults.set(this.tips());
        this.tipsSearchError.set('No fue posible conectar con la biblioteca de Drive. Mostrando tips guardados localmente.');
        this.isSearchingTips.set(false);
      }
    });
  }

  /** Fecha de envío: del nombre del archivo (..._2026-10-09_101115.png) o, si no, del campo de Drive. */
  private parseSentAt(rawTitle: string, fallback?: string): Date | undefined {
    const m = rawTitle.match(/(d{4})-(d{2})-(d{2})_(d{2})(d{2})(d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    const d = fallback ? new Date(fallback) : null;
    return d && !isNaN(d.getTime()) ? d : undefined;
  }

  private applyTipsFilter(): void {
    const all = this.allDriveTips();
    if (!all) return;
    const term = this.tipsSearch().trim().toLowerCase();
    this.remoteTipsResults.set(!term ? all : all.filter(t =>
      [t.title, t.topic, t.description, t.category].some(v => (v ?? '').toLowerCase().includes(term))));
  }

  private normalizeTips(response: any): Tip[] {
    if (!response) return [];

    let rawList: any[] = [];
    if (Array.isArray(response)) {
      rawList = response;
    } else if (response.tips && Array.isArray(response.tips)) {
      rawList = response.tips;
    } else if (response.data && Array.isArray(response.data)) {
      rawList = response.data;
    } else if (response.items && Array.isArray(response.items)) {
      rawList = response.items;
    } else if (response.files && Array.isArray(response.files)) {
      rawList = response.files;
    } else if (typeof response === 'object') {
      rawList = [response];
    }

    return rawList.map((item, index) => {
      const data = item.json || item.data || item;
      const id = data.id || data.fileId || `tip_${Date.now()}_${index}`;
      const rawTitle = data.title || data.titulo || data.texto || data.name || data.nombre || 'Tip generado';
      const sentAt = this.parseSentAt(String(rawTitle), data.createdTime || data.createdAt || data.fecha || data.timestamp);
      const title = String(rawTitle).replace(/_\d{4}-\d{2}-\d{2}_\d+(\.\w+)?$/, '').replace(/\.(png|jpe?g)$/i, '');
      const topic = data.topic || data.tema || data.description || data.descripcion || data.contenido || data.content || '';
      const description = data.description || data.descripcion || topic;
      const category = data.category || data.categoria || data.tipo || 'Tip';
      const url = data.descargarUrl || data.url || data.webViewLink || data.webContentLink || data.link || '';
      const driveId = data.id || data.fileId;
      const driveImage = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000` : '';
      const imageData = data.imageData || (data.imagenUrl ? driveImage : '') || data.image || data.imagen || data.thumbnailLink || data.thumbnailUrl || (data.mimeType?.startsWith('image/') ? data.webContentLink : '');
      const leaderName = data.leaderName || data.lider || data.author || '';
      const createdAt = data.createdAt || data.createdTime || data.fecha || data.timestamp
        ? new Date(data.createdAt || data.createdTime || data.fecha || data.timestamp)
        : new Date();

      return {
        id,
        title,
        topic,
        description,
        category,
        url,
        imageData,
        leaderName,
        sentAt,
        createdAt,
        sentToTelegram: true
      } as Tip;
    });
  }

  showTip(tip: Tip): void {
    this.selectedTip.set(tip);
  }

  downloadTip(tip: Tip): void {
    if (tip.url) { window.open(tip.url, '_blank', 'noopener,noreferrer'); return; }
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
