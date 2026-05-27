export interface LeaderScheduleTask {
  id?: number;
  fecha: string;        // 'YYYY-MM-DD'
  tarea: 'Truface' | 'Generar Tip';
  lider: string;
  id_telegram: string | null;
  correo: string | null;
  created_at?: string;
}
