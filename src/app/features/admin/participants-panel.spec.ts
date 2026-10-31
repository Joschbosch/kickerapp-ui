import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Participant, Player, TournamentStatus } from '../../api/models';
import { ANNA, BEN, CLARA, DAVID, participant } from '../../testing/fixtures';
import { ParticipantAction, ParticipantsPanel } from './participants-panel';

describe('ParticipantsPanel', () => {
  let fixture: ComponentFixture<ParticipantsPanel>;
  let registered: string[];
  let acts: { player: Player; action: ParticipantAction }[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ParticipantsPanel] }).compileComponents();
    fixture = TestBed.createComponent(ParticipantsPanel);
    registered = [];
    acts = [];
    fixture.componentInstance.register.subscribe((id) => registered.push(id));
    fixture.componentInstance.act.subscribe((event) => acts.push(event));
  });

  async function show(status: TournamentStatus, participants: Participant[], players: Player[] = []): Promise<void> {
    fixture.componentRef.setInput('tournamentStatus', status);
    fixture.componentRef.setInput('participants', participants);
    fixture.componentRef.setInput('players', players);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const buttons = () => Array.from(element().querySelectorAll('button'));
  const button = (label: string) => buttons().find((entry) => entry.textContent!.trim() === label);
  const names = () => Array.from(element().querySelectorAll('.people .name')).map((entry) => entry.textContent!.trim());

  it('listet die Teilnehmer nach Namen mit ihrem Status', async () => {
    await show('RUNNING', [participant(CLARA), participant(ANNA), participant(BEN, 'PAUSED')]);

    expect(names()).toEqual(['Anna Beispiel', 'Ben Beispiel', 'Clara Beispiel']);
    expect(text()).toContain('Pausiert');
  });

  it('sagt, wenn noch niemand angemeldet ist', async () => {
    await show('PLANNED', []);

    expect(text()).toContain('Noch niemand angemeldet.');
  });

  it('lässt vor dem Start abmelden', async () => {
    await show('PLANNED', [participant(ANNA)]);

    button('Abmelden')!.click();

    expect(acts).toEqual([{ player: ANNA, action: 'unregister' }]);
    expect(button('Pausieren')).toBeUndefined();
  });

  it('lässt im laufenden Turnier pausieren und wieder einsteigen', async () => {
    await show('RUNNING', [participant(ANNA), participant(BEN, 'PAUSED')]);

    button('Pausieren')!.click();
    button('Wieder einsteigen')!.click();

    expect(acts).toEqual([
      { player: ANNA, action: 'pause' },
      { player: BEN, action: 'resume' },
    ]);
  });

  it('fragt vor dem Ausscheiden nach', async () => {
    await show('RUNNING', [participant(ANNA)]);

    button('Ausscheiden')!.click();
    await fixture.whenStable();
    expect(text()).toContain('Endgültig, keine Rückkehr möglich.');
    expect(acts).toEqual([]);

    button('Ja, ausscheiden')!.click();
    expect(acts).toEqual([{ player: ANNA, action: 'withdraw' }]);
  });

  it('bricht das Ausscheiden ab, ohne etwas auszulösen', async () => {
    await show('RUNNING', [participant(ANNA)]);

    button('Ausscheiden')!.click();
    await fixture.whenStable();
    button('Abbrechen')!.click();
    await fixture.whenStable();

    expect(acts).toEqual([]);
    expect(button('Ausscheiden')).toBeDefined();
  });

  it('bietet Ausgeschiedenen keine Aktionen an', async () => {
    await show('RUNNING', [participant(ANNA, 'WITHDRAWN')]);

    expect(buttons().filter((entry) => entry.textContent!.trim() !== 'Anmelden')).toEqual([]);
    expect(text()).toContain('Ausgeschieden');
  });

  it('ändert nach dem Turnierende nichts mehr und bietet keine Anmeldung an', async () => {
    await show('FINISHED', [participant(ANNA)], [ANNA, BEN]);

    expect(buttons()).toEqual([]);
    expect(element().querySelector('select')).toBeNull();
  });

  it('meldet einen bekannten Spieler an, der noch nicht dabei ist', async () => {
    await show('PLANNED', [participant(ANNA)], [ANNA, DAVID, BEN]);

    const select = element().querySelector('select')!;
    const options = Array.from(select.querySelectorAll('option')).map((entry) => entry.textContent!.trim());
    expect(options).toEqual(['Spieler wählen …', 'Ben Beispiel', 'David Beispiel']);
    expect(button('Anmelden')!.disabled).toBe(true);

    select.value = DAVID.id;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    button('Anmelden')!.click();

    expect(registered).toEqual([DAVID.id]);
  });

  it('sagt, wenn es keinen weiteren bekannten Spieler gibt', async () => {
    await show('RUNNING', [participant(ANNA)], [ANNA]);

    expect(text()).toContain('Alle bekannten Spieler sind schon angemeldet.');
  });

  it('sperrt die Schaltflächen, solange ein Aufruf läuft', async () => {
    fixture.componentRef.setInput('busy', true);
    await show('RUNNING', [participant(ANNA)]);

    expect(button('Pausieren')!.disabled).toBe(true);
    expect(button('Ausscheiden')!.disabled).toBe(true);
  });
});
