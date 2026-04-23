import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AutomationService {
  private http = inject(HttpClient);

  sendTelegramJson(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('timestamp', new Date().toISOString());
    return this.http.post(environment.n8nTelegramWebhookUrl, formData, {
      responseType: 'text'
    });
  }
}
