import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { NewTelegramLog, TelegramLog } from '../models/telegram-log.model';

@Injectable({ providedIn: 'root' })
export class TelegramHistoryService {
  private supabase = inject(SupabaseService).client;
  private auth = inject(AuthService);

  async list(fromIso: string, toIso: string): Promise<TelegramLog[]> {
    const { data, error } = await this.supabase
      .from('telegram_history')
      .select('*')
      .gte('send_at', fromIso)
      .lt('send_at', toIso)
      .order('send_at', { ascending: true });
    if (error) { console.error('[Historial] Error al leer:', error); return []; }
    return (data ?? []).map(r => ({
      id: String(r.id),
      sentAt: r.send_at,
      senderEmail: r.sender_email,
      senderName: r.sender_name,
      origin: r.origin,
      status: r.status,
      message: r.message,
      recipients: r.recipients ?? [],
      tipTitle: r.title ?? undefined,
      mediaKind: r.media_kind,
      links: r.links ?? []
    }));
  }

  /** Registra un envío en el cronograma. Nunca lanza: un fallo aquí no debe afectar el envío. */
  async log(entry: NewTelegramLog): Promise<void> {
    try {
      const leader = this.auth.getCurrentLeader();
      if (!leader) return;
      const { error } = await this.supabase.from('telegram_history').insert({
        send_at: entry.sentAt,
        origin: entry.origin,
        status: entry.status,
        sender_email: leader.email,
        sender_name: leader.full_name,
        title: entry.tipTitle ?? null,
        message: entry.message,
        recipients: entry.recipients,
        media_kind: entry.mediaKind ?? null,
        links: entry.links ?? []
      });
      if (error) console.error('[Historial] Error al guardar:', error);
    } catch (e) {
      console.error('[Historial] Error inesperado:', e);
    }
  }
}
