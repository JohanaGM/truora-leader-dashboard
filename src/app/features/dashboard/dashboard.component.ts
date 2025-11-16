import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  stats = [
    {
      icon: '📅',
      label: 'Actividades Hoy',
      value: '5',
      trend: '+2',
      color: '#FF6B9D'
    },
    {
      icon: '✅',
      label: 'Tareas Completadas',
      value: '12',
      trend: '+4',
      color: '#4ECDC4'
    },
    {
      icon: '⏰',
      label: 'Tareas Pendientes',
      value: '8',
      trend: '-1',
      color: '#FFD93D'
    },
    {
      icon: '💡',
      label: 'Tips Generados',
      value: '23',
      trend: '+3',
      color: '#95E1D3'
    }
  ];

  recentActivities = [
    {
      title: 'Reunión de equipo',
      time: '09:00 AM',
      status: 'pending',
      color: '#FF6B9D'
    },
    {
      title: 'Revisión de métricas',
      time: '02:00 PM',
      status: 'pending',
      color: '#4ECDC4'
    },
    {
      title: 'One-on-One con analista',
      time: '04:00 PM',
      status: 'completed',
      color: '#95E1D3'
    }
  ];

  quickActions = [
    {
      icon: '➕',
      label: 'Nueva Actividad',
      route: '/schedule',
      color: '#667eea'
    },
    {
      icon: '✏️',
      label: 'Crear Tarea',
      route: '/tasks',
      color: '#764ba2'
    },
    {
      icon: '💡',
      label: 'Generar Tip',
      route: '/tip-generator',
      color: '#ff6b9d'
    }
  ];
}
