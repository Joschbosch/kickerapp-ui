import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanTournamentRequest } from '../../api/models';
import { fieldByLabel } from '../../testing/dom';
import { tournament } from '../../testing/fixtures';
import { TournamentForm, TournamentFormValue } from './tournament-form';

const VALUE: TournamentFormValue = { name: 'Sommerturnier', date: '2026-10-05', config: tournament().config };

describe('TournamentForm', () => {
  let fixture: ComponentFixture<TournamentForm>;
  let sent: PlanTournamentRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TournamentForm] }).compileComponents();
    fixture = TestBed.createComponent(TournamentForm);
    sent = [];
    fixture.componentInstance.submitted.subscribe((request) => sent.push(request));
  });

  async function show(requireChange = false): Promise<void> {
    fixture.componentRef.setInput('value', VALUE);
    fixture.componentRef.setInput('requireChange', requireChange);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const field = (label: string) => fieldByLabel(element(), label);
  const submitButton = () => element().querySelector<HTMLButtonElement>('button[type="submit"]')!;

  async function type(name: string, value: string): Promise<void> {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  const submit = () => element().querySelector('form')!.dispatchEvent(new Event('submit'));

  it('zeigt Name, Datum und Konfiguration', async () => {
    await show();

    expect(field('Name').value).toBe('Sommerturnier');
    expect(field('Datum').value).toBe('2026-10-05');
    expect(field('Anzahl Tische').value).toBe('3');
    expect(field('Tore pro Match').value).toBe('10');
    expect(field('Punkte für einen Sieg').value).toBe('3');
    expect(field('Geplante Runden').value).toBe('');
  });

  it('sendet Name, Datum und Konfiguration, Name ohne Leerzeichen am Rand', async () => {
    await show();

    await type('Name', '  Herbstturnier ');
    await type('Anzahl Tische', '4');
    await type('Geplante Runden', '8');
    submit();

    expect(sent).toEqual([
      {
        name: 'Herbstturnier',
        date: '2026-10-05',
        config: {
          tableCount: 4,
          goalLimit: 10,
          matchMinutes: 5,
          randomRounds: 2,
          plannedRounds: 8,
          pointsWin: 3,
          pointsDraw: 1,
          pointsLoss: 0,
        },
      },
    ]);
  });

  it('sendet eine offene Rundenzahl als null', async () => {
    await show();

    submit();

    expect(sent[0].config?.plannedRounds).toBeNull();
  });

  it('sperrt das Absenden ohne Namen', async () => {
    await show();

    await type('Name', '   ');

    expect(submitButton().disabled).toBe(true);
    submit();
    expect(sent).toEqual([]);
  });

  it('sperrt zu kleine Werte und Kommazahlen', async () => {
    await show();

    await type('Anzahl Tische', '0');
    expect(submitButton().disabled).toBe(true);

    await type('Anzahl Tische', '2.5');
    expect(submitButton().disabled).toBe(true);
    // Material zeigt Fehler erst, wenn das Feld verlassen wurde
    field('Anzahl Tische').dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(element().textContent).toContain('Bitte eine ganze Zahl eingeben.');

    await type('Anzahl Tische', '2');
    expect(submitButton().disabled).toBe(false);
  });

  it('erlaubt 0 Punkte und 0 Zufallsrunden, aber keine fehlende Zahl', async () => {
    await show();

    await type('Punkte für eine Niederlage', '0');
    await type('Zufallsrunden am Anfang', '0');
    expect(submitButton().disabled).toBe(false);

    await type('Tore pro Match', '');
    expect(submitButton().disabled).toBe(true);
  });

  it('speichert bei „requireChange“ erst nach einer Änderung', async () => {
    await show(true);
    expect(submitButton().disabled).toBe(true);

    await type('Spielzeit in Minuten', '7');
    expect(submitButton().disabled).toBe(false);
  });

  it('übernimmt neue Ausgangswerte, solange nichts geändert wurde', async () => {
    await show();

    fixture.componentRef.setInput('value', { ...VALUE, name: 'Von anderswo geändert' });
    await fixture.whenStable();

    expect(field('Name').value).toBe('Von anderswo geändert');
  });

  it('behält ungespeicherte Eingaben, wenn sich der Stand von außen ändert (Live-Update)', async () => {
    await show();
    await type('Name', 'Entwurf');

    fixture.componentRef.setInput('value', { ...VALUE, config: { ...VALUE.config, tableCount: 5 } });
    await fixture.whenStable();

    expect(field('Name').value).toBe('Entwurf');
    expect(field('Anzahl Tische').value).toBe('3');
  });

  it('wird nach dem Speichern wieder sauber, wenn der neue Stand dem Formular entspricht', async () => {
    await show(true);
    await type('Name', 'Neu');
    expect(submitButton().disabled).toBe(false);

    fixture.componentRef.setInput('value', { ...VALUE, name: 'Neu' });
    await fixture.whenStable();

    expect(field('Name').value).toBe('Neu');
    expect(submitButton().disabled).toBe(true);
  });

  it('setzt bei einem Neuladen mit gleichem Inhalt nichts zurück', async () => {
    await show();
    await type('Name', 'Entwurf');

    fixture.componentRef.setInput('value', { ...VALUE, config: { ...VALUE.config } });
    await fixture.whenStable();

    expect(field('Name').value).toBe('Entwurf');
  });
});
