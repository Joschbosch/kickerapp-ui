import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Match, ResultRequest } from '../../api/models';
import { ANNA, BEN, CLARA, match as buildMatch } from '../../testing/fixtures';
import { MatchCard } from './match-card';

describe('MatchCard', () => {
  let fixture: ComponentFixture<MatchCard>;

  async function show(match: Match, playerId = ANNA.id): Promise<void> {
    fixture.componentRef.setInput('match', match);
    fixture.componentRef.setInput('playerId', playerId);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(element().querySelectorAll('button')).find((entry) => entry.textContent!.trim() === label);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MatchCard] }).compileComponents();
    fixture = TestBed.createComponent(MatchCard);
  });

  it('zeigt den Tisch und die Teams, den Spieler selbst als „du“', async () => {
    await show(buildMatch());

    expect(text()).toContain('Tisch 1 – jetzt spielen');
    expect(text()).toContain('Anna Beispiel (du)');
    expect(text()).toContain('Ben Beispiel');
    expect(text()).toContain('Clara Beispiel');
  });

  it('stellt das eigene Team links hin, auch auf Seite B', async () => {
    await show(
      buildMatch({
        mySide: 'B',
        status: 'CONFIRMED',
        result: { goalsA: 10, goalsB: 6, confirmed: true, enteredBy: ANNA, enteredSide: 'A', source: 'TEAM' },
      }),
      CLARA.id,
    );

    const teams = element().querySelectorAll('.team');
    expect(teams[0].textContent).toContain('Clara Beispiel (du)');
    expect(teams[1].textContent).toContain('Anna Beispiel');
    expect(element().querySelector('.score')!.textContent!.trim()).toBe('6 : 10');
    expect(text()).toContain('Ergebnis bestätigt.');
  });

  it('sagt bei einem wartenden Match, dass noch kein Tisch frei ist', async () => {
    await show(buildMatch({ status: 'QUEUED', table: null }));

    expect(text()).toContain('Wartet auf einen freien Tisch');
  });

  it('kennzeichnet Gäste und Einspringer', async () => {
    const guest = buildMatch();
    guest.teamB.members[1] = { type: 'DUMMY', player: null, standIn: null };
    guest.teamB.members[0] = { type: 'DUMMY', player: null, standIn: BEN };
    await show(guest);

    expect(text()).toContain('Gast');
    expect(text()).toContain('Ben Beispiel (Einspringer)');
  });

  it('zeigt ohne Rechte keine Schaltflächen', async () => {
    await show(buildMatch());

    expect(element().querySelectorAll('button').length).toBe(0);
  });

  it('trägt ein Ergebnis aus Sicht des eigenen Teams ein (Seite A)', async () => {
    await show(buildMatch({ permissions: { canEnterResult: true, canConfirm: false, canReject: false, canDecide: false } }));
    const sent: ResultRequest[] = [];
    fixture.componentInstance.submitResult.subscribe((result) => sent.push(result));

    button('Ergebnis eintragen')!.click();
    await fixture.whenStable();
    const [mine, opponent] = Array.from(element().querySelectorAll('input'));
    mine.value = '10';
    mine.dispatchEvent(new Event('input'));
    opponent.value = '7';
    opponent.dispatchEvent(new Event('input'));
    element().querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(sent).toEqual([{ goalsA: 10, goalsB: 7 }]);
  });

  it('dreht das Ergebnis für Seite B um', async () => {
    await show(
      buildMatch({
        mySide: 'B',
        permissions: { canEnterResult: true, canConfirm: false, canReject: false, canDecide: false },
      }),
      CLARA.id,
    );
    const sent: ResultRequest[] = [];
    fixture.componentInstance.submitResult.subscribe((result) => sent.push(result));

    button('Ergebnis eintragen')!.click();
    await fixture.whenStable();
    const [mine, opponent] = Array.from(element().querySelectorAll('input'));
    mine.value = '10';
    mine.dispatchEvent(new Event('input'));
    opponent.value = '7';
    opponent.dispatchEvent(new Event('input'));
    element().querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(sent).toEqual([{ goalsA: 7, goalsB: 10 }]);
  });

  it('sperrt das Absenden bei negativen Toren', async () => {
    await show(buildMatch({ permissions: { canEnterResult: true, canConfirm: false, canReject: false, canDecide: false } }));
    const sent: ResultRequest[] = [];
    fixture.componentInstance.submitResult.subscribe((result) => sent.push(result));

    button('Ergebnis eintragen')!.click();
    await fixture.whenStable();
    const [mine] = Array.from(element().querySelectorAll('input'));
    mine.value = '-1';
    mine.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(button('Ergebnis senden')!.disabled).toBe(true);
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(sent).toEqual([]);
  });

  it('lässt das Gegnerteam bestätigen oder ablehnen', async () => {
    await show(
      buildMatch({
        status: 'RESULT_ENTERED',
        mySide: 'B',
        result: { goalsA: 10, goalsB: 8, confirmed: false, enteredBy: ANNA, enteredSide: 'A', source: null },
        permissions: { canEnterResult: false, canConfirm: true, canReject: true, canDecide: false },
      }),
      CLARA.id,
    );
    const events: string[] = [];
    fixture.componentInstance.confirm.subscribe(() => events.push('confirm'));
    fixture.componentInstance.reject.subscribe(() => events.push('reject'));

    expect(text()).toContain('Anna Beispiel hat 8 : 10 eingetragen');
    button('Bestätigen')!.click();
    button('Ablehnen')!.click();

    expect(events).toEqual(['confirm', 'reject']);
  });

  it('sagt dem Eintragenden, dass die Bestätigung aussteht', async () => {
    await show(
      buildMatch({
        status: 'RESULT_ENTERED',
        result: { goalsA: 10, goalsB: 8, confirmed: false, enteredBy: ANNA, enteredSide: 'A', source: null },
      }),
    );

    expect(text()).toContain('Wartet auf die Bestätigung durch das Gegnerteam.');
    expect(element().querySelectorAll('button').length).toBe(0);
  });

  it('schließt das Formular, sobald sich der Stand des Matches ändert', async () => {
    const entering = buildMatch({ permissions: { canEnterResult: true, canConfirm: false, canReject: false, canDecide: false } });
    await show(entering);
    button('Ergebnis eintragen')!.click();
    await fixture.whenStable();
    expect(element().querySelector('form')).not.toBeNull();

    await show({
      ...entering,
      status: 'RESULT_ENTERED',
      result: { goalsA: 10, goalsB: 7, confirmed: false, enteredBy: ANNA, enteredSide: 'A', source: null },
      permissions: { canEnterResult: false, canConfirm: false, canReject: false, canDecide: false },
    });

    expect(element().querySelector('form')).toBeNull();
  });
});
