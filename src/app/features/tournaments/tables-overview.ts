import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Match, Team } from '../../api/models';
import { slotLabel } from '../../shared/slots';

/**
 * Wer gerade an welchem Tisch spielt und wer als Nächstes drankommt, kompakt für das Handy. Die eigenen Spiele sind
 * hervorgehoben. Die Daten kommen aus der aktuellen Runde des Turniers, die große Anzeige steht hinter dem Link.
 */
@Component({
  selector: 'app-tables-overview',
  imports: [RouterLink],
  templateUrl: './tables-overview.html',
  styleUrl: './tables-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesOverview {
  readonly tournamentId = input.required<string>();
  /** Die Matches der aktuellen Runde. */
  readonly matches = input.required<Match[]>();
  readonly playerId = input.required<string>();

  protected readonly onTable = computed(() =>
    this.matches()
      .filter((match) => match.status === 'ON_TABLE')
      .sort((a, b) => (a.table ?? 0) - (b.table ?? 0)),
  );
  protected readonly queued = computed(() =>
    this.matches()
      .filter((match) => match.status === 'QUEUED')
      .sort((a, b) => a.position - b.position),
  );
  protected readonly played = computed(() => this.matches().filter((match) => match.status === 'CONFIRMED').length);

  protected team(team: Team): string {
    return team.members.map((slot) => slotLabel(slot, this.playerId())).join(' & ');
  }
}
