import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';

type DateRange = 'today' | 'week' | 'month';

const ADMIN_NAMES = ['johana', 'alejandra', 'maria alejandra'];

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics.component.html',
  styleUrl: './metrics.component.scss'
})
export class MetricsComponent implements OnInit {
  private authService = inject(AuthService);
  private eventService = inject(EventService);

  currentLeader$ = this.authService.currentLeader$;
  isAdmin = signal(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  dateRange = signal<DateRange>('month');
  processFilter = signal<string>('all');

  readonly processTypes = [
    { value: 'all',                              label: 'Todos los Procesos' },
    { value: 'Descarga y asignacion de acc id',  label: 'ACC ID' },
    { value: 'Seguimiento tickets cx',           label: 'Tickets CX' },
    { value: 'Revision calidad Face',            label: 'Calidad Face' },
    { value: 'Revision calidad documento',       label: 'Cal. Documento' },
    { value: 'Revision reglas de riesgo',        label: 'Reglas de Riesgo' },
    { value: 'Revision label',                   label: 'Label' },
  ];

  readonly dateRanges: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'week',  label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
  ];

  ngOnInit() {
    this.authService.currentLeader$.subscribe(leader => {
      if (leader) {
        const name = leader.full_name.toLowerCase();
        this.isAdmin.set(ADMIN_NAMES.some(a => name.includes(a)));
      }
    });
  }

  // ── Date helpers ──────────────────────────────────────────────────────────
  private getRangeWindow(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    const end   = new Date(now);

    switch (this.dateRange()) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week': {
        const dow = now.getDay(); // 0=Sun
        start.setDate(now.getDate() - dow);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      }
      default: // month
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  // ── Filtered events ───────────────────────────────────────────────────────
  filteredEvents = computed(() => {
    const { start, end } = this.getRangeWindow();
    const pf = this.processFilter();

    return this.eventService.events().filter(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      return d >= start && d <= end && (pf === 'all' || ev.title === pf);
    });
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  totalTasks      = computed(() => this.filteredEvents().length);
  completedTasks  = computed(() => this.filteredEvents().filter(e => e.status === 'completed').length);
  pendingTasks    = computed(() => this.filteredEvents().filter(e => e.status === 'pending').length);
  inProgressTasks = computed(() => this.filteredEvents().filter(e => e.status === 'in-progress').length);

  completionRate = computed(() => {
    const t = this.totalTasks();
    return t === 0 ? 0 : Math.round((this.completedTasks() / t) * 100);
  });

  // ── Bar chart ─────────────────────────────────────────────────────────────
  barChartData = computed(() => {
    const counts: Record<string, number> = {};
    for (const ev of this.filteredEvents()) {
      const label = this.processTypes.find(p => p.value === ev.title)?.label ?? ev.title;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = entries.length > 0 ? Math.max(...entries.map(e => e[1])) : 1;
    return entries.map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / max) * 100),
    }));
  });

  // ── Pie chart ─────────────────────────────────────────────────────────────
  readonly sliceColors = ['#22c55e', '#3b82f6', '#f59e0b'];

  pieSlices = computed(() => {
    const total = this.totalTasks();
    if (total === 0) return [];
    const raw = [
      { label: 'Completadas', count: this.completedTasks(),  color: '#22c55e' },
      { label: 'En Progreso', count: this.inProgressTasks(), color: '#3b82f6' },
      { label: 'Pendientes',  count: this.pendingTasks(),    color: '#f59e0b' },
    ].filter(d => d.count > 0);

    let cumulative = 0;
    return raw.map(s => {
      const startAngle = cumulative;
      cumulative += s.count / total;
      return { ...s, startAngle, endAngle: cumulative };
    });
  });

  arcPath(startPct: number, endPct: number): string {
    const cx = 90, cy = 90, r = 75, ir = 42;
    const toRad = (p: number) => p * 2 * Math.PI - Math.PI / 2;
    const x1o = cx + r  * Math.cos(toRad(startPct));
    const y1o = cy + r  * Math.sin(toRad(startPct));
    const x2o = cx + r  * Math.cos(toRad(endPct));
    const y2o = cy + r  * Math.sin(toRad(endPct));
    const x1i = cx + ir * Math.cos(toRad(endPct));
    const y1i = cy + ir * Math.sin(toRad(endPct));
    const x2i = cx + ir * Math.cos(toRad(startPct));
    const y2i = cy + ir * Math.sin(toRad(startPct));
    const large = (endPct - startPct) > 0.5 ? 1 : 0;
    return [
      `M ${x1o} ${y1o}`,
      `A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${ir} ${ir} 0 ${large} 0 ${x2i} ${y2i}`,
      'Z'
    ].join(' ');
  }
}
