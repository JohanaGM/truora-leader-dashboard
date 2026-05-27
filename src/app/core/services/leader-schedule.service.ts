import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { LeaderScheduleTask } from '../models/leader-schedule.model';

@Injectable({ providedIn: 'root' })
export class LeaderScheduleService {
  private http        = inject(HttpClient);
  private authService = inject(AuthService);

  /** Tareas de la semana actual para el líder logueado */
  weekTasks = signal<LeaderScheduleTask[]>([]);
  isLoading = signal(false);

  // ── Helpers de fecha ───────────────────────────────────────────────────

  /** Devuelve { start: 'lunes', end: 'domingo' } de la semana que contiene `date` */
  getWeekRange(date: Date = new Date()): { start: string; end: string } {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();                 // 0=dom, 1=lun …
    const toMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + toMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (dt: Date) => dt.toISOString().split('T')[0];
    return { start: fmt(monday), end: fmt(sunday) };
  }

  toDateStr(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /** Icono según el tipo de tarea */
  taskIcon(tarea: string): string {
    return tarea === 'Generar Tip' ? '💡' : '👤';
  }

  /** Color de acento según el tipo de tarea */
  taskColor(tarea: string): string {
    return tarea === 'Generar Tip' ? '#764ba2' : '#1a3a5f';
  }

  // ── Carga desde assets ─────────────────────────────────────────────────

  /** Lee el JSON de assets y filtra por correo del líder + semana actual */
  loadWeekTasks(): void {
    const leader = this.authService.getCurrentLeader();
    if (!leader?.email) {
      this.weekTasks.set([]);
      return;
    }

    this.isLoading.set(true);
    const { start, end } = this.getWeekRange(new Date());
    const leaderEmail = leader.email.trim().toLowerCase();

    this.http.get<LeaderScheduleTask[]>('assets/data/leader-schedule.json').subscribe({
      next: (all) => {
        const filtered = all.filter(t => {
          const correo = (t.correo ?? '').trim().toLowerCase();
          return correo === leaderEmail && t.fecha >= start && t.fecha <= end;
        });
        this.weekTasks.set(filtered);
        this.isLoading.set(false);
      },
      error: () => {
        this.weekTasks.set([]);
        this.isLoading.set(false);
      }
    });
  }
}

