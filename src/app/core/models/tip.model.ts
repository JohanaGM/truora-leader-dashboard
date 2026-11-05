export interface Tip {
  id: string;
  title: string;
  topic: string;
  description?: string;
  category?: string;
  url?: string;
  imageData: string;
  createdAt: Date;
  /** Fecha real de envío/creación, si se conoce (p. ej. viene en el nombre del archivo de Drive). */
  sentAt?: Date;
  sentToTelegram: boolean;
  leaderName: string;
}

export interface TipGenerationRequest {
  title: string;
  topic: string;
  leaderName: string;
}

export interface TipTelegramPayload {
  image: string;
  texto: string;
  title: string;
  topic: string;
  leaderName: string;
  timestamp: string;
}
