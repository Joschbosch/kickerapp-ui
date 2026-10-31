import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { Observable, concat, firstValueFrom, forkJoin, toArray } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { ConfigRequest, Match, PlanTournamentRequest, Player, ResultRequest, TournamentConfig } from '../../api/models';
import { liveReload } from '../../core/events/live-reload';
import { TOURNAMENT_STATUS_LABEL } from '../../shared/labels';
import { LiveBadge } from '../../shared/live-badge';
import { errorMessage } from '../../shared/problem';
import { AdminMatchCard } from './admin-match-card';
import { ParticipantAction, ParticipantsPanel } from './participants-panel';
import { TournamentForm, TournamentFormValue } from './tournament-form';

const NEXT_ROUND_BLOCKED = 'Erst möglich, wenn alle Ergebnisse der aktuellen Runde bestätigt sind.';

/**
 * Ein Turnier verwalten: starten, Runden auslosen, beenden, Spieler anmelden und ändern, Ergebnisse festlegen, die
 * Konfiguration anpassen. Was gerade geht, entscheidet das Backend; die Seite sperrt nur, was offensichtlich nicht
 * geht (offene Ergebnisse), und zeigt sonst dessen Meldung.
 */
@Component({
  selector: 'app-admin-tournament-page',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    AdminMatchCard,
    LiveBadge,
    ParticipantsPanel,
    TournamentForm,
  ],
  templateUrl: './admin-tournament-page.html',
  styleUrl: './admin-tournament-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTournamentPage {
  private readonly api = inject(KickerApi);
  private readonly snackBar = inject(MatSnackBar);

  /** Die ID aus der Adresse (`/admin/turniere/:id`). */
  readonly id = input.required<string>();

  protected readonly statusLabel = TOURNAMENT_STATUS_LABEL;
  /** Ein Aufruf läuft, die Schaltflächen sind solange gesperrt. */
  protected readonly busy = signal(false);
  protected readonly confirmingFinish = signal(false);

  protected readonly data = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) =>
      forkJoin({ tournament: this.api.tournament(id), rounds: this.api.rounds(id), players: this.api.players() }),
  });

  /** Live-Updates laden den Stand bei jeder Änderung neu, ohne Verbindung fragt die Seite in Abständen nach. */
  protected readonly live = liveReload({
    id: this.id,
    reload: () => this.data.reload(),
    busy: () => this.data.isLoading(),
    fallbackMs: 30_000,
  });

  /** Name, Datum und Konfiguration für das Formular. */
  protected readonly formValue = computed<TournamentFormValue | null>(() => {
    if (!this.data.hasValue()) {
      return null;
    }
    const { name, date, config } = this.data.value().tournament;
    return { name, date, config };
  });

  /** Die Runden, die neueste zuerst. */
  protected readonly rounds = computed(() => (this.data.hasValue() ? [...this.data.value().rounds].reverse() : []));

  protected readonly disputed = computed(() =>
    this.rounds().reduce((sum, round) => sum + round.matches.filter((match) => match.status === 'DISPUTED').length, 0),
  );

  /** Die nächste Runde und das Beenden gehen erst, wenn die aktuelle Runde komplett bestätigt ist. */
  protected readonly roundOpen = computed(() => {
    const current = this.data.hasValue() ? this.data.value().tournament.currentRound : null;
    return current !== null && !current.complete;
  });
  protected readonly blockedHint = NEXT_ROUND_BLOCKED;

  protected start(): void {
    this.run(this.api.start(this.id()), 'Das Turnier konnte nicht gestartet werden.');
  }

  protected nextRound(): void {
    this.run(this.api.startNextRound(this.id()), 'Die nächste Runde konnte nicht ausgelost werden.');
  }

  protected finish(): void {
    this.confirmingFinish.set(false);
    this.run(this.api.finish(this.id()), 'Das Turnier konnte nicht beendet werden.');
  }

  /** Speichert, was sich geändert hat: Name und Datum, Konfiguration oder beides nacheinander. */
  protected saveSettings(request: PlanTournamentRequest): void {
    if (!this.data.hasValue()) {
      return;
    }
    const { tournament } = this.data.value();
    const calls: Observable<unknown>[] = [];
    if (request.name !== tournament.name || request.date !== tournament.date) {
      calls.push(this.api.updateDetails(this.id(), { name: request.name, date: request.date }));
    }
    if (request.config && !sameConfig(request.config, tournament.config)) {
      calls.push(this.api.updateConfig(this.id(), request.config));
    }
    if (calls.length > 0) {
      this.run(concat(...calls).pipe(toArray()), 'Die Änderungen konnten nicht gespeichert werden.');
    }
  }

  protected register(playerId: string): void {
    this.run(this.api.registerPlayer(this.id(), playerId), 'Der Spieler konnte nicht angemeldet werden.');
  }

  protected actOnParticipant(event: { player: Player; action: ParticipantAction }): void {
    const id = this.id();
    const player = event.player.id;
    switch (event.action) {
      case 'unregister':
        return this.run(this.api.removeParticipant(id, player), 'Die Abmeldung hat nicht geklappt.');
      case 'pause':
        return this.run(this.api.changeParticipantStatus(id, player, 'PAUSED'), 'Das Pausieren hat nicht geklappt.');
      case 'resume':
        return this.run(this.api.changeParticipantStatus(id, player, 'ACTIVE'), 'Das Einsteigen hat nicht geklappt.');
      case 'withdraw':
        return this.run(this.api.changeParticipantStatus(id, player, 'WITHDRAWN'), 'Das Ausscheiden hat nicht geklappt.');
    }
  }

  protected decide(match: Match, result: ResultRequest): void {
    this.run(this.api.decideResult(this.id(), match.id, result), 'Das Ergebnis konnte nicht festgelegt werden.');
  }

  /** Führt einen Aufruf aus, zeigt bei Fehlern die Meldung des Backends und lädt in jedem Fall den Stand neu. */
  private run(call: Observable<unknown>, failure: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    firstValueFrom(call)
      .catch((error: unknown) => this.snackBar.open(errorMessage(error, failure), 'OK', { duration: 8000 }))
      .then(() => this.data.reload())
      .finally(() => this.busy.set(false));
  }
}

function sameConfig(a: ConfigRequest, b: TournamentConfig): boolean {
  return (
    a.tableCount === b.tableCount &&
    a.goalLimit === b.goalLimit &&
    a.matchMinutes === b.matchMinutes &&
    a.randomRounds === b.randomRounds &&
    (a.plannedRounds ?? null) === (b.plannedRounds ?? null) &&
    a.pointsWin === b.pointsWin &&
    a.pointsDraw === b.pointsDraw &&
    a.pointsLoss === b.pointsLoss
  );
}
