import {
  Match,
  Participant,
  Player,
  PlayerStatistics,
  RankingEntry,
  Round,
  Slot,
  StatisticsTotals,
  Tournament,
  TournamentStanding,
} from '../api/models';

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

export function rankingEntry(rank: number, player: Player, points: number, status: RankingEntry['status'] = 'ACTIVE'): RankingEntry {
  return {
    rank,
    player,
    points,
    status,
    matchesPlayed: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    goalsFor: 10,
    goalsAgainst: 5,
    goalDifference: 5,
  };
}

export function standing(overrides: Partial<TournamentStanding> = {}): TournamentStanding {
  return {
    tournamentId: 't1',
    name: 'Demo-Turnier',
    date: '2026-10-31',
    tournamentStatus: 'FINISHED',
    participantStatus: 'ACTIVE',
    rank: 1,
    participantCount: 8,
    matchesPlayed: 4,
    wins: 3,
    draws: 0,
    losses: 1,
    goalsFor: 38,
    goalsAgainst: 24,
    goalDifference: 14,
    points: 9,
    ...overrides,
  };
}

/** Eine Statistik, deren Summen aus den Turnieren folgen sollten; für Tests mit `totals` überschreiben. */
export function statistics(player: Player, tournaments: TournamentStanding[], totals: Partial<StatisticsTotals> = {}): PlayerStatistics {
  const sum = (pick: (entry: TournamentStanding) => number) => tournaments.reduce((all, entry) => all + pick(entry), 0);
  return {
    player,
    tournaments,
    totals: {
      tournamentCount: tournaments.length,
      finishedTournamentCount: tournaments.filter((entry) => entry.tournamentStatus === 'FINISHED').length,
      titles: 0,
      podiums: 0,
      matchesPlayed: sum((entry) => entry.matchesPlayed),
      wins: sum((entry) => entry.wins),
      draws: sum((entry) => entry.draws),
      losses: sum((entry) => entry.losses),
      goalsFor: sum((entry) => entry.goalsFor),
      goalsAgainst: sum((entry) => entry.goalsAgainst),
      goalDifference: sum((entry) => entry.goalDifference),
      points: sum((entry) => entry.points),
      ...totals,
    },
  };
}

export function round(number: number, matches: Match[], complete = false): Round {
  return { number, matches, complete };
}

export const CAN_DECIDE: Match['permissions'] = { canEnterResult: false, canConfirm: false, canReject: false, canDecide: true };

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
