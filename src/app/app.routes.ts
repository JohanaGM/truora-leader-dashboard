import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: DashboardLayoutComponent,
    canActivate: [authGuard], // 🔒 Proteger todas las rutas del dashboard
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'schedule',
        loadComponent: () => import('./features/schedule/schedule.component').then(m => m.ScheduleComponent)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./features/tasks/tasks.component').then(m => m.TasksComponent)
      },
      {
        path: 'tip-generator',
        loadComponent: () => import('./features/tip-generator/tip-generator.component').then(m => m.TipGeneratorComponent)
      },
      {
        path: 'automations',
        loadComponent: () => import('./features/automations/automations.component').then(m => m.AutomationsComponent)
      },
      {
        path: 'avisos',
        loadComponent: () => import('./features/announcements/announcements.component').then(m => m.AnnouncementsComponent)
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'metricas',
        loadComponent: () => import('./features/metrics/metrics.component').then(m => m.MetricsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'login' // Redirigir a login por defecto
  }
];
