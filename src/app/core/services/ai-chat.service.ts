import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
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

    const payload = {
      message: message,
      sessionId: 'user-123',
      history: this.chatHistory,
    };

    return forkJoin([
      this.http.post<ChatResponse>(environment.n8nChatWebhookUrl, payload),
      this.http.post<any>(environment.n8nChatActivacionUrl, payload)
    ]).pipe(map(([chatResponse]) => chatResponse));
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
