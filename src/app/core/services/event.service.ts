import { Injectable, signal, computed } from '@angular/core';
import {
  AppEvent, EventStatus, EventPriority,
  PRIORITY_COLOR, RECURRING_COLOR
} from '../models/event.model';

export interface VirtualEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;
  endTime: string;
  type: AppEvent['type'];
  status: EventStatus;
  priority: EventPriority;
  color: string;
  isRecurring: boolean;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly STORAGE_KEY = 'truora_events_v2';

  private eventsSignal = signal<AppEvent[]>(this.loadEvents());
  readonly events = this.eventsSignal.asReadonly();

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private loadEvents(): AppEvent[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : this.getSeedEvents();
    } catch {
      return this.getSeedEvents();
    }
  }

  private save(events: AppEvent[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
  }

  private generateId(): string {
    return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  colorFor(ev: AppEvent | VirtualEvent): string {
    if (ev.type === 'truface') return RECURRING_COLOR.truface;
    if (ev.type === 'tips')    return RECURRING_COLOR.tips;
    return PRIORITY_COLOR[ev.priority];
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  addEvent(data: Omit<AppEvent, 'id'>): AppEvent {
    const ev: AppEvent = { ...data, id: this.generateId() };
    const updated = [...this.eventsSignal(), ev];
    this.eventsSignal.set(updated);
    this.save(updated);
    return ev;
  }

  updateEvent(id: string, patch: Partial<AppEvent>): void {
    const updated = this.eventsSignal().map(e =>
      e.id === id ? { ...e, ...patch } : e
    );
    this.eventsSignal.set(updated);
    this.save(updated);
  }

  deleteEvent(id: string): void {
    const updated = this.eventsSignal().filter(e => e.id !== id);
    this.eventsSignal.set(updated);
    this.save(updated);
  }

  updateRecurringStatus(recurringId: string, date: string, status: EventStatus): void {
    // Recurring events are virtual — we materialise an override record
    const key = `${recurringId}_${date}`;
    const existing = this.eventsSignal().find(e => e.id === key);
    if (existing) {
      this.updateEvent(key, { status });
    } else {
      const [type, time] = recurringId === 'truface'
        ? ['truface' as const, '08:00']
        : ['tips'    as const, '14:00'];
      const title = type === 'truface' ? 'Truface' : 'Generar Tips';
      this.addEvent({
        id: key,
        title,
        date,
        startTime: time,
        endTime:   time,
        type,
        status,
        priority: 'medium',
      } as Omit<AppEvent, 'id'>);
    }
  }

  // ─── Recurring generation ──────────────────────────────────────────────────

  getRecurringForDate(date: Date): VirtualEvent[] {
    const dow   = date.getDay();
    const dateStr = this.toDateStr(date);
    const result: VirtualEvent[] = [];

    const addRecurring = (id: string, title: string, type: 'truface' | 'tips', time: string) => {
      const override = this.eventsSignal().find(e => e.id === `${id}_${dateStr}`);
      result.push({
        id:          `${id}_${dateStr}`,
        title,
        date:        dateStr,
        startTime:   time,
        endTime:     time,
        type,
        status:      override?.status ?? 'pending',
        priority:    'medium',
        color:       RECURRING_COLOR[type],
        isRecurring: true,
      });
    };

    if ([1, 3, 5].includes(dow)) addRecurring('truface', 'Truface',      'truface', '08:00');
    if (dow === 4)                addRecurring('tips',    'Generar Tips', 'tips',    '14:00');

    return result;
  }

  getManualForDate(date: Date): VirtualEvent[] {
    const dateStr = this.toDateStr(date);
    return this.eventsSignal()
      .filter(e => e.date === dateStr && e.type === 'manual')
      .map(e => ({ ...e, color: PRIORITY_COLOR[e.priority], isRecurring: false }));
  }

  getAllForDate(date: Date): VirtualEvent[] {
    return [...this.getRecurringForDate(date), ...this.getManualForDate(date)];
  }

  // ─── Week helpers ─────────────────────────────────────────────────────────

  getWeekBounds(ref = new Date()): { start: Date; end: Date } {
    const d   = new Date(ref);
    const day = d.getDay(); // 0=Sun, 6=Sat

    // On weekends show the UPCOMING Mon–Sun work week
    if (day === 0 || day === 6) {
      const daysToMonday = day === 0 ? 1 : 2;
      const start = new Date(d);
      start.setDate(d.getDate() + daysToMonday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    // On weekdays: current Mon–Sun
    const dow   = (day + 6) % 7; // Mon = 0
    const start = new Date(d); start.setDate(d.getDate() - dow); start.setHours(0, 0, 0, 0);
    const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  getEventsForWeek(ref = new Date()): VirtualEvent[] {
    const { start, end } = this.getWeekBounds(ref);
    const days: VirtualEvent[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(...this.getAllForDate(new Date(d)));
    }
    return days.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }

  // ─── Computed stats ────────────────────────────────────────────────────────

  readonly weekStats = computed(() => {
    this.eventsSignal(); // track
    const week = this.getEventsForWeek();
    return {
      pending:    week.filter(e => e.status === 'pending').length,
      inProgress: week.filter(e => e.status === 'in-progress').length,
      completed:  week.filter(e => e.status === 'completed').length,
    };
  });

  // ─── Seed ─────────────────────────────────────────────────────────────────

  private getSeedEvents(): AppEvent[] {
    return [];
  }
}
