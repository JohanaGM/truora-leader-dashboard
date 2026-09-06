import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = await authService.isAuthenticated();

  if (!isAuthenticated) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.isTwoFactorPending() || !authService.isTwoFactorVerified()) {
    router.navigate(['/verify-2fa'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  return true;
};

export const twoFactorGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!(await authService.isAuthenticated())) {
    router.navigate(['/login']);
    return false;
  }
  if (authService.isTwoFactorVerified()) {
    router.navigate(['/dashboard']);
    return false;
  }
  return true;
};
