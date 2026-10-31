import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AppConfigService } from '../core/app-config';
import {
  Match,
  Me,
  RankingEntry,
  ResultRequest,
  Round,
  Tournament,
  TournamentSummary,
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
