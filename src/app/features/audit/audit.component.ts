import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';

const ADMIN_NAMES = ['johana', 'alejandra', 'maria alejandra'];
const WEEK_DAYS   = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

export interface Analyst {
  id: number;
  displayName: string;
  telegram: string;  // Telegram username (no @)
  avatar: string;    // initials
  color: string;
}

const ANALYSTS: Analyst[] = [
  { id: 1,  displayName: 'KateRhine Angarita',     telegram: 'KaterineAngarita',   avatar: 'KA', color: '#667eea' },
  { id: 2,  displayName: 'Mari Alejandra Murcia',  telegram: 'MariAlejandra_Murcia',avatar: 'MA', color: '#f43f5e' },
  { id: 3,  displayName: 'Cynthia Racas',          telegram: 'cynthiaracas',        avatar: 'CR', color: '#22c55e' },
  { id: 4,  displayName: 'Miroslawa Estrada',      telegram: 'JMiroslawaEstrada',   avatar: 'ME', color: '#f59e0b' },
  { id: 5,  displayName: 'Karen Juliéth',          telegram: 'Karenjuliethh',       avatar: 'KJ', color: '#38bdf8' },
  { id: 6,  displayName: 'Grisell Quiroz',         telegram: 'GrisellQuiroz',       avatar: 'GQ', color: '#a78bfa' },
  { id: 7,  displayName: 'Joha G. Mora',           telegram: 'JohaGMora',           avatar: 'JM', color: '#fb923c' },
  { id: 8,  displayName: 'Majo Velásquez',         telegram: 'majovelasquez',       avatar: 'MV', color: '#34d399' },
  { id: 9,  displayName: 'Erik Castro',            telegram: 'Erikcastro23',        avatar: 'EC', color: '#e879f9' },
  { id: 10, displayName: 'Valentina Mesa',         telegram: 'ValentinaMesaB',      avatar: 'VM', color: '#fbbf24' },
  { id: 11, displayName: 'Cristian M. Rojas',      telegram: 'CristianMRojas',      avatar: 'CM', color: '#60a5fa' },
];

const PROCESS_TYPES = [
  { value: 'Descarga y asignacion de acc id', label: 'ACC ID' },
  { value: 'Seguimiento tickets cx',          label: 'Tickets CX' },
  { value: 'Revision calidad Face',           label: 'Calidad Face' },
  { value: 'Revision calidad documento',      label: 'Cal. Documento' },
  { value: 'Revision reglas de riesgo',       label: 'Reglas de Riesgo' },
  { value: 'Revision label',                  label: 'Label' },
];

