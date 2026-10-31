import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';

import { AuthService, LoginError } from '../../core/auth/auth.service';
import { clearAutoLogin, safeTarget } from '../../core/auth/safe-target';

/**
 * Hierhin kehrt der Browser vom OIDC-Provider zurück (`/auth/callback`). Die Seite tauscht den Code gegen die Tokens
 * und geht zur ursprünglich gewünschten Seite weiter.
 */
@Component({
  selector: 'app-callback-page',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  template: `
    <main class="callback">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-icon mat-card-avatar aria-hidden="true">sports_soccer</mat-icon>
          <mat-card-title>Kickertool</mat-card-title>
          <mat-card-subtitle>{{ error() ? 'Anmeldung fehlgeschlagen' : 'Du wirst angemeldet …' }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (error(); as message) {
            <p class="error" role="alert">{{ message }}</p>
            <a mat-flat-button routerLink="/login">Noch einmal anmelden</a>
          } @else {
            <mat-progress-bar mode="indeterminate" aria-label="Anmeldung läuft" />
          }
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .callback {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 16px;
      box-sizing: border-box;
    }

    mat-card {
      width: min(100%, 380px);
    }

    mat-card-content {
      padding-top: 16px;
    }

    .error {
      margin: 0 0 16px;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-medium);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallbackPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const target = await this.auth.completeLogin();
      clearAutoLogin();
      // `replaceUrl`: Die Rückkehradresse mit dem Code soll nicht in den Verlauf (Zurück-Taste)
      await this.router.navigateByUrl(safeTarget(target), { replaceUrl: true });
    } catch (error) {
      this.error.set(error instanceof LoginError ? error.message : 'Die Anmeldung ist fehlgeschlagen.');
    }
  }
}
