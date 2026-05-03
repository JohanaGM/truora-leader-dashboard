import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AutomationService } from '../../core/services/automation.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

type FlowTab = 'telegram' | 'snowflake';

@Component({
  selector: 'app-automations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './automations.component.html',
  styleUrl: './automations.component.scss'
})
export class AutomationsComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private automationService = inject(AutomationService);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  activeTab = signal<FlowTab>('telegram');

  readonly DOC_GENERAL_PROMIGAS_URL = 'https://docs.google.com/spreadsheets/d/1Gqf7jPhgEpry5yoEu3jaJEbI91_xJQCWtVGYlkiicYw/edit?gid=1569152008#gid=1569152008';

  // --- Flujo 1: Telegram ---
  dragOver      = signal(false);
  selectedFile  = signal<File | null>(null);
  telegramLoading = signal(false);
  telegramSuccess = signal(false);
  telegramError   = signal<string | null>(null);
  isCompleted     = signal(false);

  // --- Flujo 2: Desbloqueo ACC ID – Done button ---
  accIdDoneLoading = signal(false);
  accIdDoneSuccess = signal(false);
  accIdDoneError   = signal<string | null>(null);

  markAccIdDone(): void {
    if (this.accIdDoneLoading()) return;
    this.accIdDoneLoading.set(true);
    this.accIdDoneSuccess.set(false);
    this.accIdDoneError.set(null);

    const today = new Date().toISOString().split('T')[0];
    const usuario = this.authService.getCurrentLeader()?.full_name ?? 'Desconocido';
    const payload = { usuario, accion: 'Revisión de ACC ID', fecha: today };

    this.http.post(environment.n8nTareaFinalizadaUrl, payload).subscribe({
      next: () => {
        this.accIdDoneLoading.set(false);
        this.accIdDoneSuccess.set(true);
        setTimeout(() => this.accIdDoneSuccess.set(false), 4000);
      },
      error: () => {
        this.accIdDoneLoading.set(false);
        this.accIdDoneError.set('Error al notificar. Intenta nuevamente.');
        setTimeout(() => this.accIdDoneError.set(null), 4000);
      }
    });
  }

  setTab(tab: FlowTab) {
    this.activeTab.set(tab);
  }

  // ---- Drag & Drop ----
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave() {
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
  }

  handleFile(file: File) {
    if (!file.name.endsWith('.json')) {
      this.telegramError.set('Solo se aceptan archivos .json');
      return;
    }
    this.telegramError.set(null);
    this.selectedFile.set(file);
  }

  get canSendTelegram(): boolean {
    return !!this.selectedFile() && !this.telegramLoading();
  }

  sendTelegramFile() {
    const file = this.selectedFile();
    if (!file || !this.canSendTelegram) return;

    this.telegramLoading.set(true);
    this.telegramError.set(null);
    this.telegramSuccess.set(false);

    this.automationService.sendTelegramJson(file).subscribe({
      next: () => {
        this.isCompleted.set(true);
        this.telegramLoading.set(false);
        this.selectedFile.set(null);
        if (this.fileInput) this.fileInput.nativeElement.value = '';
      },
      error: () => {
        this.telegramError.set('Error al enviar el archivo. Verifica el webhook e intenta nuevamente.');
        this.telegramLoading.set(false);
      }
    });
  }

}
