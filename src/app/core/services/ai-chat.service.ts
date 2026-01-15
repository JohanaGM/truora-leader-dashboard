import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatResponse {
  tipContent: string;
  sources?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AiChatService {
  private chatHistory: ChatMessage[] = [];

  constructor(private http: HttpClient) {}

  sendMessage(message: string): Observable<ChatResponse> {
    this.chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    return this.http.post<ChatResponse>(
      environment.n8nChatWebhookUrl,
      { 
        message,
        history: this.chatHistory.slice(-5) // Últimos 5 mensajes de contexto
      }
    );
  }

  addAssistantMessage(content: string): void {
    this.chatHistory.push({
      role: 'assistant',
      content,
      timestamp: new Date()
    });
  }

  getChatHistory(): ChatMessage[] {
    return this.chatHistory;
  }

  clearHistory(): void {
    this.chatHistory = [];
  }
}
