import { Match, Participant, Player, Slot, Tournament } from '../api/models';

/** Kleine Beispieldaten für die Tests. */
export const ANNA: Player = { id: 'p-anna', displayName: 'Anna Beispiel' };
export const BEN: Player = { id: 'p-ben', displayName: 'Ben Beispiel' };
export const CLARA: Player = { id: 'p-clara', displayName: 'Clara Beispiel' };
export const DAVID: Player = { id: 'p-david', displayName: 'David Beispiel' };

export function slot(player: Player): Slot {
  return { type: 'PLAYER', player, standIn: null };
}

export function participant(player: Player, status: Participant['status'] = 'ACTIVE'): Participant {
  return { player, status, registeredAt: '2026-10-31T08:00:00Z' };
}

/** Anna und Ben (Team A) gegen Clara und David (Team B), ohne besondere Rechte. */
export function match(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    round: 1,
    position: 1,
    table: 1,
    status: 'ON_TABLE',
    mySide: 'A',
    result: null,
    permissions: { canEnterResult: false, canConfirm: false, canReject: false, canDecide: false },
    teamA: { members: [slot(ANNA), slot(BEN)] },
    teamB: { members: [slot(CLARA), slot(DAVID)] },
    ...overrides,
  };
}

export function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Demo-Turnier',
    date: '2026-10-31',
    status: 'PLANNED',
    roundCount: 0,
    currentRound: null,
    participants: [],
    config: {
      goalLimit: 10,
      matchMinutes: 5,
      plannedRounds: null,
      pointsDraw: 1,
      pointsLoss: 0,
      pointsWin: 3,
      randomRounds: 2,
      tableCount: 3,
    },
    ...overrides,
  };
}
