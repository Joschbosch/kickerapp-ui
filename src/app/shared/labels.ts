import { MatchStatus, ParticipantStatus, TournamentStatus } from '../api/models';

/** Anzeigetexte für die Statuswerte der API. */
export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  PLANNED: 'Geplant',
  RUNNING: 'Läuft',
  FINISHED: 'Beendet',
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  QUEUED: 'Wartet',
  ON_TABLE: 'Läuft',
  RESULT_ENTERED: 'Ergebnis eingetragen',
  DISPUTED: 'Streitfall',
  CONFIRMED: 'Gespielt',
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausiert',
  WITHDRAWN: 'Ausgeschieden',
};
