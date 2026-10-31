import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { ParticipantStatus } from '../../api/models';
import { PARTICIPANT_STATUS_LABEL, TOURNAMENT_STATUS_LABEL } from '../../shared/labels';

@Component({
  selector: 'app-tournament-detail-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, MatTableModule],
  templateUrl: './tournament-detail-page.html',
  styleUrl: './tournament-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentDetailPage {
  private readonly api = inject(KickerApi);

  /** Die ID aus der Adresse (`/turniere/:id`). */
  readonly id = input.required<string>();

  protected readonly tournamentStatus = TOURNAMENT_STATUS_LABEL;
  protected readonly columns = ['rank', 'player', 'points', 'played', 'wins', 'draws', 'losses', 'goals', 'difference'];

  protected readonly data = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) =>
      forkJoin({ tournament: this.api.tournament(id), ranking: this.api.ranking(id) }),
  });

  /** Anzeigetext für den Status eines Spielers (in der Tabelle sind die Zeilen untypisiert, daher als Methode). */
  protected participantStatusLabel(status: ParticipantStatus): string {
    return PARTICIPANT_STATUS_LABEL[status];
  }
}
