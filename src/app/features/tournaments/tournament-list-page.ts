import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { KickerApi } from '../../api/kicker-api';
import { TOURNAMENT_STATUS_LABEL } from '../../shared/labels';

@Component({
  selector: 'app-tournament-list-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  templateUrl: './tournament-list-page.html',
  styleUrl: './tournament-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentListPage {
  private readonly api = inject(KickerApi);

  protected readonly statusLabel = TOURNAMENT_STATUS_LABEL;
  protected readonly tournaments = rxResource({ stream: () => this.api.tournaments() });
}
