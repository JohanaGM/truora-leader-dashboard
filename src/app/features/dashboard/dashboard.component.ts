import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('reminderTextarea') reminderTextarea!: ElementRef<HTMLTextAreaElement>;
  private http = inject(HttpClient);
  
  reminder = signal('');
  isSending = signal(false);
  showSuccess = signal(false);
  errorMessage = signal<string | null>(null);
  
  analysts = [
    { name: '@MariAlejandra_Murcia', initials: 'MAM' },
    { name: '@cynthiaracas', initials: 'CR' },
    { name: '@JMiroslawaEstrada', initials: 'JME' },
    { name: '@Karenjuliethh', initials: 'KJ' },
    { name: '@GrisellQuiroz', initials: 'GQ' },
    { name: '@JohaGMora', initials: 'JGM' },
    { name: '@majovelasquez', initials: 'MV' },
    { name: '@luzrodriguezj', initials: 'LRJ' },
    { name: '@Erikcastro23', initials: 'EC' }
  ];

  emojis = [
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', ''
  ];

  stats = [
    {
      icon: '📅',
      label: 'Actividades Hoy',
      value: '5',
      trend: '+2',
      color: '#e689a8ff'
    },
    {
      icon: '✅',
      label: 'Tareas Completadas',
      value: '12',
      trend: '+4',
      color: '#37d0ebff'
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
      color: '#db6df7ff'
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
      color: '#6373a7ff'
    },
    {
      icon: '✏️',
      label: 'Crear Tarea',
      route: '/tasks',
      color: '#9471b9ff'
    },
    {
      icon: '💡',
      label: 'Generar Tip',
      route: '/tip-generator',
      color: '#6eaad3ff'
    }
  ];

  get canSend(): boolean {
    return this.reminder().trim().length > 0 && !this.isSending();
  }

  insertAnalystMention(analyst: { name: string; initials: string }) {
    const textarea = this.reminderTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.reminder();
    const mention = analyst.name + ' ';
    
    const newText = text.substring(0, start) + mention + text.substring(end);
    this.reminder.set(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + mention.length, start + mention.length);
    }, 0);
  }

  toggleBold() {
    const textarea = this.reminderTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.reminder();
    const selectedText = text.substring(start, end);
    
    if (selectedText) {
      const newText = text.substring(0, start) + '**' + selectedText + '**' + text.substring(end);
      this.reminder.set(newText);
    }
  }

  toggleUppercase() {
    const textarea = this.reminderTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.reminder();
    const selectedText = text.substring(start, end);
    
    if (selectedText) {
      const newText = text.substring(0, start) + selectedText.toUpperCase() + text.substring(end);
      this.reminder.set(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(end, end);
      }, 0);
    }
  }

  toggleLowercase() {
    const textarea = this.reminderTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.reminder();
    const selectedText = text.substring(start, end);
    
    if (selectedText) {
      const newText = text.substring(0, start) + selectedText.toLowerCase() + text.substring(end);
      this.reminder.set(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(end, end);
      }, 0);
    }
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

    const webhookUrl = environment.n8nWebhookUrl;

    this.http.post(webhookUrl, payload).subscribe({
      next: () => {
        this.showSuccess.set(true);
        this.isSending.set(false);
        
        setTimeout(() => {
          this.reminder.set('');
          this.showSuccess.set(false);
        }, 2000);
      },
      error: (error) => {
        console.log('Respuesta del webhook (puede ser CORS):', error);
        
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
