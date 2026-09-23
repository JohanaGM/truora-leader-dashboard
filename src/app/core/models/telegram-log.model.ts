export type TelegramLogOrigin = 'announcement' | 'tip';
export type TelegramLogStatus = 'success' | 'error';

export interface TelegramLog {
  id: string;
  sentAt: string;
  senderEmail: string;
  senderName: string;
  origin: TelegramLogOrigin;
  status: TelegramLogStatus;
  message: string;
  chatId: string;
  tipTitle?: string;
  imageUrl?: string;
  libraryUrl?: string;
}
