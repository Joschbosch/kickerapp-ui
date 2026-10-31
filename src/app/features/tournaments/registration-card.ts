import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { Participant, TournamentStatus } from '../../api/models';

export type RegistrationAction = 'register' | 'unregister' | 'pause' | 'resume' | 'withdraw';

/**
 * Anmeldung des Spielers zum Turnier. Welche Schaltflächen es gibt, hängt nur von seinem Status und dem Turnierstatus
 * ab (siehe Übergabe, Abschnitt 5). Das Ausscheiden ist endgültig und wird deshalb nachgefragt.
 */
@Component({
  selector: 'app-registration-card',
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './registration-card.html',
  styleUrl: './registration-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationCard {
  readonly tournamentStatus = input.required<TournamentStatus>();
  /** Der Eintrag des Spielers in der Teilnehmerliste, `undefined` wenn er nicht angemeldet ist. */
  readonly participant = input<Participant | undefined>();
  readonly busy = input(false);

  readonly action = output<RegistrationAction>();

  protected readonly confirmingWithdraw = signal(false);

  protected emit(action: RegistrationAction): void {
    this.confirmingWithdraw.set(false);
    this.action.emit(action);
  }
}
