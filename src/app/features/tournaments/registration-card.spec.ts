import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Participant, TournamentStatus } from '../../api/models';
import { ANNA, participant } from '../../testing/fixtures';
import { RegistrationAction, RegistrationCard } from './registration-card';

describe('RegistrationCard', () => {
  let fixture: ComponentFixture<RegistrationCard>;
  let actions: RegistrationAction[];

  async function show(status: TournamentStatus, entry?: Participant): Promise<void> {
    fixture.componentRef.setInput('tournamentStatus', status);
    fixture.componentRef.setInput('participant', entry);
    await fixture.whenStable();
  }

  const element = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(element().querySelectorAll('button')).map((button) => button.textContent!.trim());
  const click = async (label: string) => {
    Array.from(element().querySelectorAll('button')).find((button) => button.textContent!.trim() === label)!.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RegistrationCard] }).compileComponents();
    fixture = TestBed.createComponent(RegistrationCard);
    actions = [];
    fixture.componentInstance.action.subscribe((action) => actions.push(action));
  });

  it('bietet Nicht-Angemeldeten das Anmelden an', async () => {
    await show('PLANNED');

    expect(buttons()).toEqual(['Anmelden']);
    await click('Anmelden');
    expect(actions).toEqual(['register']);
  });

  it('weist beim laufenden Turnier darauf hin, dass man ab der nächsten Runde mitspielt', async () => {
    await show('RUNNING');

    expect(element().textContent).toContain('ab der nächsten Runde mit');
    expect(buttons()).toEqual(['Anmelden']);
  });

  it('zeigt bei einem beendeten Turnier nichts an', async () => {
    await show('FINISHED');

    expect(element().querySelector('mat-card')).toBeNull();
  });

  it('erlaubt vor dem Start nur das Abmelden', async () => {
    await show('PLANNED', participant(ANNA));

    expect(element().textContent).toContain('Du bist dabei.');
    expect(buttons()).toEqual(['Abmelden']);
    await click('Abmelden');
    expect(actions).toEqual(['unregister']);
  });

  it('erlaubt im laufenden Turnier Pausieren und Ausscheiden', async () => {
    await show('RUNNING', participant(ANNA));

    expect(buttons()).toEqual(['Ab nächster Runde pausieren', 'Ausscheiden']);
    await click('Ab nächster Runde pausieren');
    expect(actions).toEqual(['pause']);
  });

  it('lässt Pausierende wieder einsteigen', async () => {
    await show('RUNNING', participant(ANNA, 'PAUSED'));

    expect(element().textContent).toContain('Du pausierst');
    await click('Wieder einsteigen');
    expect(actions).toEqual(['resume']);
  });

  it('fragt vor dem endgültigen Ausscheiden nach', async () => {
    await show('RUNNING', participant(ANNA));

    await click('Ausscheiden');
    expect(actions).toEqual([]);
    expect(element().textContent).toContain('Wirklich ausscheiden?');

    await click('Ja, ausscheiden');
    expect(actions).toEqual(['withdraw']);
  });

  it('lässt sich das Ausscheiden noch abbrechen', async () => {
    await show('RUNNING', participant(ANNA));

    await click('Ausscheiden');
    await click('Abbrechen');

    expect(actions).toEqual([]);
    expect(buttons()).toEqual(['Ab nächster Runde pausieren', 'Ausscheiden']);
  });

  it('bietet Ausgeschiedenen nichts mehr an', async () => {
    await show('RUNNING', participant(ANNA, 'WITHDRAWN'));

    expect(element().textContent).toContain('Du bist ausgeschieden.');
    expect(buttons()).toEqual([]);
  });
});
