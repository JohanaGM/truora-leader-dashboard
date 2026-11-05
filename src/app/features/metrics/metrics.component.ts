import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TelegramLog, TelegramLogOrigin } from '../../core/models/telegram-log.model';
import { TelegramHistoryService } from '../../core/services/telegram-history.service';

const HOUR_PX = 56;          // alto de cada hora en la cuadrícula
const EVENT_MIN = 30;        // duración visual de cada envío (min)
const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

interface PositionedLog {
  log: TelegramLog;
  top: number;
  height: number;
  left: number;   // %
  width: number;  // %
}

interface DayColumn {
  date: Date;
  key: string;
  label: string;
  number: number;
  isToday: boolean;
  events: PositionedLog[];
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics.component.html',
  styleUrl: './metrics.component.scss'
})
export class MetricsComponent implements OnInit, AfterViewInit {
  private history = inject(TelegramHistoryService);
  @ViewChild('scroller') scroller?: ElementRef<HTMLDivElement>;

  readonly hourPx = HOUR_PX;
  readonly hours = Array.from({ length: 24 }, (_, h) => h);

  readonly logs = signal<TelegramLog[]>([]);
  readonly loading = signal(false);
  readonly weekStart = signal(this.startOfWeek(new Date()));
  readonly selectedUser = signal('all');
  readonly selectedOrigin = signal<'all' | TelegramLogOrigin>('all');
  readonly selected = signal<TelegramLog | null>(null);

  readonly users = computed(() => {
    const m = new Map<string, string>();
    for (const l of this.logs()) m.set(l.senderEmail, l.senderName);
    return [...m.entries()].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly title = computed(() => {
    const start = this.weekStart();
    const end = this.addDays(start, 6);
    const m = (d: Date) => d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
    return start.getMonth() === end.getMonth()
      ? `${m(start)} ${start.getFullYear()}`
      : `${m(start)} – ${m(end)} ${end.getFullYear()}`;
  });

  readonly days = computed<DayColumn[]>(() => {
    const user = this.selectedUser();
    const origin = this.selectedOrigin();
    const todayKey = this.key(new Date());
    const filtered = this.logs().filter(l =>
      (user === 'all' || l.senderEmail === user) && (origin === 'all' || l.origin === origin));

    return Array.from({ length: 7 }, (_, i) => {
      const date = this.addDays(this.weekStart(), i);
      const key = this.key(date);
      const dayLogs = filtered.filter(l => this.key(new Date(l.sentAt)) === key);
      return {
        date, key,
        label: DAY_NAMES[date.getDay()],
        number: date.getDate(),
        isToday: key === todayKey,
        events: this.layout(dayLogs)
      };
    });
  });

  readonly weekCount = computed(() => this.days().reduce((n, d) => n + d.events.length, 0));

  /** Posición de la línea de "ahora" (solo si la semana visible incluye hoy). */
  readonly nowTop = computed(() => {
    this.logs(); // re-evalúa al recargar
    const n = new Date();
    return this.days().some(d => d.isToday) ? (n.getHours() + n.getMinutes() / 60) * HOUR_PX : null;
  });

  ngOnInit(): void { this.load(); }

  ngAfterViewInit(): void {
    // Arranca mostrando la jornada laboral (7 a. m.)
    setTimeout(() => { if (this.scroller) this.scroller.nativeElement.scrollTop = 7 * HOUR_PX; });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    const from = this.weekStart();
    this.logs.set(await this.history.list(from.toISOString(), this.addDays(from, 7).toISOString()));
    this.loading.set(false);
  }

  prev(): void { this.weekStart.set(this.addDays(this.weekStart(), -7)); this.load(); }
  next(): void { this.weekStart.set(this.addDays(this.weekStart(), 7)); this.load(); }
  today(): void { this.weekStart.set(this.startOfWeek(new Date())); this.load(); }

  setUser(v: string): void { this.selectedUser.set(v); }
  setOrigin(v: string): void { this.selectedOrigin.set(v as 'all' | TelegramLogOrigin); }
  open(log: TelegramLog): void { this.selected.set(log); }
  close(): void { this.selected.set(null); }

  hourLabel(h: number): string {
    if (h === 0) return '';
    return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
  }

  eventTitle(l: TelegramLog): string {
    return l.origin === 'tip' ? (l.tipTitle || 'Tip') : l.message;
  }

  originLabel(o: TelegramLogOrigin): string { return o === 'tip' ? 'Tip' : 'Aviso'; }
  isScheduled(l: TelegramLog): boolean { return new Date(l.sentAt).getTime() > Date.now(); }

  statusLabel(l: TelegramLog): string {
    if (l.status === 'error') return 'Error';
    return this.isScheduled(l) ? 'Programado' : 'Enviado';
  }

  // ── Utilidades de fecha / layout ───────────────────────────────────────
  private startOfWeek(d: Date): Date {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    r.setDate(r.getDate() - r.getDay());
    return r;
  }
  private addDays(d: Date, n: number): Date {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }
  private key(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  /** Coloca los eventos del día; los que se solapan se reparten en columnas. */
  private layout(logs: TelegramLog[]): PositionedLog[] {
    const items = logs
      .map(log => {
        const d = new Date(log.sentAt);
        const startMin = d.getHours() * 60 + d.getMinutes();
        return { log, startMin, endMin: startMin + EVENT_MIN, col: 0, cols: 1 };
      })
      .sort((a, b) => a.startMin - b.startMin);

    let cluster: typeof items = [];
    let clusterEnd = -1;
    const flush = () => {
      const colEnds: number[] = [];
      for (const it of cluster) {
        let c = colEnds.findIndex(end => end <= it.startMin);
        if (c === -1) { c = colEnds.length; colEnds.push(0); }
        colEnds[c] = it.endMin;
        it.col = c;
      }
      cluster.forEach(it => it.cols = colEnds.length);
      cluster = [];
    };
    for (const it of items) {
      if (cluster.length && it.startMin >= clusterEnd) { flush(); clusterEnd = -1; }
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.endMin);
    }
    flush();

    return items.map(it => ({
      log: it.log,
      top: (it.startMin / 60) * HOUR_PX,
      height: Math.max((EVENT_MIN / 60) * HOUR_PX, 26),
      left: (it.col / it.cols) * 100,
      width: 100 / it.cols
    }));
  }
}
