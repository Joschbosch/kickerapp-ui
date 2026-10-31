import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { ParticipantStatus, RankingEntry, Team, Tournament } from '../../api/models';
import { PARTICIPANT_STATUS_LABEL, TOURNAMENT_STATUS_LABEL } from '../../shared/labels';
import { slotLabel } from '../../shared/slots';

/** So oft fragt die Anzeige das Backend, bis es Live-Updates gibt. */
export const REFRESH_MS = 15_000;

interface Snapshot {
  tournament: Tournament;
  ranking: RankingEntry[];
  at: Date;
}

/**
 * Anzeige für einen weiteren Bildschirm oder Beamer: Rangliste und Tische eines Turniers in großer Schrift, ohne
 * Menü. Der letzte gute Stand bleibt stehen, wenn eine Aktualisierung scheitert.
 */
@Component({
  selector: 'app-display-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './display-page.html',
  styleUrl: './display-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisplayPage {
  private readonly api = inject(KickerApi);

  /** Die ID aus der Adresse (`/anzeige/:id`). */
  readonly id = input.required<string>();

  protected readonly statusLabel = TOURNAMENT_STATUS_LABEL;

  protected readonly data = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => forkJoin({ tournament: this.api.tournament(id), ranking: this.api.ranking(id) }),
  });

  /** Der letzte erfolgreich geladene Stand, auch wenn die nächste Aktualisierung fehlschlägt. */
  protected readonly snapshot = signal<Snapshot | null>(null);

  protected readonly matches = computed(() => this.snapshot()?.tournament.currentRound?.matches ?? []);
  protected readonly onTable = computed(() =>
    this.matches()
      .filter((match) => match.status === 'ON_TABLE')
      .sort((a, b) => (a.table ?? 0) - (b.table ?? 0)),
  );
  protected readonly queued = computed(() => this.matches().filter((match) => match.status === 'QUEUED'));
  protected readonly played = computed(() => this.matches().filter((match) => match.status === 'CONFIRMED').length);

  constructor() {
    effect(() => {
      if (this.data.hasValue()) {
        const value = this.data.value();
        untracked(() => this.snapshot.set({ ...value, at: new Date() }));
      }
    });

    const timer = setInterval(() => {
      if (!this.data.isLoading()) {
        this.data.reload();
      }
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected team(team: Team): string[] {
    return team.members.map((slot) => slotLabel(slot, null));
  }

  protected participantStatusLabel(status: ParticipantStatus): string {
    return PARTICIPANT_STATUS_LABEL[status];
  }
}
