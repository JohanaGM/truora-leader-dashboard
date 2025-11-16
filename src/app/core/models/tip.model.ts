export interface Tip {
  id: string;
  title: string;
  topic: string;
  imageData: string;
  createdAt: Date;
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
  topic: string;
  leaderName: string;
  timestamp: string;
}
