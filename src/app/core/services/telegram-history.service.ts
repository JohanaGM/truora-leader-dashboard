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

  /** Tips enviados (título, analista, fecha) para cruzarlos con la biblioteca de Drive. */
  async listTipSenders(): Promise<{ title: string; sender: string; sentAt: Date }[]> {
    const { data, error } = await this.supabase
      .from('telegram_history')
      .select('title, sender_name, send_at')
      .eq('origin', 'tip')
      .eq('status', 'success')
      .order('send_at', { ascending: false })
      .limit(2000);
    if (error) { console.error('[Historial] Error al leer tips:', error); return []; }
    return (data ?? []).map(r => ({ title: r.title ?? '', sender: r.sender_name, sentAt: new Date(r.send_at) }));
  }

  /** Analista asignado manualmente a cada tip de la biblioteca (por id de archivo de Drive). */
  async listTipAnalysts(): Promise<Record<string, string>> {
    const { data, error } = await this.supabase.from('tip_analysts').select('file_id, analyst');
    if (error) { console.error('[Biblioteca] Error al leer analistas:', error); return {}; }
    return Object.fromEntries((data ?? []).map(r => [r.file_id, r.analyst]));
  }

  async setTipAnalyst(fileId: string, analyst: string): Promise<boolean> {
    const leader = this.auth.getCurrentLeader();
    const q = analyst
      ? this.supabase.from('tip_analysts').upsert({ file_id: fileId, analyst, updated_by: leader?.email ?? null, updated_at: new Date().toISOString() })
      : this.supabase.from('tip_analysts').delete().eq('file_id', fileId);
    const { error } = await q;
    if (error) { console.error('[Biblioteca] Error al guardar analista:', error); return false; }
    return true;
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
