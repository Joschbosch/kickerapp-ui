import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Observable, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { Match, ParticipantStatus, ResultRequest } from '../../api/models';
import { AuthService } from '../../core/auth/auth.service';
import { liveReload } from '../../core/events/live-reload';
import { PARTICIPANT_STATUS_LABEL, TOURNAMENT_STATUS_LABEL } from '../../shared/labels';
import { LiveBadge } from '../../shared/live-badge';
import { errorMessage } from '../../shared/problem';
import { MatchCard } from './match-card';
import { RegistrationAction, RegistrationCard } from './registration-card';

/**
 * Ein Turnier aus Sicht des Spielers: Anmeldung, das eigene Spiel (mit Ergebnis eintragen und bestätigen) und die
 * Rangliste. Was der Spieler darf, kommt vom Backend (`permissions` an den Matches).
 */
@Component({
  selector: 'app-tournament-detail-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    LiveBadge,
    MatchCard,
    RegistrationCard,
  ],
  templateUrl: './tournament-detail-page.html',
  styleUrl: './tournament-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentDetailPage {
  private readonly api = inject(KickerApi);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  /** Die ID aus der Adresse (`/turniere/:id`). */
  readonly id = input.required<string>();

  protected readonly tournamentStatus = TOURNAMENT_STATUS_LABEL;
  protected readonly columns = ['rank', 'player', 'points', 'played', 'wins', 'draws', 'losses', 'goals', 'difference'];
  protected readonly playerId = computed(() => this.auth.me()?.id ?? '');
  protected readonly isAdmin = this.auth.isAdmin;
  /** Ein Aufruf (Anmelden, Ergebnis, ...) läuft, die Schaltflächen sind solange gesperrt. */
  protected readonly busy = signal(false);

  protected readonly data = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.load(id),
  });

  /** Live-Updates laden den Stand bei jeder Änderung neu, ohne Verbindung fragt die Seite in Abständen nach. */
  protected readonly live = liveReload({
    id: this.id,
    reload: () => this.data.reload(),
    busy: () => this.data.isLoading(),
    fallbackMs: 30_000,
  });

  /** Der Eintrag des Spielers in der Teilnehmerliste, `undefined` wenn er nicht angemeldet ist. */
  protected readonly participant = computed(() =>
    this.data.hasValue()
      ? this.data.value().tournament.participants.find((entry) => entry.player.id === this.playerId())
      : undefined,
  );

  /** Die eigenen Spiele der neuesten Runde und die davor, jeweils nach Auslosung sortiert. */
  protected readonly matches = computed(() => {
    const all = this.data.hasValue() ? [...this.data.value().matches] : [];
    const latest = Math.max(0, ...all.map((match) => match.round));
    const ordered = all.sort((a, b) => b.round - a.round || a.position - b.position);
    return {
      latestRound: latest,
      current: ordered.filter((match) => match.round === latest),
      earlier: ordered.filter((match) => match.round !== latest),
    };
  });

  /** Anzeigetext für den Status eines Spielers (in der Tabelle sind die Zeilen untypisiert, daher als Methode). */
  protected participantStatusLabel(status: ParticipantStatus): string {
    return PARTICIPANT_STATUS_LABEL[status];
  }

  protected isMe(entry: { player: { id: string } }): boolean {
    return entry.player.id === this.playerId();
  }

  protected onRegistration(action: RegistrationAction): void {
    const id = this.id();
    switch (action) {
      case 'register':
        return this.run(this.api.register(id), 'Die Anmeldung hat nicht geklappt.');
      case 'unregister':
        return this.run(this.api.unregister(id), 'Die Abmeldung hat nicht geklappt.');
      case 'pause':
        return this.run(this.api.changeMyStatus(id, 'PAUSED'), 'Das Pausieren hat nicht geklappt.');
      case 'resume':
        return this.run(this.api.changeMyStatus(id, 'ACTIVE'), 'Das Einsteigen hat nicht geklappt.');
      case 'withdraw':
        return this.run(this.api.changeMyStatus(id, 'WITHDRAWN'), 'Das Ausscheiden hat nicht geklappt.');
    }
  }

  protected submitResult(match: Match, result: ResultRequest): void {
    this.run(this.api.submitResult(this.id(), match.id, result), 'Das Ergebnis konnte nicht eingetragen werden.');
  }

  protected confirmResult(match: Match): void {
    this.run(this.api.confirmResult(this.id(), match.id), 'Das Ergebnis konnte nicht bestätigt werden.');
  }

  protected rejectResult(match: Match): void {
    this.run(this.api.rejectResult(this.id(), match.id), 'Das Ergebnis konnte nicht abgelehnt werden.');
  }

  /** Turnier und Rangliste, dazu die eigenen Spiele, sobald der Spieler angemeldet ist. */
  private load(id: string) {
    return forkJoin({ tournament: this.api.tournament(id), ranking: this.api.ranking(id) }).pipe(
      switchMap((base) => {
        const registered = base.tournament.participants.some((entry) => entry.player.id === this.playerId());
        return (registered ? this.api.myMatches(id) : of([] as Match[])).pipe(
          map((matches) => ({ ...base, matches })),
        );
      }),
    );
  }

  /** Führt einen Aufruf aus, zeigt bei Fehlern die Meldung des Backends und lädt danach den Stand neu. */
  private run(call: Observable<unknown>, failure: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    firstValueFrom(call)
      .then(() => this.data.reload())
      .catch((error: unknown) => this.snackBar.open(errorMessage(error, failure), 'OK', { duration: 8000 }))
      .finally(() => this.busy.set(false));
  }
}
