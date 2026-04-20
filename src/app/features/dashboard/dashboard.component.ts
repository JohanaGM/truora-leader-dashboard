import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EventService } from '../../core/services/event.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private router = inject(Router);
  private eventService = inject(EventService);

  // TODO: en el futuro obtener dinámicamente de un servicio según el líder autenticado
  private readonly TIPS_FOLDER_URL = 'https://drive.google.com/drive/folders/example-folder-id';

  // ---- Computed stats (datos reales) ----
  statsActivitiesToday = computed(() => {
    this.eventService.events();
    return this.eventService.getAllForDate(new Date()).length;
  });

  statsTasksCompleted = computed(() =>
    this.eventService.getEventsForWeek().filter(e => e.status === 'completed').length
  );

  statsTasksPending = computed(() =>
    this.eventService.getEventsForWeek().filter(e => e.status === 'pending').length
  );

  tipsCount = computed(() =>
    this.eventService.getEventsForWeek().filter(e => e.type === 'tips' && e.status === 'completed').length
  );

  stats = computed(() => [
    { key: 'activities', icon: '📅', label: 'Actividades Hoy',    value: this.statsActivitiesToday(), color: 'rgb(99 25 50)' },
    { key: 'completed',  icon: '✅', label: 'Tareas Completadas', value: this.statsTasksCompleted(),  color: 'rgb(7 56 65)' },
    { key: 'pending',    icon: '⏰', label: 'Tareas Pendientes',  value: this.statsTasksPending(),    color: 'rgb(131 110 27)'   },
    { key: 'tips',       icon: '💡', label: 'Tips Generados',     value: this.tipsCount(),            color: 'rgb(113 18 137)' },
  ]);

  todayActivities = computed(() => {
    this.eventService.events();
    return this.eventService.getAllForDate(new Date())
      .map(e => ({ title: e.title, time: e.startTime, status: e.status, color: e.color }));
  });
  
  quickActions = [
    { icon: '📅', label: 'Cronograma', route: '/schedule', color: 'rgb(153 171 158)' },
    { icon: '✏️', label: 'Crear Tarea',     route: '/tasks',    color: 'rgb(159 143 143)' },
    { icon: '💡', label: 'Generar Tip',     route: '/tip-generator', color: 'rgb(26 54 73)'},
    { icon: '⚙️', label: 'Automatizaciones', route: '/automations', color: 'rgb(101 118 175)' },
    { icon: '📢', label: 'Crear Aviso',    route: '/avisos',       color: 'rgb(14 80 110)' }
  ];

  openTipsFolder() {
    window.open(this.TIPS_FOLDER_URL, '_blank', 'noopener,noreferrer');
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }
}
