import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Match } from '../../api/models';
import { ANNA, BEN, CLARA, DAVID, match, slot } from '../../testing/fixtures';
import { TablesOverview } from './tables-overview';

describe('TablesOverview', () => {
  let fixture: ComponentFixture<TablesOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TablesOverview], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(TablesOverview);
    fixture.componentRef.setInput('tournamentId', 't1');
    fixture.componentRef.setInput('playerId', ANNA.id);
  });

  async function show(matches: Match[]): Promise<void> {
    fixture.componentRef.setInput('matches', matches);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ').trim();
  const items = (selector: string) =>
    Array.from(element().querySelectorAll(selector)).map((entry) => entry.textContent!.replace(/\s+/g, ' ').trim());

  const other = { teamA: { members: [slot(BEN), slot(DAVID)] }, teamB: { members: [slot(CLARA), slot(ANNA)] } };

  it('zeigt die Tische der Reihe nach, das eigene Spiel hervorgehoben', async () => {
    await show([
      match({ id: 'm2', table: 2, position: 2, mySide: null, ...other }),
      match({ id: 'm1', table: 1, position: 1, mySide: 'A' }),
    ]);

    const tables = items('.tables li');
    expect(tables[0]).toContain('Tisch 1');
    expect(tables[0]).toContain('dein Spiel');
    expect(tables[0]).toContain('Anna Beispiel (du) & Ben Beispiel gegen Clara Beispiel & David Beispiel');
    expect(tables[1]).toContain('Tisch 2');
    expect(tables[1]).not.toContain('dein Spiel');
    expect(element().querySelectorAll('.tables li.mine').length).toBe(1);
  });

  it('zählt die gespielten Spiele und verlinkt die große Anzeige', async () => {
    await show([
      match({ id: 'a', status: 'CONFIRMED', mySide: null }),
      match({ id: 'b', status: 'CONFIRMED', mySide: null }),
      match({ id: 'c', status: 'ON_TABLE', mySide: null }),
      match({ id: 'd', status: 'QUEUED', table: null, mySide: null }),
    ]);

    expect(text()).toContain('2 von 4 Spielen gespielt');
    expect(element().querySelector('a')!.getAttribute('href')).toBe('/anzeige/t1');
  });

  it('zeigt die Warteschlange in der Reihenfolge der Auslosung und markiert das eigene Spiel', async () => {
    await show([
      match({ id: 'late', status: 'QUEUED', table: null, position: 5, mySide: null, ...other }),
      match({ id: 'mine', status: 'QUEUED', table: null, position: 4, mySide: 'A' }),
    ]);

    const queue = items('.queue li');
    expect(queue.length).toBe(2);
    expect(queue[0]).toContain('Anna Beispiel (du)');
    expect(queue[0]).toContain('dein Spiel');
    expect(queue[1]).not.toContain('dein Spiel');
    expect(text()).toContain('Als Nächstes');
  });

  it('sagt, wenn alle Tische frei sind und nur noch Ergebnisse fehlen', async () => {
    await show([match({ status: 'RESULT_ENTERED' })]);

    expect(text()).toContain('Alle Tische sind frei, die Ergebnisse werden noch bestätigt.');
    expect(element().querySelector('.tables')).toBeNull();
  });

  it('zeigt keine Warteschlange, wenn niemand wartet', async () => {
    await show([match()]);

    expect(text()).not.toContain('Als Nächstes');
  });

  it('kennzeichnet Gäste und Einspringer', async () => {
    await show([
      match({
        teamB: { members: [{ type: 'DUMMY', player: null, standIn: null }, { type: 'DUMMY', player: null, standIn: DAVID }] },
      }),
    ]);

    expect(text()).toContain('Gast & David Beispiel (Einspringer)');
  });
});
