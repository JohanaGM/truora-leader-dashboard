export interface Activity {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  description?: string;
  color?: string;
}
