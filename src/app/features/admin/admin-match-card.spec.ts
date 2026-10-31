import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Match, ResultRequest } from '../../api/models';
import { ANNA, BEN, CAN_DECIDE, match as buildMatch } from '../../testing/fixtures';
import { AdminMatchCard } from './admin-match-card';

describe('AdminMatchCard', () => {
  let fixture: ComponentFixture<AdminMatchCard>;
  let sent: ResultRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AdminMatchCard] }).compileComponents();
    fixture = TestBed.createComponent(AdminMatchCard);
    sent = [];
    fixture.componentInstance.decide.subscribe((result) => sent.push(result));
  });

  async function show(match: Match): Promise<void> {
    fixture.componentRef.setInput('match', match);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(element().querySelectorAll('button')).find((entry) => entry.textContent!.trim() === label);
  const inputs = () => Array.from(element().querySelectorAll('input'));

  async function fill(goalsA: string, goalsB: string): Promise<void> {
    const [a, b] = inputs();
    a.value = goalsA;
    a.dispatchEvent(new Event('input'));
    b.value = goalsB;
    b.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('zeigt Tisch, Team A und Team B ohne die Sicht eines Spielers', async () => {
    await show(buildMatch());

    expect(text()).toContain('Tisch 1');
    expect(text()).toContain('Team A');
    expect(text()).toContain('Anna Beispiel');
    expect(text()).toContain('Team B');
    expect(text()).not.toContain('(du)');
    expect(element().querySelectorAll('button').length).toBe(0);
  });

  it('sagt bei einem wartenden Match, dass es noch keinen Tisch hat', async () => {
    await show(buildMatch({ status: 'QUEUED', table: null }));

    expect(text()).toContain('Wartet auf einen Tisch');
  });

  it('legt ein Ergebnis fest', async () => {
    await show(buildMatch({ permissions: CAN_DECIDE }));

    button('Ergebnis festlegen')!.click();
    await fixture.whenStable();
    await fill('10', '7');
    element().querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(sent).toEqual([{ goalsA: 10, goalsB: 7 }]);
  });

  it('bietet bei einem bestätigten Ergebnis eine Korrektur mit den bisherigen Werten an', async () => {
    await show(
      buildMatch({
        status: 'CONFIRMED',
        permissions: CAN_DECIDE,
        result: { goalsA: 10, goalsB: 6, confirmed: true, enteredBy: ANNA, enteredSide: 'A', source: 'TEAM' },
      }),
    );
    expect(element().querySelector('.score')!.textContent!.trim()).toBe('10 : 6');

    button('Ergebnis korrigieren')!.click();
    await fixture.whenStable();

    expect(inputs().map((entry) => entry.value)).toEqual(['10', '6']);
  });

  it('weist bei einem Streitfall darauf hin, wer was eingetragen hat', async () => {
    await show(
      buildMatch({
        status: 'DISPUTED',
        permissions: CAN_DECIDE,
        result: { goalsA: 10, goalsB: 8, confirmed: false, enteredBy: BEN, enteredSide: 'A', source: null },
      }),
    );

    expect(text()).toContain('Streitfall: Ben Beispiel hat 10 : 8 eingetragen');
    expect(button('Ergebnis festlegen')).toBeDefined();
  });

  it('kennzeichnet ein vom Admin festgelegtes Ergebnis', async () => {
    await show(
      buildMatch({
        status: 'CONFIRMED',
        result: { goalsA: 10, goalsB: 9, confirmed: true, enteredBy: null, enteredSide: null, source: 'ADMIN' },
      }),
    );

    expect(text()).toContain('Ergebnis gilt (vom Admin festgelegt).');
  });

  it('sperrt das Absenden bei negativen Toren', async () => {
    await show(buildMatch({ permissions: CAN_DECIDE }));

    button('Ergebnis festlegen')!.click();
    await fixture.whenStable();
    await fill('-1', '3');

    expect(button('Ergebnis festlegen')!.disabled).toBe(true);
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(sent).toEqual([]);
  });

  it('schließt das Formular, sobald sich der Stand des Matches ändert', async () => {
    const open = buildMatch({ permissions: CAN_DECIDE });
    await show(open);
    button('Ergebnis festlegen')!.click();
    await fixture.whenStable();
    expect(element().querySelector('form')).not.toBeNull();

    await show({
      ...open,
      status: 'CONFIRMED',
      result: { goalsA: 10, goalsB: 7, confirmed: true, enteredBy: null, enteredSide: null, source: 'ADMIN' },
    });

    expect(element().querySelector('form')).toBeNull();
  });
});