const PROCESS_COLORS = ['#667eea', '#22c55e', '#f59e0b', '#f43f5e', '#38bdf8', '#a78bfa'];

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.scss'
})
export class AuditComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private eventService = inject(EventService);

  readonly weekDays    = WEEK_DAYS;
  readonly analysts    = ANALYSTS;
  readonly processTypes = PROCESS_TYPES;

  isAdmin        = signal(false);
  selectedAnalyst = signal<Analyst | null>(null);

  // ── Date range picker ─────────────────────────────────────────────────────
  rangeStart    = signal<Date | null>(null);
  rangeEnd      = signal<Date | null>(null);
  hoverDate     = signal<Date | null>(null);
  calendarOpen  = signal(false);
  pickerYear    = signal(new Date().getFullYear());
  pickerMonth   = signal(new Date().getMonth());

  isLoading    = signal(false);
  private loadingTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Computed picker labels ────────────────────────────────────────────────
  readonly pickerMonthLabel = computed(() =>
    new Date(this.pickerYear(), this.pickerMonth(), 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  );

  readonly rangeLabel = computed(() => {
    const s = this.rangeStart(), e = this.rangeEnd();
    const fmt = (d: Date) =>
      d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!s) return 'Selecciona un rango';
    if (!e) return fmt(s) + ' → …';
    return fmt(s) + '  →  ' + fmt(e);
  });

  // ── Calendar day grid (Monday-first) ─────────────────────────────────────
  calendarDays = computed((): (Date | null)[] => {
    const year  = this.pickerYear();
    const month = this.pickerMonth();
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startPad    = (firstDay + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  });

  // ── Calendar navigation ───────────────────────────────────────────────────
  prevMonth(): void {
    let m = this.pickerMonth() - 1, y = this.pickerYear();
    if (m < 0) { m = 11; y--; }
    this.pickerMonth.set(m); this.pickerYear.set(y);
  }

  nextMonth(): void {
    let m = this.pickerMonth() + 1, y = this.pickerYear();
    if (m > 11) { m = 0; y++; }
    this.pickerMonth.set(m); this.pickerYear.set(y);
  }

  // ── Day selection ─────────────────────────────────────────────────────────
  selectDay(date: Date | null, event: MouseEvent): void {
    event.stopPropagation();
    if (!date) return;
    const s = this.rangeStart(), e = this.rangeEnd();
    if (!s || (s && e)) {
      this.rangeStart.set(new Date(date)); this.rangeEnd.set(null);
    } else {
      if (date < s) { this.rangeEnd.set(new Date(s)); this.rangeStart.set(new Date(date)); }
      else            { this.rangeEnd.set(new Date(date)); }
      this.calendarOpen.set(false);
      this.triggerLoading();
    }
  }

  isDayStart(d: Date | null): boolean  { return !!d && !!this.rangeStart()  && this.sameDay(d, this.rangeStart()!); }
  isDayEnd(d: Date | null): boolean    { return !!d && !!this.rangeEnd()    && this.sameDay(d, this.rangeEnd()!); }
  isDayToday(d: Date | null): boolean  { return !!d && this.sameDay(d, new Date()); }
  isDayInRange(d: Date | null): boolean {
    if (!d) return false;
    const s = this.rangeStart(), e = this.rangeEnd() ?? this.hoverDate();
    if (!s || !e) return false;
    const t = d.getTime();
    return t > Math.min(s.getTime(), e.getTime()) && t < Math.max(s.getTime(), e.getTime());
  }
  private sameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  stopProp(e: MouseEvent): void { e.stopPropagation(); }
  toggleCalendar(e: MouseEvent): void { e.stopPropagation(); this.calendarOpen.update(v => !v); }

  // ── Quick presets ─────────────────────────────────────────────────────────
  applyPreset(preset: 'current-month' | 'last-month' | 'last-7-days'): void {
    const now = new Date();
    let start: Date, end: Date;
    switch (preset) {
      case 'current-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last-month': {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start = lm;
        end   = new Date(lm.getFullYear(), lm.getMonth() + 1, 0);
        break;
      }
      default:
        start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0);
        end   = new Date(now); end.setHours(23, 59, 59, 999);
    }
    this.rangeStart.set(start); this.rangeEnd.set(end);
    this.calendarOpen.set(false);
    this.pickerYear.set(start.getFullYear()); this.pickerMonth.set(start.getMonth());
    this.triggerLoading();
  }

  private triggerLoading(): void {
    if (this.loadingTimer) clearTimeout(this.loadingTimer);
    this.isLoading.set(true);
    this.loadingTimer = setTimeout(() => this.isLoading.set(false), 450);
  }

  // ── Filtered events in range ──────────────────────────────────────────────
  /**
   * Since events don't carry an analyst field yet, we scope to all events in the
   * selected date range. When per-analyst data is available, add
   * `&& ev.analystId === this.selectedAnalyst()?.id` to the filter.
   */
  private filteredInRange = computed(() => {
    const s = this.rangeStart(), e = this.rangeEnd();
    if (!s || !e) return [];
    const start = new Date(s); start.setHours(0, 0, 0, 0);
    const end   = new Date(e); end.setHours(23, 59, 59, 999);
    return this.eventService.events().filter(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      return d >= start && d <= end;
    });
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  totalAssigned  = computed(() => this.filteredInRange().length);
  totalCompleted = computed(() => this.filteredInRange().filter(e => e.status === 'completed').length);
  totalPending   = computed(() => this.filteredInRange().filter(e => e.status === 'pending').length);
  totalProgress  = computed(() => this.filteredInRange().filter(e => e.status === 'in-progress').length);

  completionRate = computed(() => {
    const t = this.totalAssigned();
    return t === 0 ? 0 : Math.round((this.totalCompleted() / t) * 100);
  });

  /** SLA: tasks completed on time (not overdue at time of completion) — approx. % non-overdue */
  efficiencyRate = computed(() => {
    const t = this.totalAssigned();
    if (t === 0) return 0;
    const today   = new Date().toISOString().split('T')[0];
    const overdue = this.filteredInRange().filter(e => e.status === 'pending' && e.date < today).length;
    return Math.round(((t - overdue) / t) * 100);
  });

  /** 0–5 star rating derived from efficiencyRate */
  stars = computed(() => {
    const r = this.efficiencyRate();
    return Math.round(r / 20);   // 100% → 5★
  });

  // ── Bar chart (assigned vs completed per week-day bucket) ─────────────────
  barData = computed(() => {
    const events = this.filteredInRange();
    if (events.length === 0) return [];
    const counts: Record<string, { assigned: number; completed: number }> = {};
    for (const ev of events) {
      if (!counts[ev.date]) counts[ev.date] = { assigned: 0, completed: 0 };
      counts[ev.date].assigned++;
      if (ev.status === 'completed') counts[ev.date].completed++;
    }
    const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
    const maxAssigned = Math.max(...sorted.map(([, v]) => v.assigned), 1);
    return sorted.map(([date, v]) => ({
      label:        new Date(date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      assigned:     v.assigned,
      completed:    v.completed,
      assignedPct:  Math.round((v.assigned  / maxAssigned) * 100),
      completedPct: Math.round((v.completed / maxAssigned) * 100),
    }));
  });

  // ── Process pie chart ─────────────────────────────────────────────────────
  readonly pieColors = PROCESS_COLORS;

  processSlices = computed(() => {
    const total = this.totalAssigned();
    if (total === 0) return [];
    const counts: Record<string, number> = {};
    for (const ev of this.filteredInRange()) {
      const label = this.processTypes.find(p => p.value === ev.title)?.label ?? ev.title;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    let c = 0;
    return entries.map(([label, count], i) => {
      const startAngle = c;
      c += count / total;
      return { label, count, color: PROCESS_COLORS[i % PROCESS_COLORS.length], startAngle, endAngle: c };
    });
  });

  arcPath(startPct: number, endPct: number): string {
    const cx = 90, cy = 90, r = 75, ir = 40;
    const toRad = (p: number) => p * 2 * Math.PI - Math.PI / 2;
    const x1o = cx + r  * Math.cos(toRad(startPct)), y1o = cy + r  * Math.sin(toRad(startPct));
    const x2o = cx + r  * Math.cos(toRad(endPct)),   y2o = cy + r  * Math.sin(toRad(endPct));
    const x1i = cx + ir * Math.cos(toRad(endPct)),   y1i = cy + ir * Math.sin(toRad(endPct));
    const x2i = cx + ir * Math.cos(toRad(startPct)), y2i = cy + ir * Math.sin(toRad(startPct));
    const large = (endPct - startPct) > 0.5 ? 1 : 0;
    return [`M ${x1o} ${y1o}`, `A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o}`,
            `L ${x1i} ${y1i}`, `A ${ir} ${ir} 0 ${large} 0 ${x2i} ${y2i}`, 'Z'].join(' ');
  }

  // ── Telegram contact ──────────────────────────────────────────────────────
  openTelegram(): void {
    const analyst = this.selectedAnalyst();
    if (!analyst) return;
    window.open(`https://t.me/${analyst.telegram}`, '_blank', 'noopener,noreferrer');
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.authService.currentLeader$.subscribe(leader => {
      if (leader) {
        const name = leader.full_name.toLowerCase();
        this.isAdmin.set(ADMIN_NAMES.some(a => name.includes(a)));
      }
    });
    this.applyPreset('current-month');
  }

  ngOnDestroy(): void {
    if (this.loadingTimer) clearTimeout(this.loadingTimer);
  }
}
