import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Participant, Player, TournamentStatus } from '../../api/models';
import { PARTICIPANT_STATUS_LABEL } from '../../shared/labels';

export type ParticipantAction = 'unregister' | 'pause' | 'resume' | 'withdraw';

/**
 * Die Teilnehmer eines Turniers für den Admin: andere Spieler anmelden und jeden abmelden, pausieren, wieder
 * einsteigen lassen oder ausscheiden lassen. Welche Aktionen es gibt, hängt wie bei den Spielern selbst nur vom
 * Teilnahme- und Turnierstatus ab. Das Ausscheiden ist endgültig und wird nachgefragt.
 */
@Component({
  selector: 'app-participants-panel',
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './participants-panel.html',
  styleUrl: './participants-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticipantsPanel {
  readonly tournamentStatus = input.required<TournamentStatus>();
  readonly participants = input.required<Participant[]>();
  /** Alle bekannten Spieler, daraus lassen sich weitere anmelden. */
  readonly players = input<Player[]>([]);
  readonly busy = input(false);

  readonly register = output<string>();
  readonly act = output<{ player: Player; action: ParticipantAction }>();

  protected readonly statusLabel = PARTICIPANT_STATUS_LABEL;
  protected readonly selected = signal('');
  protected readonly confirmingWithdraw = signal<string | null>(null);

  /** Bekannte Spieler, die noch nicht im Turnier sind, nach Namen sortiert. */
  protected readonly candidates = computed(() => {
    const registered = new Set(this.participants().map((entry) => entry.player.id));
    return this.players()
      .filter((player) => !registered.has(player.id))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
  });

  protected readonly sorted = computed(() =>
    [...this.participants()].sort((a, b) => a.player.displayName.localeCompare(b.player.displayName, 'de')),
  );

  protected add(): void {
    const id = this.selected();
    if (id !== '') {
      this.selected.set('');
      this.register.emit(id);
    }
  }

  protected emit(player: Player, action: ParticipantAction): void {
    this.confirmingWithdraw.set(null);
    this.act.emit({ player, action });
  }
}
