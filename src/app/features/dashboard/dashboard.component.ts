import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EventService, VirtualEvent } from '../../core/services/event.service';
import { EventStatus } from '../../core/models/event.model';
import { TipsCounterService } from '../../core/services/tips-counter.service';
import { LeaderScheduleService } from '../../core/services/leader-schedule.service';
import { TipService } from '../../core/services/tip.service';
import { Tip } from '../../core/models';
import { ANALYSTS, analystLabel, handleFromName } from '../../core/constants/analysts';
import { TelegramHistoryService } from '../../core/services/telegram-history.service';

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
  private telegramHistory = inject(TelegramHistoryService);
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
  // ---- Filtros de la biblioteca ----
  tipsDateFrom = signal('');
  tipsDateTo = signal('');
  tipsAnalyst = signal('all');
  /** Envíos de tips registrados en el historial (para saber qué analista envió cada tip). */
  private tipSenders = signal<{ title: string; sender: string; sentAt: Date }[]>([]);
  /** Asignaciones manuales (id de Drive → mención). */
  private tipAssignments = signal<Record<string, string>>({});
  readonly analysts = ANALYSTS;
  readonly analystLabel = analystLabel;
  readonly unassignedCount = computed(() => (this.allDriveTips() ?? []).filter(t => !this.analystOf(t)).length);
  readonly analystOptions = computed(() => {
    const known = new Set(ANALYSTS.map(a => a.handle));
    const extras = new Set<string>();
    for (const t of this.allDriveTips() ?? []) { const a = this.analystOf(t); if (a && !known.has(a)) extras.add(a); }
    return [...ANALYSTS.map(a => a.handle), ...[...extras].sort()];
  });
  readonly hasTipFilters = computed(() => !!this.tipsDateFrom() || !!this.tipsDateTo() || this.tipsAnalyst() !== 'all');

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
    this.loadLibrary(); // precarga la biblioteca para que abra al instante
  }

  openTipsSearch(): void {
    this.tips.set(this.tipService.getTips());
    this.tipsSearch.set('');
    this.clearTipFilters(false);
    this.remoteTipsResults.set(null);
    this.tipsSearchError.set(null);
    this.selectedTip.set(null);
    this.tipsDialogOpen.set(true);
    this.applyTipsFilter();   // muestra al instante lo que ya está en memoria
    this.loadLibrary();       // y lo actualiza en segundo plano
  }

  setTipDateFrom(v: string): void { this.tipsDateFrom.set(v); this.applyTipsFilter(); }
  setTipDateTo(v: string): void { this.tipsDateTo.set(v); this.applyTipsFilter(); }
  setTipAnalyst(v: string): void { this.tipsAnalyst.set(v); this.applyTipsFilter(); }
  clearTipFilters(apply = true): void {
    this.tipsDateFrom.set(''); this.tipsDateTo.set(''); this.tipsAnalyst.set('all');
    if (apply) this.applyTipsFilter();
  }

  /** Analista del tip: asignación manual, o el que lo envió según el historial de Telegram. */
  analystOf(tip: Tip): string {
    const manual = this.tipAssignments()[tip.id];
    if (manual) return manual;
    const key = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const title = key(tip.title);
    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    const matches = this.tipSenders().filter(s => key(s.title) === title);
    const byDay = tip.sentAt ? matches.find(s => sameDay(s.sentAt, tip.sentAt!)) : undefined;
    const sender = (byDay ?? matches[0])?.sender ?? '';
    return sender ? (handleFromName(sender) ?? sender) : '';
  }

  /** Asigna (o quita) el analista de un tip de la biblioteca y lo guarda para todo el equipo. */
  async assignAnalyst(tip: Tip, handle: string): Promise<void> {
    const prev = this.tipAssignments();
    const next = { ...prev };
    if (handle) next[tip.id] = handle; else delete next[tip.id];
    this.tipAssignments.set(next);
    this.applyTipsFilter();
    const ok = await this.telegramHistory.setTipAnalyst(tip.id, handle);
    if (!ok) {
      this.tipAssignments.set(prev);
      this.applyTipsFilter();
      this.tipsSearchError.set('No se pudo guardar el analista. Verifica que la tabla tip_analysts exista en Supabase.');
    }
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
  loadLibrary(): void {
    // 1) Pinta al instante lo último guardado en el navegador
    if (!this.allDriveTips()) {
      const cached = this.tipService.readDriveCache();
      if (cached) this.allDriveTips.set(this.normalizeTips(cached));
    }
    if (this.allDriveTips()) this.applyTipsFilter();
    else this.isSearchingTips.set(true);
    this.tipsSearchError.set(null);

    // 2) Actualiza desde Drive en segundo plano (sin bloquear la pantalla)
    this.tipService.buscarTips('').subscribe({
      next: (results) => {
        this.tipService.writeDriveCache(results);
        this.allDriveTips.set(this.normalizeTips(results));
        this.applyTipsFilter();
        this.isSearchingTips.set(false);
      },
      error: () => {
        if (!this.allDriveTips()) {
          // Sin conexión con n8n y sin copia local: se muestra la biblioteca local como respaldo.
          this.remoteTipsResults.set(this.tips());
          this.tipsSearchError.set('No fue posible conectar con la biblioteca de Drive. Mostrando tips guardados localmente.');
        }
        this.isSearchingTips.set(false);
      }
    });

    // 3) Analistas (historial de envíos y asignaciones manuales)
    this.telegramHistory.listTipSenders().then(s => { this.tipSenders.set(s); this.applyTipsFilter(); });
    this.telegramHistory.listTipAnalysts().then(a => { this.tipAssignments.set(a); this.applyTipsFilter(); });
  }

  /** Fecha de envío: del nombre del archivo (..._2026-10-09_101115.png) o, si no, del campo de Drive. */
  private parseSentAt(rawTitle: string, fallback?: string): Date | undefined {
    const m = rawTitle.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    const d = fallback ? new Date(fallback) : null;
    return d && !isNaN(d.getTime()) ? d : undefined;
  }

  private applyTipsFilter(): void {
    const all = this.allDriveTips();
    if (!all) return;
    const term = this.tipsSearch().trim().toLowerCase();
    const from = this.tipsDateFrom() ? new Date(this.tipsDateFrom() + 'T00:00:00') : null;
    const to = this.tipsDateTo() ? new Date(this.tipsDateTo() + 'T23:59:59') : null;
    const analyst = this.tipsAnalyst();
    this.remoteTipsResults.set(all.filter(t =>
      (!term || [t.title, t.topic, t.description, t.category].some(v => (v ?? '').toLowerCase().includes(term))) &&
      (!from || (!!t.sentAt && t.sentAt >= from)) &&
      (!to || (!!t.sentAt && t.sentAt <= to)) &&
      (analyst === 'all' || (analyst === '__none__' ? !this.analystOf(t) : this.analystOf(t) === analyst))));
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
      const thumbUrl = driveId && data.imagenUrl ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w400` : '';
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
        thumbUrl,
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
