import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { TurnAlerts } from '../../core/alerts/turn-alerts';
import { AuthService } from '../../core/auth/auth.service';
import { TurnBanner } from './turn-banner';

/** Rahmen für alle Seiten nach der Anmeldung: Kopfzeile mit Name, Rolle und Abmelden. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, TurnBanner],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly alerts = inject(TurnAlerts);
  private readonly router = inject(Router);

  constructor() {
    // Solange jemand angemeldet ist, sagt die App ihm, wann er an einem Tisch dran ist
    effect(() => (this.auth.me() ? this.alerts.start() : this.alerts.stop()));
    inject(DestroyRef).onDestroy(() => this.alerts.stop());
  }

  protected async logout(): Promise<void> {
    // Mit OIDC-Provider verlässt der Browser die Seite, dann ist hier nichts mehr zu tun
    if (await this.auth.logout()) {
      await this.router.navigate(['/login']);
    }
  }
}
