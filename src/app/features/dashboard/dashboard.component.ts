import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MessageTemplateComponent } from '../message-template/message-template.component';
import { TaskService, ActivityService } from '../../core/services';
import { EventService } from '../../core/services/event.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageTemplateComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  @ViewChild('reminderTextarea') reminderTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild(MessageTemplateComponent) messageTemplate!: MessageTemplateComponent;
  private http = inject(HttpClient);
  private router = inject(Router);
  private taskService = inject(TaskService);
  private activityService = inject(ActivityService);
  private eventService = inject(EventService);

  // TODO: en el futuro obtener dinámicamente de un servicio según el líder autenticado
  private readonly TIPS_FOLDER_URL = 'https://drive.google.com/drive/folders/example-folder-id';

  reminder = signal('');
  isSending = signal(false);
  showSuccess = signal(false);
  errorMessage = signal<string | null>(null);
  detectedDriveUrl = signal<string | null>(null);
  driveAlias = signal('Clic para ver archivo');

  private readonly DRIVE_REGEX = /https?:\/\/drive\.google\.com\/\S+/;

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

  stats = computed(() => [
    { key: 'activities', icon: '📅', label: 'Actividades Hoy',    value: this.statsActivitiesToday(), color: '#e689a8ff' },
    { key: 'completed',  icon: '✅', label: 'Tareas Completadas', value: this.statsTasksCompleted(),  color: '#37d0ebff' },
    { key: 'pending',    icon: '⏰', label: 'Tareas Pendientes',  value: this.statsTasksPending(),    color: '#FFD93D'   },
    { key: 'tips',       icon: '💡', label: 'Tips Generados',     value: 23,                          color: '#db6df7ff' },
  ]);

  todayActivities = computed(() => {
    this.eventService.events();
    return this.eventService.getAllForDate(new Date())
      .map(e => ({ title: e.title, time: e.startTime, status: e.status, color: e.color }));
  });
  
  analysts = [
    { name: '@MariAlejandra_Murcia', initials: 'MAM' },
    { name: '@cynthiaracas', initials: 'CR' },
    { name: '@JMiroslawaEstrada', initials: 'JME' },
    { name: '@Karenjuliethh', initials: 'KJ' },
    { name: '@GrisellQuiroz', initials: 'GQ' },
    { name: '@JohaGMora', initials: 'JGM' },
    { name: '@majovelasquez', initials: 'MV' },
    { name: '@KaterineAngarita', initials: 'KA' },
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

  quickActions = [
    { icon: '➕', label: 'Nueva Actividad', route: '/schedule', color: '#6373a7ff' },
    { icon: '✏️', label: 'Crear Tarea',     route: '/tasks',    color: '#9471b9ff' },
    { icon: '💡', label: 'Generar Tip',     route: '/tip-generator', color: '#6eaad3ff' }
  ];

  openTipsFolder() {
    window.open(this.TIPS_FOLDER_URL, '_blank', 'noopener,noreferrer');
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  get canSend(): boolean {
    return this.reminder().trim().length > 0 && !this.isSending();
  }

  onTextareaInput(value: string) {
    this.reminder.set(value);
    this.messageTemplate?.clearActiveTemplate();
    const match = value.match(this.DRIVE_REGEX);
    this.detectedDriveUrl.set(match ? match[0] : null);
  }

  onMessageSelected(message: string) {
    this.reminder.set(message);
    const match = message.match(this.DRIVE_REGEX);
    this.detectedDriveUrl.set(match ? match[0] : null);
  }

  onMentionAction(event: { name: string; checked: boolean }) {
    const textarea = this.reminderTextarea.nativeElement;
    if (event.checked) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = this.reminder();
      const mention = event.name + ' ';
      const newText = text.substring(0, start) + mention + text.substring(end);
      this.reminder.set(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + mention.length, start + mention.length);
      }, 0);
    } else {
      const escaped = event.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const newText = this.reminder().replace(new RegExp(escaped + '\\s?', 'g'), '').trimEnd();
      this.reminder.set(newText ? newText + ' ' : '');
    }
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

  insertEmoji(emoji: string) {
    const textarea = this.reminderTextarea.nativeElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.reminder();
      const emojiText = emoji + ' ';    
      const newText = text.substring(0, start) + emojiText + text.substring(end);
    this.reminder.set(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emojiText.length, start + emojiText.length);
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

    let body = this.reminder();
    const url = this.detectedDriveUrl();
    if (url) {
      const alias = this.driveAlias().trim() || 'Clic para ver archivo';
      body = body.replace(url, '').replace(/[ \t]+$/gm, '').trimEnd();
      body = body + `\n[${alias}](${url})`;
    }

    const payload = {
      reminder: body,
      timestamp: new Date().toISOString()
    };

    const webhookUrl = environment.n8nWebhookUrl;

    this.http.post(webhookUrl, payload).subscribe({
      next: () => {
        this.showSuccess.set(true);
        this.isSending.set(false);
        setTimeout(() => {
          this.reminder.set('');
          this.detectedDriveUrl.set(null);
          this.driveAlias.set('Clic para ver archivo');
          this.showSuccess.set(false);
        }, 2000);
      },
      error: (error) => {
        this.errorMessage.set('Error al enviar recordatorio. Intenta nuevamente.');
        this.isSending.set(false);
      }
    });
  }
}
