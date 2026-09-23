export interface LeaderScheduleTask {
  id?: number;
  fecha: string;        // 'YYYY-MM-DD'
  tarea: 'Truface' | 'Generar Tip' | 'Generar TL';
  lider: string;
  id_telegram: string | null;
  correo: string | null;
  status?: 'pending' | 'in-progress' | 'completed';
  created_at?: string;
}
