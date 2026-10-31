import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Match, ResultRequest, Team } from '../../api/models';
import { MATCH_STATUS_LABEL } from '../../shared/labels';
import { slotLabel } from '../../shared/slots';

/**
 * Ein Match aus Sicht des Admins: Team A gegen Team B, Tisch und Stand. Das Ergebnis lässt sich festlegen, wenn das
 * Backend es erlaubt (`permissions.canDecide`), auch nachträglich als Korrektur. Die Karte ruft nichts selbst auf.
 */
@Component({
  selector: 'app-admin-match-card',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './admin-match-card.html',
  styleUrl: './admin-match-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMatchCard {
  private readonly formBuilder = inject(FormBuilder);

  readonly match = input.required<Match>();
  readonly busy = input(false);

  readonly decide = output<ResultRequest>();

  protected readonly statusLabel = MATCH_STATUS_LABEL;
  protected readonly editing = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    goalsA: [0, [Validators.required, Validators.min(0)]],
    goalsB: [0, [Validators.required, Validators.min(0)]],
  });

  protected readonly teamA = computed(() => this.names(this.match().teamA));
  protected readonly teamB = computed(() => this.names(this.match().teamB));
  protected readonly enteredBy = computed(() => this.match().result?.enteredBy?.displayName ?? null);

  constructor() {
    // Ändert sich der Stand des Matches, wird das Formular geschlossen. Bei einem Fehler bleibt der Stand gleich.
    const state = computed(() => {
      const { status, result } = this.match();
      return `${status}|${result?.goalsA}|${result?.goalsB}|${result?.confirmed}`;
    });
    effect(() => {
      state();
      untracked(() => this.editing.set(false));
    });
  }

  protected open(): void {
    const result = this.match().result;
    this.form.reset({ goalsA: result?.goalsA ?? 0, goalsB: result?.goalsB ?? 0 });
    this.editing.set(true);
  }

  protected send(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }
    this.decide.emit(this.form.getRawValue());
  }

  private names(team: Team): string[] {
    return team.members.map((slot) => slotLabel(slot, null));
  }
}
