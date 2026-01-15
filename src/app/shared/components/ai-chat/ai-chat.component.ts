import { Component, EventEmitter, Output, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiChatService, ChatMessage } from '../../../core/services/ai-chat.service';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat.component.html',
  styleUrl: './ai-chat.component.scss'
})
export class AiChatComponent implements AfterViewChecked {
  @Output() tipGenerated = new EventEmitter<string>();
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages = signal<ChatMessage[]>([]);
  userMessage = '';
  isLoading = signal(false);
  private shouldScroll = false;

  constructor(private aiChatService: AiChatService) {
    this.messages.set(this.aiChatService.getChatHistory());
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  sendMessage(): void {
    if (!this.userMessage.trim() || this.isLoading()) return;

    const message = this.userMessage.trim();
    this.userMessage = '';
    this.isLoading.set(true);
    this.shouldScroll = true;

    this.aiChatService.sendMessage(message).subscribe({
      next: (response) => {
        this.aiChatService.addAssistantMessage(response.tipContent);
        this.messages.set(this.aiChatService.getChatHistory());
        this.tipGenerated.emit(response.tipContent);
        this.isLoading.set(false);
        this.shouldScroll = true;
      },
      error: (error) => {
        console.error('Error al enviar mensaje:', error);
        this.aiChatService.addAssistantMessage('Lo siento, ocurrió un error. Por favor, intenta de nuevo.');
        this.messages.set(this.aiChatService.getChatHistory());
        this.isLoading.set(false);
        this.shouldScroll = true;
      }
    });
  }

  useSuggestion(suggestion: string): void {
    this.userMessage = suggestion;
    this.sendMessage();
  }

  clearChat(): void {
    this.aiChatService.clearHistory();
    this.messages.set([]);
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error al hacer scroll:', err);
    }
  }
}
