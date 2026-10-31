import { ParticipantStatus, TournamentStatus } from '../api/models';

/** Anzeigetexte für die Statuswerte der API. */
export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  PLANNED: 'Geplant',
  RUNNING: 'Läuft',
  FINISHED: 'Beendet',
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  ACTIVE: 'Aktiv',
  PAUSED: 'Pausiert',
  WITHDRAWN: 'Ausgeschieden',
};
