import { Injectable, signal } from '@angular/core';
import { Task } from '../models';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private tasksSignal = signal<Task[]>(this.loadTasks());

  readonly tasks = this.tasksSignal.asReadonly();

  private loadTasks(): Task[] {
    const stored = localStorage.getItem('truora_tasks');
    return stored ? JSON.parse(stored) : this.getMockTasks();
  }

  private saveTasks(tasks: Task[]): void {
    localStorage.setItem('truora_tasks', JSON.stringify(tasks));
  }

  getTasks(): Task[] {
    return this.tasksSignal();
  }

  getTaskById(id: string): Task | undefined {
    return this.tasksSignal().find(t => t.id === id);
  }

  getTasksByStatus(status: Task['status']): Task[] {
    return this.tasksSignal().filter(t => t.status === status);
  }

  getTasksByPriority(priority: Task['priority']): Task[] {
    return this.tasksSignal().filter(t => t.priority === priority);
  }

  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const now = new Date();
    const newTask: Task = {
      ...task,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    const updated = [...this.tasksSignal(), newTask];
    this.tasksSignal.set(updated);
    this.saveTasks(updated);
    return newTask;
  }

  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const tasks = this.tasksSignal();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return undefined;

    const updated = tasks.map(t => 
      t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t
    );
    this.tasksSignal.set(updated);
    this.saveTasks(updated);
    return updated[index];
  }

  deleteTask(id: string): boolean {
    const tasks = this.tasksSignal();
    const filtered = tasks.filter(t => t.id !== id);
    if (filtered.length === tasks.length) return false;
    
    this.tasksSignal.set(filtered);
    this.saveTasks(filtered);
    return true;
  }

  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMockTasks(): Task[] {
    return [
      {
        id: '1',
        title: 'Revisar reportes mensuales',
        description: 'Análisis de reportes de identidad',
        priority: 'high',
        status: 'in-progress',
        dueDate: new Date(2025, 10, 18),
        createdAt: new Date(2025, 10, 10),
        updatedAt: new Date(2025, 10, 10)
      },
      {
        id: '2',
        title: 'Preparar presentación',
        description: 'Presentación para stakeholders',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(2025, 10, 20),
        createdAt: new Date(2025, 10, 12),
        updatedAt: new Date(2025, 10, 12)
      },
      {
        id: '3',
        title: 'Actualizar documentación',
        description: 'Documentación técnica del equipo',
        priority: 'low',
        status: 'completed',
        dueDate: new Date(2025, 10, 14),
        createdAt: new Date(2025, 10, 8),
        updatedAt: new Date(2025, 10, 14)
      }
    ];
  }
}
