# Kickertool UI

Oberfläche für das Kickertool, eine Kicker-Turnierverwaltung (2 gegen 2, wechselnde Partner, mehrere Tische in Wellen,
Einzelrangliste). Die UI ist ein reiner Client der Backend-REST-API und enthält keine Turnierlogik.
Diese Datei gilt für alle Assistenten (Codex, Claude Code, ...). Eigenheiten einzelner Rechner stehen nicht hier.

- Backend-Repo: https://github.com/Joschbosch/kickerapp (Branch `main`), lokal neben diesem Repo unter `../kickerapp`
- Übergabe mit allen Details: `docs/ui-uebergabe.md` im Backend-Repo. **Zuerst lesen.**
- API-Vertrag: `docs/openapi.json` im Backend-Repo (Swagger UI am laufenden Backend unter `/swagger-ui.html`).

## Technik
- Angular 22 (Standalone-Komponenten, Signals, zoneless, `OnPush`), Angular Material 22 (M3), TypeScript 6, Vitest.
- Eine App, responsiv und als PWA: Handy für Spieler, Desktop-Web für Admin (mehrere Tabellen-Fenster) und Spieler.
  Der Service Worker läuft nur im Produktions-Build.
- Schriften und Icons sind lokal eingebunden (`@fontsource/roboto`, `material-symbols`), kein Aufruf von Google-Diensten.
- Einstellungen zur Laufzeit in `public/config.json` (`apiBaseUrl`, `authMode`), damit dieselbe Auslieferung überall läuft.
- Sprache der Oberfläche und der Dokumentation: Deutsch. Code-Bezeichner: Englisch.
- Node.js 22 oder neuer (entwickelt mit 26), Pakete über npm. `npm install`, `npm start` (http://localhost:4200),
  `npm test`, `npm run build`.

## Arbeitsweise
- Bei Unklarheiten in den Anforderungen **nachfragen**, nicht selbst entscheiden. Getroffene Annahmen offen benennen.
- Die UI arbeitet nur über die API. Fachregeln (wer darf bestätigen, Punkte, Auslosung, Rangliste) werden **nicht** in
  der UI nachgebaut: Die Flags `permissions` und `mySide` an den Matches und die Rangliste kommen vom Backend.
- Fehlt etwas in der API, ist das eine Anfrage an das Backend-Repo, kein Grund für eine Umgehung in der UI.
- Fehler der API (`application/problem+json`) werden mit dem Feld `detail` angezeigt, es ist eine deutsche Meldung.
- Änderungen mit Tests absichern (Vitest, `HttpTestingController` für API-Aufrufe).

## Aufbau (`src/app`)
- `api/`: `kicker-api.ts` (alle Aufrufe), `models.ts` (Typ-Aliasse), `schema.d.ts` (erzeugt, nicht von Hand ändern).
- `core/`: Konfiguration (`app-config.ts`), Anmeldung (`auth/`: Service, Interceptor, Guards) und Live-Updates (`events/`).
- `features/`: je Bereich ein Ordner (Anmeldung, Rahmen, Turniere). Neue Seiten werden in `app.routes.ts` per
  `loadComponent` eingehängt.
- `shared/`: Anzeigetexte und Gemeinsames.

## API-Client
- Die Typen werden aus dem Vertrag **erzeugt**: `npm run api:sync` kopiert `../kickerapp/docs/openapi.json` (anderer Pfad über
  die Umgebungsvariable `KICKERTOOL_BACKEND_DIR`) nach `api/openapi.json` und erzeugt `src/app/api/schema.d.ts`
  (`openapi-typescript`, per `npx` in fester Version, wegen eines Peer-Konflikts mit TypeScript 6 keine Abhängigkeit).
- Ändert sich der Vertrag im Backend: `npm run api:sync`, beide Dateien einchecken. Erzeugte Dateien nicht von Hand ändern.
- Antwortfelder sind im Vertrag Pflicht außer sie sind `nullable`; Typen kommen aus `models.ts`, nicht aus eigenen Kopien.

## Backend lokal starten
- JDK 21 oder neuer, dann im Backend-Repo `./scripts/run-local.sh` (Windows `.\scripts\run-local.ps1`). Das startet die
  API auf http://localhost:8080 mit einem simulierten Login und einem Demo-Turnier. Details in der Übergabe, Abschnitt 2.
- Testnutzer (Benutzername = Passwort): `admin` (Admin), `anna`, `ben`, `clara`, `david`, `emma`, `felix`, `greta`, `hans`,
  `ida`, `jonas`. Token: `POST /mock-oidc/token` mit `grant_type=password`.
- Läuft die UI auf einem anderen lokalen Port (3000, 4200, 5173, ...), ist CORS im lokalen Modus schon freigegeben.

## Anmeldung
- Entwicklung (`authMode: password`): Formular, Benutzername und Passwort gehen an `/mock-oidc/token` des lokalen Backends.
- Produktion (`authMode: oidc`): OIDC mit Authorization Code und PKCE, Client `kickertool-app` (öffentlich, kein Secret),
  umgesetzt mit `oidc-client-ts` hinter `core/auth/oidc-session.ts` (`OidcSession`, in Tests ersetzen). Beides bleibt hinter
  `AuthService`. Die Bibliothek nur dort anfassen.
- Ablauf: Die Anmeldeseite leitet im Modus `oidc` selbst zum Provider (`startLogin`), `/auth/callback` (`CallbackPage`) schließt ab
  (`completeLogin`) und geht zur Seite aus dem `state` weiter, `/abgemeldet` ist das Ziel nach dem Abmelden (keine automatische
  Weiterleitung). Ein Schutz in `safe-target.ts` verhindert eine Schleife App → Provider → App, wenn das Backend ein Token ablehnt.
- Token-Erneuerung: `automaticSilentRenew` erneuert eine Minute vor Ablauf per Refresh-Token (kein Iframe, keine Weiterleitung).
  `OidcSession.watch` meldet das neue Token an `AuthService`, der Interceptor hängt immer das aktuelle an. Bei Netzfehlern wird
  alle 15 s wiederholt, bei einer Ablehnung durch den Provider nicht. Ist das Token abgelaufen, führt das nächste 401 zur
  Anmeldeseite, die ohne Eingabe zurückkehrt, solange die Sitzung beim Provider läuft.
- Das Token liegt im Modus `oidc` nur im Speicher von `AuthService` und im Speicher der Bibliothek (`sessionStorage`, Schlüssel
  `oidc.user:…`), nie unter `kickertool.token` (das ist der Passwort-Modus).
- Jeder Aufruf schickt `Authorization: Bearer <access_token>` (Interceptor). Bei 401 wird lokal vergessen (`expire()`) und zur
  Anmeldung gewechselt, mit der aktuellen Seite als `weiter` (so kehrt z. B. die Anzeige am Beamer dorthin zurück). Ausgenommen
  ist `/api/me`: Das 401 beim Laden des Profils behandelt der Guard selbst, ein zweiter Wechsel würde dessen Adresse überholen. `logout()` meldet mit Provider auch dort ab und gibt zurück, ob die App selbst zur Anmeldeseite wechselt.
- In Tests den Modus mit `loadConfig({ authMode: 'oidc' })` (`testing/config.ts`) setzen und `OIDC_SESSION` durch
  `fakeOidcSession()` (`testing/oidc.ts`) ersetzen.
- Der Admin-Status kommt aus `GET /api/me` (`admin`), durchgesetzt wird er im Backend.
- Tokens und Passwörter nie ins Repo, in Logs oder in URLs schreiben.

## Live-Updates
- `core/events/live-updates.ts` (`LiveUpdates.watch(id)`): holt das Ticket, öffnet den `EventSource`, merkt sich die Event-`id` und
  verbindet sich bei endgültigem Abbruch (`readyState === CLOSED`) mit neuem Ticket und `&lastEventId=` neu (Abstand 3 s,
  verdoppelt bis 30 s). Nach einer Lücke wird zur Sicherheit ein Neuladen gemeldet. Details in der Übergabe, Abschnitt 6.
- `core/events/live-reload.ts` (`liveReload(...)`) im Konstruktor einer Seite aufrufen: lädt bei Events gebündelt (300 ms) neu und
  fragt ersatzweise in Abständen nach, solange der Stream nicht steht. Gibt den Status für `<app-live-badge>` zurück.
- Events enthalten keine Daten, die Seiten laden immer alles neu. Ein Formular, das aus dem geladenen Stand befüllt wird, darf
  dabei ungespeicherte Eingaben nicht verlieren (Beispiel: `TournamentForm`). Den Fortschrittsbalken nur beim ersten Laden zeigen
  (`data.status() === 'loading'`), sonst blinkt er bei jedem Event.
- In Seiten-Tests `controlledLiveUpdates()` oder `noLiveUpdates()` aus `testing/live.ts` bereitstellen, sonst fragt die Seite ein
  Ticket an.
- Token-Erneuerung gibt es noch nicht (kommt mit dem OIDC-Login). Der simulierte Login stellt 8-Stunden-Tokens aus.

## „Du bist dran“ (Hinweise)
- `core/alerts/turn-alerts.ts` (`TurnAlerts`, von der Shell gestartet, solange jemand angemeldet ist): Findet alle laufenden
  Turniere, in denen der Spieler angemeldet ist (`GET /api/tournaments` + Details, alle 60 s), beobachtet jedes über `LiveUpdates`
  und lädt bei Events `…/matches/mine`. Ein Match mit Status `ON_TABLE` ist ein Hinweis (`calls`). Gemeldet (Ton, Vibration,
  Systembenachrichtigung) wird nur, was **neu** an den Tisch kam: Der erste Stand beim Laden und alles, was in `sessionStorage`
  (`kickertool.alert.seen`) schon steht, bleibt still. „Verstanden“ merkt sich `kickertool.alert.dismissed`.
- `core/alerts/alert-effects.ts` (`ALERT_EFFECTS`, in Tests ersetzen): Vibration, Ton (Web Audio, erst nach dem ersten Tippen
  auf die Seite möglich), Systembenachrichtigung nur bei versteckter Seite und erteilter Erlaubnis (über den Service Worker, sonst
  `new Notification`). Echtes Push bei geschlossener App gibt es nicht, das bräuchte das Backend (VAPID, Abos, Versand pro Spieler).
- Anzeige: `features/shell/turn-banner.ts` in der Shell. Partner und Gegner kommen aus `shared/pairing.ts` (auch für Einspringer),
  die Warteschlangen-Angabe aus `shared/queue.ts` (reine Anzeige der Wellen-Regel, das Backend entscheidet).
- Tests: `TurnAlerts` mit gefälschtem `KickerApi`, `LiveUpdates` und `ALERT_EFFECTS` (siehe `turn-alerts.spec.ts`).

## Prüfen vor dem Abschluss
- `npm test` und `npm run build` (Typprüfung und Vorlagen werden beim Bauen geprüft).
- Gegen das lokale Backend durchspielen: Als `admin` das Demo-Turnier starten und eine Runde auslosen, als Spieler ein
  Ergebnis eintragen, als Gegner bestätigen, Rangliste prüfen.

## Windows und PowerShell
- `npm`/`npx` als `npm.cmd`/`npx.cmd` aufrufen, wenn die Ausführungsrichtlinie `.ps1`-Skripte sperrt.
- Quelldateien ohne BOM speichern (Windows PowerShell 5.1 schreibt mit `-Encoding UTF8` ein BOM).
