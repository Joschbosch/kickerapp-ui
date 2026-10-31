import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Match, ResultRequest, Team } from '../../api/models';
import { MATCH_STATUS_LABEL } from '../../shared/labels';
import { slotLabel } from '../../shared/slots';

/**
 * Ein Match aus Sicht des angemeldeten Spielers: das eigene Team steht links, dazu kommt, was er jetzt tun darf
 * (`permissions` vom Backend). Die Karte ruft nichts selbst auf, sie meldet nur, was der Spieler wünscht.
 */
@Component({
  selector: 'app-match-card',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './match-card.html',
  styleUrl: './match-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchCard {
  private readonly formBuilder = inject(FormBuilder);

  readonly match = input.required<Match>();
  /** ID des angemeldeten Spielers, um ihn in den Teams zu markieren. */
  readonly playerId = input.required<string>();
  /** Solange ein Aufruf läuft, sind die Schaltflächen gesperrt. */
  readonly busy = input(false);

  readonly submitResult = output<ResultRequest>();
  readonly confirm = output<void>();
  readonly reject = output<void>();

  protected readonly statusLabel = MATCH_STATUS_LABEL;
  protected readonly entering = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    mine: [0, [Validators.required, Validators.min(0)]],
    opponent: [0, [Validators.required, Validators.min(0)]],
  });

  /** Das Team des Spielers steht immer links. Ohne Seite (z. B. Admin) bleibt es bei A gegen B. */
  private readonly swapped = computed(() => this.match().mySide === 'B');
  protected readonly myTeam = computed(() => this.names(this.swapped() ? this.match().teamB : this.match().teamA));
  protected readonly opponentTeam = computed(() => this.names(this.swapped() ? this.match().teamA : this.match().teamB));

  protected readonly score = computed(() => {
    const result = this.match().result;
    if (result === null) {
      return null;
    }
    return this.swapped()
      ? { mine: result.goalsB, opponent: result.goalsA, confirmed: result.confirmed }
      : { mine: result.goalsA, opponent: result.goalsB, confirmed: result.confirmed };
  });

  protected readonly enteredBy = computed(() => this.match().result?.enteredBy?.displayName ?? null);

  constructor() {
    // Ändert sich der Stand des Matches (Ergebnis eingetragen, bestätigt, ...), wird das Formular geschlossen.
    // Bei einem Fehler bleibt der Stand gleich und die Eingabe offen.
    const state = computed(() => {
      const { status, result } = this.match();
      return `${status}|${result?.goalsA}|${result?.goalsB}|${result?.confirmed}`;
    });
    effect(() => {
      state();
      untracked(() => this.entering.set(false));
    });
  }

  protected openForm(): void {
    this.form.reset({ mine: 0, opponent: 0 });
    this.entering.set(true);
  }

  protected send(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { mine, opponent } = this.form.getRawValue();
    this.submitResult.emit(this.swapped() ? { goalsA: opponent, goalsB: mine } : { goalsA: mine, goalsB: opponent });
  }

  private names(team: Team): string[] {
    return team.members.map((slot) => slotLabel(slot, this.playerId()));
  }
}
