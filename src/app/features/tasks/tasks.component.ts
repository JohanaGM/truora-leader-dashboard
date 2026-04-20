import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventService, VirtualEvent } from '../../core/services/event.service';
import { AppEvent, EventPriority, EventStatus } from '../../core/models/event.model';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent {
  private eventService = inject(EventService);

  filterStatus   = signal<EventStatus | 'all'>('all');
  filterPriority = signal<EventPriority | 'all'>('all');

  weekEvents = computed((): VirtualEvent[] => {
    this.eventService.events(); // track
    return this.eventService.getEventsForWeek();
  });

  filteredEvents = computed((): VirtualEvent[] => {
    let list = this.weekEvents();
    const st = this.filterStatus();
    if (st !== 'all') list = list.filter(e => e.status === st);
    const pr = this.filterPriority();
    if (pr !== 'all') list = list.filter(e => e.priority === pr);
    return list;
  });

  pendingCount    = computed(() => this.weekEvents().filter(e => e.status === 'pending').length);
  inProgressCount = computed(() => this.weekEvents().filter(e => e.status === 'in-progress').length);
  completedCount  = computed(() => this.weekEvents().filter(e => e.status === 'completed').length);

  updateStatus(ev: VirtualEvent, status: EventStatus) {
    if (ev.isRecurring) {
      this.eventService.updateRecurringStatus(ev.type as 'truface' | 'tips', ev.date, status);
    } else {
      this.eventService.updateEvent(ev.id, { status });
    }
  }

  deleteEvent(ev: VirtualEvent) {
    if (ev.isRecurring) return;
    if (confirm('¿Eliminar este evento?')) this.eventService.deleteEvent(ev.id);
  }

  // ---- Side panel for creating/editing manual events ----
  showSidePanel  = signal(false);
  editingId      = signal<string | null>(null);

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

  openPanel(ev?: VirtualEvent) {
    if (ev && !ev.isRecurring) {
      const stored = this.eventService.events().find(e => e.id === ev.id);
      if (!stored) return;
      this.editingId.set(stored.id);
      this.formData.set({
        title: stored.title, date: stored.date,
        startTime: stored.startTime, endTime: stored.endTime,
        priority: stored.priority, status: stored.status,
        description: stored.description ?? '',
      });
    } else {
      this.editingId.set(null);
      this.formData.set({
        title: '', date: this.eventService.toDateStr(new Date()),
        startTime: '09:00', endTime: '10:00',
        priority: 'medium', status: 'pending', description: '',
      });
    }
    this.showSidePanel.set(true);
  }

  closePanel() { this.showSidePanel.set(false); this.editingId.set(null); }

  saveEvent() {
    const d = this.formData();
    if (!d.title.trim()) return;
    const id = this.editingId();
    if (id) {
      this.eventService.updateEvent(id, { ...d, type: 'manual' });
    } else {
      this.eventService.addEvent({ ...d, type: 'manual' });
    }
    this.closePanel();
  }

  getPriorityLabel(p: EventPriority): string {
    return ({ low: 'Baja', medium: 'Media', high: 'Alta' } as Record<string,string>)[p] ?? p;
  }

  getStatusLabel(s: EventStatus): string {
    return ({ pending: 'Pendiente', 'in-progress': 'En Progreso', completed: 'Completada' } as Record<string,string>)[s] ?? s;
  }

  getPriorityBorderColor(p: EventPriority): string {
    return { high: '#e53e3e', medium: '#d69e2e', low: '#3182ce' }[p];
  }
}
