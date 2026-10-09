import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AutomationService } from '../../core/services/automation.service';

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
  @ViewChild('csvInput') csvInput!: ElementRef<HTMLInputElement>;

  private automationService = inject(AutomationService);

  activeTab = signal<FlowTab>('telegram');

  readonly DOC_GENERAL_PROMIGAS_URL = 'https://docs.google.com/spreadsheets/d/1Gqf7jPhgEpry5yoEu3jaJEbI91_xJQCWtVGYlkiicYw/edit?gid=1569152008#gid=1569152008';

  // --- Flujo 1: Telegram ---
  dragOver      = signal(false);
  selectedFile  = signal<File | null>(null);
  telegramLoading = signal(false);
  telegramSuccess = signal(false);
  telegramError   = signal<string | null>(null);
  isCompleted     = signal(false);

  // --- Flujo 2: CSV ACC ID ---
  csvDragOver  = signal(false);
  csvFile      = signal<File | null>(null);
  csvLoading   = signal(false);
  csvError     = signal<string | null>(null);
  csvCompleted = signal(false);

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

  // ---- CSV ACC ID ----
  onCsvDragOver(event: DragEvent) {
    event.preventDefault();
    this.csvDragOver.set(true);
  }

  onCsvDragLeave() {
    this.csvDragOver.set(false);
  }

  onCsvDrop(event: DragEvent) {
    event.preventDefault();
    this.csvDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.handleCsvFile(file);
  }

  onCsvSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleCsvFile(file);
  }

  handleCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.csvError.set('Solo se aceptan archivos .csv');
      return;
    }
    this.csvError.set(null);
    this.csvCompleted.set(false);
    this.csvFile.set(file);
  }

  get canSendCsv(): boolean {
    return !!this.csvFile() && !this.csvLoading();
  }

  sendCsvFile() {
    const file = this.csvFile();
    if (!file || !this.canSendCsv) return;

    this.csvLoading.set(true);
    this.csvError.set(null);

    this.automationService.sendAccIdCsv(file).subscribe({
      next: () => {
        this.csvCompleted.set(true);
        this.csvLoading.set(false);
        this.csvFile.set(null);
        if (this.csvInput) this.csvInput.nativeElement.value = '';
      },
      error: (error: HttpErrorResponse) => {
        const responseDetail = typeof error.error === 'string' ? error.error : error.message;
        const message = error.status === 0
          ? 'No hubo respuesta del webhook. Verifica la conexión y la configuración CORS de n8n.'
          : `El webhook respondió con HTTP ${error.status}${responseDetail ? `: ${responseDetail}` : '.'}`;
        this.csvError.set(message);
        this.csvLoading.set(false);
      }
    });
  }

}
