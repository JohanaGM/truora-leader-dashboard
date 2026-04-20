import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MessageTemplateComponent } from '../message-template/message-template.component';

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageTemplateComponent],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent {
  @ViewChild('reminderTextarea') reminderTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild(MessageTemplateComponent) messageTemplate!: MessageTemplateComponent;

  private http = inject(HttpClient);

  reminder = signal('');
  isSending = signal(false);
  showSuccess = signal(false);
  errorMessage = signal<string | null>(null);
  detectedDriveUrl = signal<string | null>(null);
  driveAlias = signal('Clic para ver archivo');

  private readonly DRIVE_REGEX = /https?:\/\/drive\.google\.com\/\S+/;

  /** Contacto global Truora — separado visualmente de los analistas del equipo */
  truoraContacts = [
    { name: '@hmarquez', label: 'H. Márquez · Truora' }
  ];

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
      const end   = textarea.selectionEnd;
      const text  = this.reminder();
      const mention = event.name + ' ';
      this.reminder.set(text.substring(0, start) + mention + text.substring(end));
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

  insertTruoraContact(name: string) {
    const textarea = this.reminderTextarea.nativeElement;
    const start  = textarea.selectionStart;
    const end    = textarea.selectionEnd;
    const text   = this.reminder();
    const mention = name + ' ';
    this.reminder.set(text.substring(0, start) + mention + text.substring(end));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + mention.length, start + mention.length);
    }, 0);
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

    this.http.post(environment.n8nWebhookUrl, { reminder: body, timestamp: new Date().toISOString() })
      .subscribe({
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
        error: () => {
          this.errorMessage.set('Error al enviar. Intenta nuevamente.');
          this.isSending.set(false);
        }
      });
  }
}
