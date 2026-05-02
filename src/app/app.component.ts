import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styles: []
})
export class AppComponent {
  title = 'truora-leader-dashboard';

  constructor() {
    // Apply persisted theme on every app load
    const saved = localStorage.getItem('app_theme');
    if (saved === 'dark') document.body.classList.add('dark-theme');
  }
}
