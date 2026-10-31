import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Anmelden – Kickertool',
    loadComponent: () => import('./features/login/login-page').then((m) => m.LoginPage),
  },
  {
    // Ohne Menü für weitere Bildschirme, gehört deshalb nicht zum Rahmen
    path: 'anzeige/:id',
    title: 'Anzeige – Kickertool',
    canActivate: [authGuard],
    loadComponent: () => import('./features/display/display-page').then((m) => m.DisplayPage),
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
      {
        path: 'admin',
        canActivate: [adminGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: '/turniere' },
          {
            path: 'turniere/neu',
            title: 'Neues Turnier – Kickertool',
            loadComponent: () =>
              import('./features/admin/tournament-create-page').then((m) => m.TournamentCreatePage),
          },
          {
            path: 'turniere/:id',
            title: 'Turnier verwalten – Kickertool',
            loadComponent: () =>
              import('./features/admin/admin-tournament-page').then((m) => m.AdminTournamentPage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
