import type { components } from './schema';

/**
 * Die Typen der API, aus `schema.d.ts` (erzeugt aus dem Vertrag des Backends, nicht von Hand ändern).
 * Hier nur kurze Namen dafür.
 */
type Schemas = components['schemas'];

export type Me = Schemas['Me'];
export type Player = Schemas['Player'];
export type Tournament = Schemas['Tournament'];
export type TournamentSummary = Schemas['TournamentSummary'];
export type TournamentConfig = Schemas['Config'];
export type Participant = Schemas['Participant'];
export type Round = Schemas['Round'];
export type Match = Schemas['Match'];
export type MatchPermissions = Schemas['MatchPermissions'];
export type MatchResult = Schemas['Result'];
export type Team = Schemas['Team'];
export type Slot = Schemas['Slot'];
export type RankingEntry = Schemas['RankingEntry'];
export type PlayerStatistics = Schemas['PlayerStatistics'];
export type StatisticsTotals = Schemas['StatisticsTotals'];
export type TournamentStanding = Schemas['TournamentStanding'];
export type TournamentEvent = Schemas['Event'];
export type EventTicket = Schemas['EventTicket'];

export type PlanTournamentRequest = Schemas['PlanTournament'];
export type UpdateTournamentRequest = Schemas['UpdateTournament'];
export type ConfigRequest = Schemas['ConfigRequest'];
export type ResultRequest = Schemas['ResultRequest'];

export type TournamentStatus = Tournament['status'];
export type ParticipantStatus = Participant['status'];
export type MatchStatus = Match['status'];
