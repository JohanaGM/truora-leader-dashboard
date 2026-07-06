import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MessageTemplateComponent } from '../message-template/message-template.component';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE_MB = 5;

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageTemplateComponent],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent {
  @ViewChild('reminderTextarea') reminderTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild(MessageTemplateComponent) messageTemplate!: MessageTemplateComponent;

  private http = inject(HttpClient);

  reminder = signal('');
  isSending = signal(false);
  showSuccess = signal(false);
  errorMessage = signal<string | null>(null);
  detectedDriveUrl = signal<string | null>(null);
  driveAlias = signal('Clic para ver archivo');

  // ── Image upload state ────────────────────────────────────────────────────
  selectedFile = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  isDragOver = signal(false);
  fileError = signal<string | null>(null);

  private readonly DRIVE_REGEX = /https?:\/\/drive\.google\.com\/\S+/;

  /** Contacto global Truora — separado visualmente de los analistas del equipo */
  truoraContacts = [
    { name: '@hmarquez', label: 'H. Márquez · Truora' }
  ];

  get canSend(): boolean {
    return (this.reminder().trim().length > 0 || this.selectedFile() !== null) && !this.isSending();
  }

  // ── Derived state from MessageTemplateComponent ───────────────────────────

  private get activeAnalistas(): string[] {
    return this.messageTemplate?.selectedUsers ?? [];
  }

  private get activeTags(): string[] {
    const key = this.messageTemplate?.activeTemplate;
    if (!key) return [];
    const label = this.messageTemplate.templates.find(t => t.key === key)?.label;
    return label ? [label] : [];
  }

  // ── Textarea handlers ─────────────────────────────────────────────────────

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

  // ── Image upload handlers ─────────────────────────────────────────────────

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.processFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.processFile(file);
    // Reset so the same file can be re-selected if removed and re-added
    input.value = '';
  }

  private processFile(file: File | null) {
    this.fileError.set(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      this.fileError.set('Solo se aceptan imágenes PNG, JPG o JPEG.');
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      this.fileError.set(`El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    // Revoke previous object URL to avoid memory leaks
    const prev = this.previewUrl();
    if (prev) URL.revokeObjectURL(prev);

    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  removeFile() {
    const prev = this.previewUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.fileError.set(null);
  }

  triggerFilePicker() {
    this.fileInput.nativeElement.click();
  }

  // ── Send ──────────────────────────────────────────────────────────────────

  enviarATelegram() {
    if (!this.canSend) return;

    this.isSending.set(true);
    this.errorMessage.set(null);
    this.showSuccess.set(false);

    let texto = this.reminder();
    const url = this.detectedDriveUrl();
    if (url) {
      const alias = this.driveAlias().trim() || 'Clic para ver archivo';
      texto = texto.replace(url, '').replace(/[ \t]+$/gm, '').trimEnd();
      texto = texto + `\n[${alias}](${url})`;
    }

    const analistas = this.activeAnalistas;
    const tags      = this.activeTags;
    const file      = this.selectedFile();

    if (file) {
      // ── Escenario B: texto + imagen → multipart/form-data ─────────────────
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('texto', texto);
      formData.append('analistas', JSON.stringify(analistas));
      formData.append('tags', JSON.stringify(tags));

      this.http.post(environment.n8nWebhookUrl, formData)
        .subscribe({
          next: (res) => {
            console.log('[Telegram] ✅ Enviado con imagen. Respuesta n8n:', res);
            this.onSendSuccess();
          },
          error: (err) => {
            console.error('[Telegram] ❌ Error al enviar con imagen:', err);
            this.onSendError();
          }
        });
    } else {
      // ── Escenario A: solo texto → JSON ────────────────────────────────────
      const payload = { texto, analistas, tags };

      this.http.post(environment.n8nWebhookUrl, payload)
        .subscribe({
          next: (res) => {
            console.log('[Telegram] ✅ Enviado como JSON. Respuesta n8n:', res);
            this.onSendSuccess();
          },
          error: (err) => {
            console.error('[Telegram] ❌ Error al enviar JSON:', err);
            this.onSendError();
          }
        });
    }
  }

  private onSendSuccess() {
    this.showSuccess.set(true);
    this.isSending.set(false);
    setTimeout(() => {
      this.reminder.set('');
      this.detectedDriveUrl.set(null);
      this.driveAlias.set('Clic para ver archivo');
      this.showSuccess.set(false);
      this.removeFile();
    }, 2000);
  }

  private onSendError() {
    this.errorMessage.set('Error al enviar. Intenta nuevamente.');
    this.isSending.set(false);
  }
}
