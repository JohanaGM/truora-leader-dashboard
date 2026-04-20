import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  private automationService = inject(AutomationService);

  activeTab = signal<FlowTab>('telegram');

  // --- Flujo 1: Telegram ---
  dragOver = signal(false);
  selectedFile = signal<File | null>(null);
  telegramLoading = signal(false);
  telegramSuccess = signal(false);
  telegramError = signal<string | null>(null);

  // --- Flujo 2: Snowflake ---
  snowflakeIds = signal('');
  dateStart = signal('');
  dateEnd = signal('');
  snowflakeLoading = signal(false);
  snowflakeSuccess = signal(false);
  snowflakeError = signal<string | null>(null);

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
        this.telegramSuccess.set(true);
        this.telegramLoading.set(false);
        this.selectedFile.set(null);
        if (this.fileInput) this.fileInput.nativeElement.value = '';
        setTimeout(() => this.telegramSuccess.set(false), 4000);
      },
      error: () => {
        this.telegramError.set('Error al enviar el archivo. Verifica el webhook e intenta nuevamente.');
        this.telegramLoading.set(false);
      }
    });
  }

  // ---- Snowflake ----
  get canRunSnowflake(): boolean {
    return (
      this.snowflakeIds().trim().length > 0 &&
      this.dateStart().length > 0 &&
      this.dateEnd().length > 0 &&
      !this.snowflakeLoading()
    );
  }

  runSnowflake() {
    if (!this.canRunSnowflake) return;

    this.snowflakeLoading.set(true);
    this.snowflakeError.set(null);
    this.snowflakeSuccess.set(false);

    this.automationService
      .runSnowflakeQuery(this.snowflakeIds(), this.dateStart(), this.dateEnd())
      .subscribe({
        next: () => {
          this.snowflakeSuccess.set(true);
          this.snowflakeLoading.set(false);
          setTimeout(() => this.snowflakeSuccess.set(false), 4000);
        },
        error: () => {
          this.snowflakeError.set('Error al ejecutar la query. Verifica el webhook e intenta nuevamente.');
          this.snowflakeLoading.set(false);
        }
      });
  }
}
