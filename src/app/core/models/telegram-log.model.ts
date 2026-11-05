export type TelegramLogOrigin = 'announcement' | 'tip';
export type TelegramLogStatus = 'success' | 'error';

export interface TelegramLog {
  id: string;
  /** Fecha/hora de envío (o programada) en ISO */
  sentAt: string;
  senderEmail: string;
  senderName: string;
  origin: TelegramLogOrigin;
  status: TelegramLogStatus;
  message: string;
  /** Destinatarios (analistas / tags) */
  recipients: string[];
  tipTitle?: string;
  mediaKind?: 'image' | 'video' | null;
  links?: { texto: string; url: string }[];
}

export type NewTelegramLog = Omit<TelegramLog, 'id' | 'senderEmail' | 'senderName'>;
