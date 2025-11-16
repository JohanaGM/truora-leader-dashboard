import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  private authService = inject(AuthService);
  
  currentUser = this.authService.currentUser;

  menuItems = [
    {
      icon: '📊',
      label: 'Dashboard',
      route: '/dashboard',
      active: true
    },
    {
      icon: '📅',
      label: 'Cronograma',
      route: '/schedule',
      active: false
    },
    {
      icon: '✅',
      label: 'Tareas',
      route: '/tasks',
      active: false
    },
    {
      icon: '💡',
      label: 'Generar Tips',
      route: '/tip-generator',
      active: false
    }
  ];
}
