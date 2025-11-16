import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TipService } from '../../core/services/tip.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-tip-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tip-generator.component.html',
  styleUrl: './tip-generator.component.scss'
})
export class TipGeneratorComponent {
  private tipService = inject(TipService);
  private authService = inject(AuthService);
  
  title = signal('');
  topic = signal('');
  generatedImage = signal<string | null>(null);
  isGenerating = signal(false);
  isSending = signal(false);
  showSuccess = signal(false);
  errorMessage = signal<string | null>(null);

  get canGenerate(): boolean {
    return this.title().trim().length > 0 && this.topic().trim().length > 0 && !this.isGenerating();
  }

  get canSend(): boolean {
    return this.generatedImage() !== null && !this.isSending();
  }

  generateTip() {
    if (!this.canGenerate) return;

    this.isGenerating.set(true);
    this.errorMessage.set(null);
    this.generatedImage.set(null);

    const currentUser = this.authService.currentUser();
    const leaderName = currentUser?.name || 'Líder de Identidad';

    this.tipService.generateTipImage({
      title: this.title(),
      topic: this.topic(),
      leaderName: leaderName
    }).subscribe({
      next: (imageData) => {
        this.generatedImage.set(imageData);
        this.isGenerating.set(false);
      },
      error: (error) => {
        this.errorMessage.set('Error al generar el tip. Intenta nuevamente.');
        this.isGenerating.set(false);
      }
    });
  }

  sendToTelegram() {
    if (!this.canSend) return;

    this.isSending.set(true);
    this.errorMessage.set(null);
    this.showSuccess.set(false);

    const currentUser = this.authService.currentUser();
    const tip = {
      id: `tip_${Date.now()}`,
      title: this.title(),
      topic: this.topic(),
      imageData: this.generatedImage()!,
      createdAt: new Date(),
      sentToTelegram: true,
      leaderName: currentUser?.name || 'Líder de Identidad'
    };

    this.tipService.sendToTelegram(tip).subscribe({
      next: () => {
        this.tipService.saveTip(tip);
        this.showSuccess.set(true);
        this.isSending.set(false);
        
        // Reset form after 3 seconds
        setTimeout(() => {
          this.reset();
        }, 3000);
      },
      error: (error) => {
        this.errorMessage.set('Error al enviar a Telegram. Verifica la configuración.');
        this.isSending.set(false);
      }
    });
  }

  reset() {
    this.title.set('');
    this.topic.set('');
    this.generatedImage.set(null);
    this.showSuccess.set(false);
    this.errorMessage.set(null);
  }
}
