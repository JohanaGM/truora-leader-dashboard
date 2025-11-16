import { Injectable, signal } from '@angular/core';
import { Activity } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private activitiesSignal = signal<Activity[]>(this.loadActivities());

  readonly activities = this.activitiesSignal.asReadonly();

  private loadActivities(): Activity[] {
    const stored = localStorage.getItem('truora_activities');
    return stored ? JSON.parse(stored) : this.getMockActivities();
  }

  private saveActivities(activities: Activity[]): void {
    localStorage.setItem('truora_activities', JSON.stringify(activities));
  }

  getActivities(): Activity[] {
    return this.activitiesSignal();
  }

  getActivityById(id: string): Activity | undefined {
    return this.activitiesSignal().find(a => a.id === id);
  }

  addActivity(activity: Omit<Activity, 'id'>): Activity {
    const newActivity: Activity = {
      ...activity,
      id: this.generateId()
    };
    const updated = [...this.activitiesSignal(), newActivity];
    this.activitiesSignal.set(updated);
    this.saveActivities(updated);
    return newActivity;
  }

  updateActivity(id: string, updates: Partial<Activity>): Activity | undefined {
    const activities = this.activitiesSignal();
    const index = activities.findIndex(a => a.id === id);
    if (index === -1) return undefined;

    const updated = activities.map(a => 
      a.id === id ? { ...a, ...updates } : a
    );
    this.activitiesSignal.set(updated);
    this.saveActivities(updated);
    return updated[index];
  }

  deleteActivity(id: string): boolean {
    const activities = this.activitiesSignal();
    const filtered = activities.filter(a => a.id !== id);
    if (filtered.length === activities.length) return false;
    
    this.activitiesSignal.set(filtered);
    this.saveActivities(filtered);
    return true;
  }

  private generateId(): string {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMockActivities(): Activity[] {
    return [
      {
        id: '1',
        title: 'Reunión de equipo',
        date: new Date(2025, 10, 15),
        startTime: '09:00',
        endTime: '10:00',
        status: 'pending',
        description: 'Revisión semanal del equipo',
        color: '#FF6B9D'
      },
      {
        id: '2',
        title: 'Revisión de métricas',
        date: new Date(2025, 10, 15),
        startTime: '14:00',
        endTime: '15:00',
        status: 'pending',
        description: 'Análisis de KPIs',
        color: '#4ECDC4'
      }
    ];
  }
}
