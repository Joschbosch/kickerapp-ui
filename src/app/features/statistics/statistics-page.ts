import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { KickerApi } from '../../api/kicker-api';
import { AuthService } from '../../core/auth/auth.service';
import { PARTICIPANT_STATUS_LABEL, TOURNAMENT_STATUS_LABEL } from '../../shared/labels';

/**
 * Die Statistik eines Spielers über alle Turniere: Summen und der Stand in jedem Turnier. Jeder darf die Statistik
 * jedes Spielers sehen. Ohne Angabe in der Adresse (`/statistik`) ist es die eigene.
 */
@Component({
  selector: 'app-statistics-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './statistics-page.html',
  styleUrl: './statistics-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsPage {
  private readonly api = inject(KickerApi);
  private readonly auth = inject(AuthService);

  /** Die Spieler-ID aus der Adresse (`/statistik/:id`), ohne Angabe die eigene. */
  readonly id = input<string | undefined>(undefined);

  protected readonly tournamentStatus = TOURNAMENT_STATUS_LABEL;
  protected readonly participantStatus = PARTICIPANT_STATUS_LABEL;

  protected readonly data = rxResource({
    params: () => this.id() ?? 'me',
    stream: ({ params }) => this.api.statistics(params),
  });

  protected readonly isOwn = computed(
    () => !this.data.hasValue() || this.data.value().player.id === this.auth.me()?.id,
  );

  /** Vorzeichen für die Tordifferenz: „+3“, „0“, „-2“. */
  protected signed(value: number): string {
    return value > 0 ? `+${value}` : `${value}`;
  }
}
