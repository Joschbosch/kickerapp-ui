import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { PlanTournamentRequest } from '../../api/models';
import { errorMessage } from '../../shared/problem';
import { TournamentForm, TournamentFormValue } from './tournament-form';

/** Heute als `JJJJ-MM-TT` in der Zeitzone des Browsers (nicht UTC, sonst ist es abends schon morgen). */
export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Ein neues Turnier planen. Die Vorgaben entsprechen den Standardwerten des Backends. */
@Component({
  selector: 'app-tournament-create-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressBarModule, TournamentForm],
  templateUrl: './tournament-create-page.html',
  styleUrl: './tournament-create-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentCreatePage {
  private readonly api = inject(KickerApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly busy = signal(false);
  protected readonly defaults: TournamentFormValue = {
    name: '',
    date: today(),
    config: {
      tableCount: 1,
      goalLimit: 10,
      matchMinutes: 5,
      randomRounds: 2,
      plannedRounds: null,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
    },
  };

  protected create(request: PlanTournamentRequest): void {
    this.busy.set(true);
    firstValueFrom(this.api.planTournament(request))
      .then((tournament) => this.router.navigate(['/admin/turniere', tournament.id]))
      .catch((error: unknown) =>
        this.snackBar.open(errorMessage(error, 'Das Turnier konnte nicht angelegt werden.'), 'OK', { duration: 8000 }),
      )
      .finally(() => this.busy.set(false));
  }
}
