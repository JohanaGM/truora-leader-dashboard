import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityService } from '../../core/services';
import { Activity } from '../../core/models';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss'
})
export class ScheduleComponent {
  private activityService = inject(ActivityService);
  
  activities = this.activityService.activities;
  showModal = signal(false);
  editingActivity = signal<Activity | null>(null);
  
  formData = signal<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    status: Activity['status'];
    description: string;
    color: string;
  }>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    status: 'pending',
    description: '',
    color: '#FF6B9D'
  });

  colors = ['#FF6B9D', '#4ECDC4', '#FFD93D', '#95E1D3', '#667eea', '#764ba2'];

  get todayActivities() {
    const today = new Date().toDateString();
    return this.activities().filter(a => 
      new Date(a.date).toDateString() === today
    );
  }

  get upcomingActivities() {
    const today = new Date();
    return this.activities().filter(a => 
      new Date(a.date) > today
    ).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  openModal(activity?: Activity) {
    if (activity) {
      this.editingActivity.set(activity);
      this.formData.set({
        title: activity.title,
        date: new Date(activity.date).toISOString().split('T')[0],
        startTime: activity.startTime,
        endTime: activity.endTime,
        status: activity.status,
        description: activity.description || '',
        color: activity.color || '#FF6B9D'
      });
    } else {
      this.editingActivity.set(null);
      this.formData.set({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        status: 'pending',
        description: '',
        color: '#FF6B9D'
      });
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingActivity.set(null);
  }

  saveActivity() {
    const data = this.formData();
    const editing = this.editingActivity();

    if (editing) {
      this.activityService.updateActivity(editing.id, {
        ...data,
        date: new Date(data.date)
      });
    } else {
      this.activityService.addActivity({
        ...data,
        date: new Date(data.date)
      });
    }

    this.closeModal();
  }

  deleteActivity(id: string) {
    if (confirm('¿Estás seguro de eliminar esta actividad?')) {
      this.activityService.deleteActivity(id);
    }
  }

  updateStatus(id: string, status: Activity['status']) {
    this.activityService.updateActivity(id, { status });
  }

  getStatusLabel(status: Activity['status']): string {
    const labels = {
      'pending': 'Pendiente',
      'in-progress': 'En Progreso',
      'completed': 'Completada',
      'cancelled': 'Cancelada'
    };
    return labels[status];
  }

  // Helper methods para actualizar formData
  updateFormTitle(title: string) {
    this.formData.set({ ...this.formData(), title });
  }

  updateFormDate(date: string) {
    this.formData.set({ ...this.formData(), date });
  }

  updateFormStartTime(startTime: string) {
    this.formData.set({ ...this.formData(), startTime });
  }

  updateFormEndTime(endTime: string) {
    this.formData.set({ ...this.formData(), endTime });
  }

  updateFormDescription(description: string) {
    this.formData.set({ ...this.formData(), description });
  }

  updateFormColor(color: string) {
    this.formData.set({ ...this.formData(), color });
  }

  updateFormActivityStatus(status: Activity['status']) {
    this.formData.set({ ...this.formData(), status });
  }
}
