import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { PlanTournamentRequest, TournamentConfig } from '../../api/models';

/** Name, Datum und Konfiguration eines Turniers, so wie das Formular sie anzeigt. */
export interface TournamentFormValue {
  name: string;
  date: string;
  config: TournamentConfig;
}

type NumberField = 'tableCount' | 'goalLimit' | 'matchMinutes' | 'randomRounds' | 'plannedRounds' | 'pointsWin' | 'pointsDraw' | 'pointsLoss';

interface NumberFieldSpec {
  name: NumberField;
  label: string;
  min: number;
  hint?: string;
  optional?: boolean;
}

const RULE_FIELDS: NumberFieldSpec[] = [
  { name: 'tableCount', label: 'Anzahl Tische', min: 1, hint: 'Eine neue Zahl gilt ab der nächsten Welle.' },
  { name: 'goalLimit', label: 'Tore pro Match', min: 1, hint: 'Ein Match endet bei dieser Torzahl.' },
  { name: 'matchMinutes', label: 'Spielzeit in Minuten', min: 1 },
  { name: 'randomRounds', label: 'Zufallsrunden am Anfang', min: 0, hint: 'Danach wird nach der Rangliste ausgelost.' },
  { name: 'plannedRounds', label: 'Geplante Runden', min: 1, optional: true, hint: 'Nur zur Anzeige, leer = offen.' },
];

const POINT_FIELDS: NumberFieldSpec[] = [
  { name: 'pointsWin', label: 'Punkte für einen Sieg', min: 0 },
  { name: 'pointsDraw', label: 'Punkte für ein Unentschieden', min: 0 },
  { name: 'pointsLoss', label: 'Punkte für eine Niederlage', min: 0 },
];

function integer(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  return value === null || value === '' || Number.isInteger(value) ? null : { integer: true };
}

/**
 * Formular für Name, Datum und Konfiguration, zum Anlegen und zum Ändern eines Turniers. Die Seite entscheidet, welche
 * Aufrufe daraus werden. Gültig ist, was das Backend sowieso verlangt (Pflichtfelder, Mindestwerte, ganze Zahlen),
 * alles andere prüft das Backend.
 */
@Component({
  selector: 'app-tournament-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './tournament-form.html',
  styleUrl: './tournament-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TournamentForm {
  private readonly builder = inject(NonNullableFormBuilder);

  /** Ausgangswerte. Ändern sie sich (z. B. nach dem Speichern), setzt das Formular sich darauf zurück. */
  readonly value = input.required<TournamentFormValue>();
  readonly submitLabel = input('Speichern');
  readonly busy = input(false);
  /** Speichern erst, wenn etwas geändert wurde. */
  readonly requireChange = input(false);

  readonly submitted = output<PlanTournamentRequest>();

  protected readonly ruleFields = RULE_FIELDS;
  protected readonly pointFields = POINT_FIELDS;

  protected readonly form = this.builder.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    date: ['', Validators.required],
    tableCount: this.numberControl(RULE_FIELDS[0]),
    goalLimit: this.numberControl(RULE_FIELDS[1]),
    matchMinutes: this.numberControl(RULE_FIELDS[2]),
    randomRounds: this.numberControl(RULE_FIELDS[3]),
    plannedRounds: this.numberControl(RULE_FIELDS[4]),
    pointsWin: this.numberControl(POINT_FIELDS[0]),
    pointsDraw: this.numberControl(POINT_FIELDS[1]),
    pointsLoss: this.numberControl(POINT_FIELDS[2]),
  });

  /** Die zuletzt übernommenen Ausgangswerte, damit ein Neuladen mit gleichem Inhalt nichts zurücksetzt. */
  private applied = '';

  constructor() {
    // Live-Updates laden den Stand neu: Ungespeicherte Eingaben bleiben dabei stehen, außer das Neue ist genau, was
    // im Formular steht (nach dem Speichern).
    effect(() => {
      const value = this.value();
      untracked(() => {
        const key = JSON.stringify(value);
        if (key === this.applied) {
          return;
        }
        this.applied = key;
        if (this.form.pristine || this.matchesForm(value)) {
          this.form.reset({ name: value.name, date: value.date, ...value.config });
        }
      });
    });
  }

  protected message(field: NumberFieldSpec): string {
    const errors = this.form.controls[field.name].errors;
    if (errors?.['required']) {
      return 'Bitte ausfüllen.';
    }
    if (errors?.['integer']) {
      return 'Bitte eine ganze Zahl eingeben.';
    }
    return `Mindestens ${field.min}.`;
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    this.submitted.emit({
      name: v.name.trim(),
      date: v.date,
      config: {
        tableCount: v.tableCount!,
        goalLimit: v.goalLimit!,
        matchMinutes: v.matchMinutes!,
        randomRounds: v.randomRounds!,
        plannedRounds: v.plannedRounds,
        pointsWin: v.pointsWin!,
        pointsDraw: v.pointsDraw!,
        pointsLoss: v.pointsLoss!,
      },
    });
  }

  private matchesForm(value: TournamentFormValue): boolean {
    const raw: Record<string, unknown> = this.form.getRawValue();
    const expected: Record<string, unknown> = { name: value.name, date: value.date, ...value.config };
    return Object.keys(raw).every((key) => (raw[key] ?? null) === (expected[key] ?? null));
  }

  private numberControl(field: NumberFieldSpec) {
    const validators = [Validators.min(field.min), integer];
    return this.builder.control<number | null>(null, field.optional ? validators : [Validators.required, ...validators]);
  }
}
