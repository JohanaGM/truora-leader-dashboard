import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService, VirtualEvent } from '../../core/services/event.service';
import { AppEvent, EventPriority, EventStatus, PRIORITY_COLOR } from '../../core/models/event.model';

interface CalendarDay { date: Date; isCurrentMonth: boolean; }

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss'
})
export class ScheduleComponent {
  private eventService = inject(EventService);

  readonly PRIORITY_COLOR = PRIORITY_COLOR;

  dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  calendarNavDate = signal(new Date());

  calendarTitle = computed(() => {
    const d = this.calendarNavDate();
    return d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
  });

  calendarDays = computed((): CalendarDay[] => {
    this.eventService.events(); // track for reactivity
    const nav = this.calendarNavDate();
    const year = nav.getFullYear();
    const month = nav.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: new Date(d), isCurrentMonth: d.getMonth() === month };
    });
  });

  prevMonth() {
    const d = this.calendarNavDate();
    this.calendarNavDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth() {
    const d = this.calendarNavDate();
    this.calendarNavDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  isToday(date: Date): boolean {
    return date.toDateString() === new Date().toDateString();
  }

  getEventsForDay(date: Date): VirtualEvent[] {
    return this.eventService.getAllForDate(date);
  }

  // ---- Modal ----
  showModal = signal(false);
  editingId  = signal<string | null>(null);

  formData = signal<{
    title: string; date: string; startTime: string; endTime: string;
    priority: EventPriority; status: EventStatus; description: string;
  }>({
    title: '', date: this.eventService.toDateStr(new Date()),
    startTime: '09:00', endTime: '10:00',
    priority: 'medium', status: 'pending', description: '',
  });

  patchForm(patch: Partial<{
    title: string; date: string; startTime: string; endTime: string;
    priority: EventPriority; status: EventStatus; description: string;
  }>) {
    this.formData.set({ ...this.formData(), ...patch });
  }

  openModal(prefillDate?: Date, ev?: AppEvent) {
    if (ev) {
      this.editingId.set(ev.id);
      this.formData.set({
        title: ev.title, date: ev.date,
        startTime: ev.startTime, endTime: ev.endTime,
        priority: ev.priority, status: ev.status,
        description: ev.description ?? '',
      });
    } else {
      this.editingId.set(null);
      this.formData.set({
        title: '',
        date: prefillDate ? this.eventService.toDateStr(prefillDate) : this.eventService.toDateStr(new Date()),
        startTime: '09:00', endTime: '10:00',
        priority: 'medium', status: 'pending', description: '',
      });
    }
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  saveEvent() {
    const d = this.formData();
    if (!d.title.trim()) return;
    const id = this.editingId();
    if (id) {
      this.eventService.updateEvent(id, { ...d, type: 'manual' });
    } else {
      this.eventService.addEvent({ ...d, type: 'manual' });
    }
    this.closeModal();
  }

  deleteEvent(id: string) {
    if (confirm('¿Eliminar este evento?')) this.eventService.deleteEvent(id);
  }

  updateEventStatus(ev: VirtualEvent, status: EventStatus) {
    if (ev.isRecurring) {
      this.eventService.updateRecurringStatus(ev.type as 'truface' | 'tips', ev.date, status);
    } else {
      this.eventService.updateEvent(ev.id, { status });
    }
  }

  openEditModal(ev: VirtualEvent) {
    if (ev.isRecurring) return;
    const stored = this.eventService.events().find(e => e.id === ev.id);
    if (stored) this.openModal(undefined, stored);
  }

  getStatusLabel(s: EventStatus): string {
    return ({ pending: 'Pendiente', 'in-progress': 'En Progreso', completed: 'Completada' } as Record<string,string>)[s] ?? s;
  }

  getPriorityLabel(p: EventPriority): string {
    return ({ low: 'Baja', medium: 'Media', high: 'Alta' } as Record<string,string>)[p] ?? p;
  }

  todayEvents = computed((): VirtualEvent[] => {
    this.eventService.events();
    return this.eventService.getAllForDate(new Date());
  });

  upcomingEvents = computed((): VirtualEvent[] => {
    const todayStr = this.eventService.toDateStr(new Date());
    return this.eventService.events()
      .filter(e => e.date > todayStr && e.type === 'manual')
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({ ...e, color: PRIORITY_COLOR[e.priority], isRecurring: false } as VirtualEvent));
  });
}
