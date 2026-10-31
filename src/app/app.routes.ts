import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Anmelden – Kickertool',
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'turniere' },
      {
        path: 'turniere',
        title: 'Turniere – Kickertool',
        loadComponent: () =>
          import('./features/tournaments/tournament-list-page').then((m) => m.TournamentListPage),
      },
      {
        path: 'turniere/:id',
        title: 'Turnier – Kickertool',
        loadComponent: () =>
          import('./features/tournaments/tournament-detail-page').then((m) => m.TournamentDetailPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
