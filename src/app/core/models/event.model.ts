export type EventType = 'truface' | 'tips' | 'manual';
export type EventStatus = 'pending' | 'in-progress' | 'completed';
export type EventPriority = 'low' | 'medium' | 'high';

export interface AppEvent {
  id: string;
  title: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  type: EventType;
  status: EventStatus;
  priority: EventPriority;
  description?: string;
}

export const PRIORITY_COLOR: Record<EventPriority, string> = {
  high:   '#e53e3e',
  medium: '#d69e2e',
  low:    '#3182ce',
};

export const RECURRING_COLOR: Record<'truface' | 'tips', string> = {
  truface: '#FF6B9D',
  tips:    '#9471b9',
};
