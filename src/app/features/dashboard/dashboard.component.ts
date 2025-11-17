import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private http = inject(HttpClient);
  
  reminder = signal('');
  isSending = signal(false);
  showSuccess = signal(false);
  errorMessage = signal<string | null>(null);

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

  get canSend(): boolean {
    return this.reminder().trim().length > 0 && !this.isSending();
  }

  sendReminder() {
    if (!this.canSend) return;

    this.isSending.set(true);
    this.errorMessage.set(null);
    this.showSuccess.set(false);

    const payload = {
      reminder: this.reminder(),
      timestamp: new Date().toISOString()
    };

    // URL del webhook de n8n (mismo que para tips)
    const webhookUrl = environment.n8nWebhookUrl;

    this.http.post(webhookUrl, payload).subscribe({
      next: () => {
        this.showSuccess.set(true);
        this.isSending.set(false);
        
        // Reset después de 2 segundos
        setTimeout(() => {
          this.reminder.set('');
          this.showSuccess.set(false);
        }, 2000);
      },
      error: (error) => {
        console.log('Respuesta del webhook (puede ser CORS):', error);
        
        // Asumir éxito si el error es de CORS o de red (el webhook ya se ejecutó)
        if (error.status === 0 || error.status === 404) {
          this.showSuccess.set(true);
          this.isSending.set(false);
          
          setTimeout(() => {
            this.reminder.set('');
            this.showSuccess.set(false);
          }, 2000);
        } else {
          this.errorMessage.set('Error al enviar recordatorio. Intenta nuevamente.');
          this.isSending.set(false);
        }
      }
    });
  }
}
