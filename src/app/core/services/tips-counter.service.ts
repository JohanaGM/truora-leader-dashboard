import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TipsCounterService {
  private http = inject(HttpClient);

  readonly TIPS_FOLDER_URL =
    'https://drive.google.com/drive/folders/1Ek-AwsnHK6oFwXNfNohj_13fFjty1qlg';

  private readonly STORAGE_KEY = 'truora_tips_count';
  private readonly webhookUrl = environment.n8nContadorTipsUrl;

  readonly tipsCount = signal<number>(this.loadCount());

  private loadCount(): number {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? parseInt(raw, 10) : 23;
  }

  /** Fetches the real count from n8n (GET). Updates the signal and localStorage. */
  fetchCount(): Observable<{ totalTips: number }> {
    return this.http.get<{ totalTips: number }>(this.webhookUrl).pipe(
      tap(res => {
        this.tipsCount.set(res.totalTips);
        localStorage.setItem(this.STORAGE_KEY, String(res.totalTips));
      }),
      catchError(err => {
        console.warn('[TipsCounter] fetchCount error:', err);
        return of({ totalTips: this.tipsCount() });
      })
    );
  }

  increment(): void {
    const next = this.tipsCount() + 1;
    this.tipsCount.set(next);
    localStorage.setItem(this.STORAGE_KEY, String(next));
    // Notify n8n production webhook
    this.http.post(this.webhookUrl, { count: next, timestamp: new Date().toISOString() })
      .subscribe({ error: err => console.warn('[TipsCounter] webhook error:', err) });
  }
}
