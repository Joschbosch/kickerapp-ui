import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { TurnCall, callLine } from '../../core/alerts/alert-effects';
import { TurnAlerts } from '../../core/alerts/turn-alerts';

/**
 * Hinweis „Du bist dran“ mit Tisch, Partner und Gegnern. Er steht über allen Seiten, bis der Spieler ihn wegklickt oder
 * sein Match nicht mehr am Tisch ist (Ergebnis eingetragen).
 */
@Component({
  selector: 'app-turn-banner',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    @for (call of alerts.calls(); track call.matchId) {
      <section class="call" role="alert" aria-live="assertive">
        <mat-icon aria-hidden="true">notifications_active</mat-icon>
        <div class="text">
          <strong>Du bist dran – Tisch {{ call.table }}</strong>
          <span>{{ line(call) }}</span>
          <span class="where">{{ call.tournamentName }} · Runde {{ call.round }}</span>
        </div>
        <span class="actions">
          @if (!isOpen(call)) {
            <a mat-flat-button [routerLink]="['/turniere', call.tournamentId]">Zum Spiel</a>
          }
          <button mat-button type="button" (click)="alerts.dismiss(call.matchId)">Verstanden</button>
        </span>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .call {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      padding: 12px 16px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .text {
      display: flex;
      flex-direction: column;
      flex: 1 1 220px;
    }

    strong {
      font: var(--mat-sys-title-medium);
    }

    .where {
      font: var(--mat-sys-label-medium);
      opacity: 0.8;
    }

    .actions {
      display: inline-flex;
      gap: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TurnBanner {
  protected readonly alerts = inject(TurnAlerts);
  protected readonly line = callLine;

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Der Spieler schaut schon auf die Seite dieses Turniers, ein Link dorthin wäre überflüssig. */
  protected isOpen(call: TurnCall): boolean {
    return this.url().split(/[?#]/)[0] === `/turniere/${call.tournamentId}`;
  }
}
