import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AutomationService {
  private http = inject(HttpClient);

  sendTelegramJson(file: File): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('timestamp', new Date().toISOString());
    return this.http.post(environment.n8nTelegramWebhookUrl, formData);
  }

  runSnowflakeQuery(ids: string, dateStart: string, dateEnd: string): Observable<unknown> {
    const payload = {
      ids: ids.split(',').map(id => id.trim()).filter(id => id.length > 0),
      dateStart,
      dateEnd,
      timestamp: new Date().toISOString()
    };
    return this.http.post(environment.n8nSnowflakeWebhookUrl, payload);
  }
}
