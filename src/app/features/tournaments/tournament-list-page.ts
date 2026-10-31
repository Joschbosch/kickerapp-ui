import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { TournamentSummary } from '../../api/models';
import { AuthService } from '../../core/auth/auth.service';
import { TOURNAMENT_STATUS_LABEL } from '../../shared/labels';

/** So oft lädt sich die Liste von selbst neu: Für die Liste gibt es keine Live-Updates, nur für ein einzelnes Turnier. */
export const LIST_REFRESH_MS = 30_000;
/** Für so viele Turniere (die neuesten) wird nachgesehen, ob der Spieler angemeldet ist. */
export const REGISTRATION_LOOKUPS = 20;

@Component({
  selector: 'app-tournament-list-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  templateUrl: './tournament-list-page.html',
  styleUrl: './tournament-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentListPage {
  private readonly api = inject(KickerApi);
  private readonly auth = inject(AuthService);

  protected readonly isAdmin = this.auth.isAdmin;
  protected readonly statusLabel = TOURNAMENT_STATUS_LABEL;
  protected readonly tournaments = rxResource({ stream: () => this.api.tournaments() });

  /**
   * In welchen Turnieren der Spieler angemeldet ist. Die Liste sagt das nicht, deshalb wird jedes Turnier einzeln
   * nachgesehen. Schlägt das fehl, fehlt nur die Markierung.
   */
  private readonly registration = rxResource({
    params: () => (this.tournaments.hasValue() ? this.tournaments.value() : undefined),
    stream: ({ params }) => this.lookUpRegistrations(params),
  });
  protected readonly registered = computed(() => (this.registration.hasValue() ? this.registration.value() : new Set<string>()));

  constructor() {
    const timer = setInterval(() => {
      if (!this.tournaments.isLoading()) {
        this.tournaments.reload();
      }
    }, LIST_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private lookUpRegistrations(list: TournamentSummary[]) {
    const me = this.auth.me()?.id;
    if (me === undefined || list.length === 0) {
      return of(new Set<string>());
    }
    return forkJoin(
      list.slice(0, REGISTRATION_LOOKUPS).map((entry) =>
        this.api.tournament(entry.id).pipe(
          map((tournament) => (tournament.participants.some((participant) => participant.player.id === me) ? entry.id : null)),
          catchError(() => of(null)),
        ),
      ),
    ).pipe(map((ids) => new Set(ids.filter((id): id is string => id !== null))));
  }
}
