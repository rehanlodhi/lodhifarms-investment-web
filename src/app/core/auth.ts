import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';

const KEY = 'token';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly token = signal<string | null>(localStorage.getItem(KEY));

  login(username: string, password: string) {
    const body = new URLSearchParams({ username, password });
    return this.http
      .post<{ access_token: string }>('/api/auth/login', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .pipe(tap((r) => { localStorage.setItem(KEY, r.access_token); this.token.set(r.access_token); }));
  }

  logout() {
    localStorage.removeItem(KEY);
    this.token.set(null);
    this.router.navigate(['/login']);
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const token = auth.token();
  const authed = token && req.url.startsWith('/api') && !req.url.endsWith('/auth/login');
  return next(authed ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req).pipe(
    catchError((e) => {
      if (authed && e.status === 401) auth.logout();
      return throwError(() => e);
    }),
  );
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.token() ? true : inject(Router).createUrlTree(['/login']);
};
