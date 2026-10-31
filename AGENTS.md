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
- `core/`: Konfiguration (`app-config.ts`) und Anmeldung (`auth/`: Service, Interceptor, Guards).
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
- Produktion (`authMode: oidc`, noch nicht umgesetzt): OIDC mit Authorization Code und PKCE, Client `kickertool-app`
  (öffentlich, kein Secret). Beides bleibt hinter `AuthService`.
- Jeder Aufruf schickt `Authorization: Bearer <access_token>` (Interceptor). Bei 401 wird abgemeldet.
- Der Admin-Status kommt aus `GET /api/me` (`admin`), durchgesetzt wird er im Backend.
- Tokens und Passwörter nie ins Repo, in Logs oder in URLs schreiben.

## Live-Updates (noch nicht umgesetzt)
- Der Browser-`EventSource` kann keinen Authorization-Header senden. Ablauf: `POST /api/tournaments/{id}/events/ticket` mit dem
  Token, dann `new EventSource(BACKEND + streamUrl)` (Ticket in der Adresse). Details in der Übergabe, Abschnitt 6.
- Die Events enthalten keine Daten, die UI lädt nach einem Event neu. Jedes Event hat eine `id`: merken und beim erneuten
  Verbinden als `&lastEventId=` anhängen. Ein `RESYNC` heißt: alles neu laden.
- Tabellen-Bildschirme laufen stundenlang: Token erneuern, bei Abbruch (`readyState === CLOSED`) mit neuem Ticket neu verbinden.

## Prüfen vor dem Abschluss
- `npm test` und `npm run build` (Typprüfung und Vorlagen werden beim Bauen geprüft).
- Gegen das lokale Backend durchspielen: Als `admin` das Demo-Turnier starten und eine Runde auslosen, als Spieler ein
  Ergebnis eintragen, als Gegner bestätigen, Rangliste prüfen.

## Windows und PowerShell
- `npm`/`npx` als `npm.cmd`/`npx.cmd` aufrufen, wenn die Ausführungsrichtlinie `.ps1`-Skripte sperrt.
- Quelldateien ohne BOM speichern (Windows PowerShell 5.1 schreibt mit `-Encoding UTF8` ein BOM).
