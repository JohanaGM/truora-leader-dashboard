import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../core/services';
import { Task } from '../../core/models';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss'
})
export class TasksComponent {
  private taskService = inject(TaskService);
  
  tasks = this.taskService.tasks;
  showSidePanel = signal(false);
  editingTask = signal<Task | null>(null);
  filterStatus = signal<Task['status'] | 'all'>('all');
  filterPriority = signal<Task['priority'] | 'all'>('all');
  
  formData = signal<{
    title: string;
    description: string;
    priority: Task['priority'];
    status: Task['status'];
    dueDate: string;
  }>({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    dueDate: new Date().toISOString().split('T')[0]
  });

  filteredTasks = computed(() => {
    let filtered = this.tasks();
    
    const status = this.filterStatus();
    if (status !== 'all') {
      filtered = filtered.filter(t => t.status === status);
    }
    
    const priority = this.filterPriority();
    if (priority !== 'all') {
      filtered = filtered.filter(t => t.priority === priority);
    }
    
    return filtered;
  });

  pendingTasks = computed(() => 
    this.tasks().filter(t => t.status === 'pending').length
  );

  inProgressTasks = computed(() => 
    this.tasks().filter(t => t.status === 'in-progress').length
  );

  completedTasks = computed(() => 
    this.tasks().filter(t => t.status === 'completed').length
  );

  openSidePanel(task?: Task) {
    if (task) {
      this.editingTask.set(task);
      this.formData.set({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: new Date(task.dueDate).toISOString().split('T')[0]
      });
    } else {
      this.editingTask.set(null);
      this.formData.set({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date().toISOString().split('T')[0]
      });
    }
    this.showSidePanel.set(true);
  }

  closeSidePanel() {
    this.showSidePanel.set(false);
    this.editingTask.set(null);
  }

  saveTask() {
    const data = this.formData();
    const editing = this.editingTask();

    if (editing) {
      this.taskService.updateTask(editing.id, {
        ...data,
        dueDate: new Date(data.dueDate)
      });
    } else {
      this.taskService.addTask({
        ...data,
        dueDate: new Date(data.dueDate)
      });
    }

    this.closeSidePanel();
  }

  deleteTask(id: string) {
    if (confirm('¿Estás seguro de eliminar esta tarea?')) {
      this.taskService.deleteTask(id);
    }
  }

  updateStatus(id: string, status: Task['status']) {
    this.taskService.updateTask(id, { status });
  }

  getPriorityLabel(priority: Task['priority']): string {
    const labels = {
      'low': 'Baja',
      'medium': 'Media',
      'high': 'Alta'
    };
    return labels[priority];
  }

  getStatusLabel(status: Task['status']): string {
    const labels = {
      'pending': 'Pendiente',
      'in-progress': 'En Progreso',
      'completed': 'Completada'
    };
    return labels[status];
  }

  getPriorityClass(priority: Task['priority']): string {
    return `priority-${priority}`;
  }

  // Helper methods para actualizar formData
  updateTitle(title: string) {
    this.formData.set({ ...this.formData(), title });
  }

  updateDescription(description: string) {
    this.formData.set({ ...this.formData(), description });
  }

  updatePriority(priority: Task['priority']) {
    this.formData.set({ ...this.formData(), priority });
  }

  updateDueDate(dueDate: string) {
    this.formData.set({ ...this.formData(), dueDate });
  }

  updateFormStatus(status: Task['status']) {
    this.formData.set({ ...this.formData(), status });
  }
}
