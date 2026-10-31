import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../core/app-config';
import {
  ConfigRequest,
  Match,
  Me,
  ParticipantStatus,
  PlanTournamentRequest,
  Player,
  PlayerStatistics,
  RankingEntry,
  ResultRequest,
  Round,
  Tournament,
  TournamentSummary,
  UpdateTournamentRequest,
} from './models';

/**
 * Die Aufrufe der Backend-API. Die Typen kommen aus dem Vertrag (`schema.d.ts`). Das Anmelde-Token hängt der
 * Interceptor an, hier steht nur, welche Adresse was liefert.
 */
@Injectable({ providedIn: 'root' })
export class KickerApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  me(): Observable<Me> {
    return this.http.get<Me>(this.config.url('/api/me'));
  }

  /** Die Statistik eines Spielers über alle seine Turniere. Jeder darf jede sehen, `me` ist der Angemeldete. */
  statistics(playerId: string): Observable<PlayerStatistics> {
    return this.http.get<PlayerStatistics>(this.config.url(`/api/players/${playerId}/statistics`));
  }

  tournaments(): Observable<TournamentSummary[]> {
    return this.http.get<TournamentSummary[]>(this.config.url('/api/tournaments'));
  }

  tournament(id: string): Observable<Tournament> {
    return this.http.get<Tournament>(this.config.url(`/api/tournaments/${id}`));
  }

  ranking(tournamentId: string): Observable<RankingEntry[]> {
    return this.http.get<RankingEntry[]>(this.config.url(`/api/tournaments/${tournamentId}/ranking`));
  }

  rounds(tournamentId: string): Observable<Round[]> {
    return this.http.get<Round[]>(this.config.url(`/api/tournaments/${tournamentId}/rounds`));
  }

  /** Die Matches des angemeldeten Spielers, auch als Einspringer. */
  myMatches(tournamentId: string): Observable<Match[]> {
    return this.http.get<Match[]>(this.config.url(`/api/tournaments/${tournamentId}/matches/mine`));
  }

  /** Meldet den angemeldeten Spieler zum Turnier an. Ohne Body, die API erkennt den Spieler am Token. */
  register(tournamentId: string): Observable<Tournament> {
    return this.http.post<Tournament>(this.config.url(`/api/tournaments/${tournamentId}/participants`), {});
  }

  /** Meldet den angemeldeten Spieler ab (nur solange das Turnier geplant ist). */
  unregister(tournamentId: string): Observable<Tournament> {
    return this.removeParticipant(tournamentId, 'me');
  }

  /** Pausieren (ab der nächsten Runde), wieder einsteigen oder ausscheiden (endgültig). */
  changeMyStatus(tournamentId: string, status: ParticipantStatus): Observable<Tournament> {
    return this.changeParticipantStatus(tournamentId, 'me', status);
  }

  // --- Nur Admin ---

  /** Alle bekannten Spieler, z. B. um einen anderen zum Turnier anzumelden. */
  players(): Observable<Player[]> {
    return this.http.get<Player[]>(this.config.url('/api/players'));
  }

  planTournament(request: PlanTournamentRequest): Observable<Tournament> {
    return this.http.post<Tournament>(this.config.url('/api/tournaments'), request);
  }

  updateDetails(tournamentId: string, request: UpdateTournamentRequest): Observable<Tournament> {
    return this.http.put<Tournament>(this.config.url(`/api/tournaments/${tournamentId}`), request);
  }

  /** Ersetzt die Konfiguration, auch im laufenden Turnier. */
  updateConfig(tournamentId: string, config: ConfigRequest): Observable<Tournament> {
    return this.http.put<Tournament>(this.config.url(`/api/tournaments/${tournamentId}/config`), config);
  }

  start(tournamentId: string): Observable<Tournament> {
    return this.http.post<Tournament>(this.config.url(`/api/tournaments/${tournamentId}/start`), {});
  }

  startNextRound(tournamentId: string): Observable<Tournament> {
    return this.http.post<Tournament>(this.config.url(`/api/tournaments/${tournamentId}/rounds`), {});
  }

  finish(tournamentId: string): Observable<Tournament> {
    return this.http.post<Tournament>(this.config.url(`/api/tournaments/${tournamentId}/finish`), {});
  }

  /** Meldet einen anderen bekannten Spieler an. */
  registerPlayer(tournamentId: string, playerId: string): Observable<Tournament> {
    return this.http.post<Tournament>(this.config.url(`/api/tournaments/${tournamentId}/participants`), { playerId });
  }

  removeParticipant(tournamentId: string, playerId: string): Observable<Tournament> {
    return this.http.delete<Tournament>(this.config.url(`/api/tournaments/${tournamentId}/participants/${playerId}`));
  }

  changeParticipantStatus(tournamentId: string, playerId: string, status: ParticipantStatus): Observable<Tournament> {
    return this.http.put<Tournament>(
      this.config.url(`/api/tournaments/${tournamentId}/participants/${playerId}/status`),
      { status },
    );
  }

  /** Legt das Ergebnis eines Matches fest oder korrigiert es, es zählt sofort. */
  decideResult(tournamentId: string, matchId: string, result: ResultRequest): Observable<Match> {
    return this.http.put<Match>(
      this.config.url(`/api/tournaments/${tournamentId}/matches/${matchId}/result`),
      result,
    );
  }

  submitResult(tournamentId: string, matchId: string, result: ResultRequest): Observable<Match> {
    return this.http.post<Match>(
      this.config.url(`/api/tournaments/${tournamentId}/matches/${matchId}/result-proposal`),
      result,
    );
  }

  confirmResult(tournamentId: string, matchId: string): Observable<Match> {
    return this.http.post<Match>(
      this.config.url(`/api/tournaments/${tournamentId}/matches/${matchId}/result-proposal/confirmation`),
      {},
    );
  }

  rejectResult(tournamentId: string, matchId: string): Observable<Match> {
    return this.http.post<Match>(
      this.config.url(`/api/tournaments/${tournamentId}/matches/${matchId}/result-proposal/rejection`),
      {},
    );
  }
}
