import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
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
  private supabase: SupabaseClient = createClient(
    environment.supabase.url,
    environment.supabase.key
  );

  private eventsSignal = signal<AppEvent[]>(this.loadCache());
  readonly events = this.eventsSignal.asReadonly();

  constructor() {
    this.syncFromSupabase();
  }

  // ── Cache (localStorage) ──────────────────────────────────────────────────

  private loadCache(): AppEvent[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveCache(events: AppEvent[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
  }

  // ── Supabase sync ─────────────────────────────────────────────────────────

  private async currentUserId(): Promise<string | null> {
    const { data: { session } } = await this.supabase.auth.getSession();
    return session?.user?.id ?? null;
  }

  private async syncFromSupabase(): Promise<void> {
    const userId = await this.currentUserId();
    if (!userId) return;

    const { data } = await this.supabase
      .from('app_events')
      .select('*')
      .eq('leader_id', userId);

    if (data) {
      const events: AppEvent[] = data.map((r: Record<string, unknown>) => ({
        id:          r['id'] as string,
        title:       r['title'] as string,
        date:        r['date'] as string,
        startTime:   r['start_time'] as string,
        endTime:     r['end_time'] as string,
        type:        r['type']     as AppEvent['type'],
        status:      r['status']   as EventStatus,
        priority:    r['priority'] as EventPriority,
        description: r['description'] as string | undefined ?? undefined,
      }));
      this.eventsSignal.set(events);
      this.saveCache(events);
    }
  }

  private async pushToSupabase(ev: AppEvent): Promise<void> {
    const userId = await this.currentUserId();
    if (!userId) return;
    await this.supabase.from('app_events').upsert({
      id:          ev.id,
      leader_id:   userId,
      title:       ev.title,
      date:        ev.date,
      start_time:  ev.startTime,
      end_time:    ev.endTime,
      type:        ev.type,
      status:      ev.status,
      priority:    ev.priority,
      description: ev.description ?? null,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  // ── CRUD ──────────────────────────────────────────────────────────────────

  addEvent(data: Omit<AppEvent, 'id'>): AppEvent {
    // Support recurring override keys passed via cast (e.g. truface_2026-04-21)
    const overrideId = (data as AppEvent).id;
    const ev: AppEvent = { ...data, id: overrideId || this.generateId() };
    const updated = [...this.eventsSignal(), ev];
    this.eventsSignal.set(updated);
    this.saveCache(updated);
    this.pushToSupabase(ev);
    return ev;
  }

  updateEvent(id: string, patch: Partial<AppEvent>): void {
    const updated = this.eventsSignal().map(e =>
      e.id === id ? { ...e, ...patch } : e
    );
    this.eventsSignal.set(updated);
    this.saveCache(updated);
    const ev = updated.find(e => e.id === id);
    if (ev) this.pushToSupabase(ev);
  }

  deleteEvent(id: string): void {
    const updated = this.eventsSignal().filter(e => e.id !== id);
    this.eventsSignal.set(updated);
    this.saveCache(updated);
    this.supabase.from('app_events').delete().eq('id', id);
  }

  updateRecurringStatus(recurringId: string, date: string, status: EventStatus): void {
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

  // ── Recurring generation ──────────────────────────────────────────────────

  getRecurringForDate(date: Date): VirtualEvent[] {
    const dow     = date.getDay();
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

  // ── Week helpers ──────────────────────────────────────────────────────────

  getWeekBounds(ref = new Date()): { start: Date; end: Date } {
    const d   = new Date(ref);
    const day = d.getDay();

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

    const dow   = (day + 6) % 7;
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

  // ── Computed stats ────────────────────────────────────────────────────────

  readonly weekStats = computed(() => {
    this.eventsSignal();
    const week = this.getEventsForWeek();
    return {
      pending:    week.filter(e => e.status === 'pending').length,
      inProgress: week.filter(e => e.status === 'in-progress').length,
      completed:  week.filter(e => e.status === 'completed').length,
    };
  });
}
