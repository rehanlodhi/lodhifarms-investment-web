import { Routes } from '@angular/router';
import { authGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard) },
      { path: 'requests', loadComponent: () => import('./pages/requests').then((m) => m.Requests) },
      { path: 'investors', loadComponent: () => import('./pages/investors').then((m) => m.Investors) },
      { path: 'types', loadComponent: () => import('./pages/types').then((m) => m.Types) },
      { path: 'investments', loadComponent: () => import('./pages/investments').then((m) => m.Investments) },
    ],
  },
  { path: '**', redirectTo: '' },
];
