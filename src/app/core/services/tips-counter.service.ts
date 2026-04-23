import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TipsCounterService {
  readonly TIPS_FOLDER_URL =
    'https://docs.google.com/presentation/d/1H0el_2CImXBYxXbwHkiBC2OjBgFL_7baDY/edit?slide=id.g34550ae3661_0_268#slide=id.g34550ae3661_0_268';

  private readonly STORAGE_KEY = 'truora_tips_count';

  readonly tipsCount = signal<number>(this.loadCount());

  private loadCount(): number {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? parseInt(raw, 10) : 23;
  }

  increment(): void {
    const next = this.tipsCount() + 1;
    this.tipsCount.set(next);
    localStorage.setItem(this.STORAGE_KEY, String(next));
  }
}
