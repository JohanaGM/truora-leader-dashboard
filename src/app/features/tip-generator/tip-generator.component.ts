import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TipService } from '../../core/services/tip.service';
import { AuthService } from '../../core/services/auth.service';
import { AiChatComponent } from '../../shared/components/ai-chat/ai-chat.component';
import { EmojiPickerComponent } from '../../shared/components/emoji-picker/emoji-picker.component';
import html2canvas from 'html2canvas';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-tip-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, AiChatComponent, EmojiPickerComponent],
  templateUrl: './tip-generator.component.html',
  styleUrl: './tip-generator.component.scss'
})
export class TipGeneratorComponent {
  private tipService = inject(TipService);
  authService = inject(AuthService);
  
  @ViewChild('tipCanvas', { static: false }) tipCanvas!: ElementRef<HTMLDivElement>;
  
  title = signal('');
  topic = signal('');
  decorativeImage = signal<string | null>(null);
  generatedImage = signal<string | null>(null);
  isGenerating = signal(false);
  isSending = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  imageErrorMessage = signal<string | null>(null);
  validationError = signal<string | null>(null);
  fontSize = signal(34);

  get canGenerate(): boolean {
    return this.title().trim().length > 0 && this.topic().trim().length > 0 && !this.isGenerating();
  }

  get canSend(): boolean {
    return this.generatedImage() !== null && !this.isSending();
  }

  get currentDate(): string {
    return new Date().toLocaleDateString('es-ES');
  }

  get leaderName(): string {
    return this.authService.getCurrentLeader()?.full_name || 'Líder de Identidad';
  }

  async generateTip() {
    this.validationError.set(null);
    
    if (!this.title().trim()) {
      this.validationError.set('⚠️ Debes completar el Título del Tip');
      setTimeout(() => this.validationError.set(null), 4000);
      return;
    }
    
    if (!this.topic().trim()) {
      this.validationError.set('⚠️ Debes completar el Contenido del Tip');
      setTimeout(() => this.validationError.set(null), 4000);
      return;
    }

    if (this.isGenerating()) return;

    this.isGenerating.set(true);
    this.errorMessage.set(null);
    this.generatedImage.set(null);

    try {
      // Esperar un ciclo de renderizado para que Angular actualice el DOM y las imágenes se carguen
      await new Promise(resolve => setTimeout(resolve, 1000));

      const canvas = await html2canvas(this.tipCanvas.nativeElement, {
        backgroundColor: null,
        scale: 2,
        logging: true,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0
      });

      const imageData = canvas.toDataURL('image/png');
      this.generatedImage.set(imageData);
      this.isGenerating.set(false);
    } catch (error) {
      console.error('Error generating tip:', error);
      this.errorMessage.set('Error al generar el tip. Intenta nuevamente.');
      this.isGenerating.set(false);
    }
  }

  sendToTelegram() {
    if (!this.canSend) return;

    this.isSending.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const currentLeader = this.authService.getCurrentLeader();
    const tip = {
      id: `tip_${Date.now()}`,
      title: this.title(),
      topic: this.topic(),
      imageData: this.generatedImage()!,
      createdAt: new Date(),
      sentToTelegram: true,
      leaderName: currentLeader?.full_name || 'Líder de Identidad'
    };

    this.tipService.sendToTelegram(tip)
      .pipe(
        finalize(() => {
          // Esto se ejecuta siempre, tanto en éxito como en error
          this.isSending.set(false);
        })
      )
      .subscribe({
        next: (response) => {       
          // Mostrar mensaje de éxito
          this.successMessage.set('¡Tip enviado exitosamente a Telegram!');
        },
        error: (error) => {
          this.errorMessage.set('Error al enviar a Telegram. Por favor, intenta nuevamente.');
        }
      });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const maxSizeInMB = 10;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      this.imageErrorMessage.set('El archivo debe ser una imagen');
      return;
    }

    // Validar peso
    if (file.size > maxSizeInBytes) {
      this.imageErrorMessage.set(`La imagen no debe superar ${maxSizeInMB}MB (tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }

    // Leer y convertir a base64
    const reader = new FileReader();
    reader.onload = (e) => {
      this.decorativeImage.set(e.target?.result as string);
      this.imageErrorMessage.set(null);
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.decorativeImage.set(null);
    this.imageErrorMessage.set(null);
  }

  onTipGeneratedByIA(content: string) {
    this.topic.set(content);
    // Scroll hacia el formulario para que el usuario vea el contenido generado
    const inputSection = document.querySelector('.input-section');
    if (inputSection) {
      inputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  insertEmoji(emoji: string) {
    const textarea = document.querySelector('.topic-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = this.topic();
    const emojiText = emoji + ' ';
    
    const newText = text.substring(0, start) + emojiText + text.substring(end);
    this.topic.set(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emojiText.length, start + emojiText.length);
    }, 0);
  }

  reset() {
    this.title.set('');
    this.topic.set('');
    this.decorativeImage.set(null);
    this.generatedImage.set(null);
    this.successMessage.set(null);
    this.errorMessage.set(null);
    this.imageErrorMessage.set(null);
    this.validationError.set(null);
    this.fontSize.set(34);
  }
}
