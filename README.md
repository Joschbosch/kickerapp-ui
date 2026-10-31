# Kickertool UI

Angular-Oberfläche für das [Kickertool](https://github.com/Joschbosch/kickerapp) (Kicker-Turnierverwaltung). Eine
responsive App, installierbar als PWA: Handy für Spieler, Desktop-Web für Admin und Spieler.

Stand: Anmeldung, Turnierliste und die Spieler-Ansicht eines Turniers (zum Turnier anmelden, pausieren, ausscheiden,
mein Spiel mit Tisch und Teams, Ergebnis eintragen, bestätigen oder ablehnen, Rangliste). Die Seite lädt nach jeder
Aktion neu und über die Schaltfläche „Aktualisieren“, automatische Aktualisierung (Live-Updates) fehlt noch.

Admin-Ansicht (nur mit Admin-Rolle, `/admin`): Turnier anlegen, Name, Datum und Konfiguration ändern (auch im laufenden
Turnier), starten, Runden auslosen, beenden (mit Rückfrage), Spieler anmelden, abmelden, pausieren oder ausscheiden lassen,
Ergebnisse festlegen und korrigieren (Streitfälle sind hervorgehoben). Dazu die Anzeige `/anzeige/:id` für weitere
Bildschirme: Rangliste und Tische in großer Schrift ohne Menü, fragt alle 15 Sekunden neu ab.

Als Nächstes: Live-Updates (ersetzen die Abfrage alle 15 Sekunden), Token-Erneuerung, OIDC-Anmeldung.

## Schnellstart

Voraussetzungen: Node.js 22 oder neuer, für das Backend JDK 21 oder neuer.

1. Backend lokal starten (im Backend-Repo `kickerapp`): `./scripts/run-local.sh`, unter Windows `.\scripts\run-local.ps1`.
   Das startet die API auf http://localhost:8080 mit simuliertem Login und einem Demo-Turnier.
2. UI starten:

   ```bash
   npm install
   npm start
   ```

3. http://localhost:4200 öffnen und anmelden. Benutzername und Passwort sind gleich: `admin` (Admin), `anna`, `ben`,
   `clara`, `david`, `emma`, `felix`, `greta`, `hans`, `ida`, `jonas`.

## Befehle

| Befehl                | Wirkung                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `npm start`           | Entwicklungsserver auf Port 4200                                             |
| `npm test`            | Tests (Vitest), einmalig mit `npm test -- --no-watch`                        |
| `npm run build`       | Produktions-Build nach `dist/kickertool-ui` (mit Service Worker)             |
| `npm run api:sync`    | Vertrag aus `../kickerapp/docs/openapi.json` übernehmen und Typen erzeugen   |

## Einstellungen

`public/config.json` wird beim Start geladen und kann nach dem Bauen ausgetauscht werden:

```json
{ "apiBaseUrl": "http://localhost:8080", "authMode": "password" }
```

- `apiBaseUrl`: Adresse des Backends. Das Backend muss die Herkunft der UI freigeben (`KICKERTOOL_CORS_ALLOWED_ORIGINS`).
- `authMode`: `password` (Formular am simulierten Login des lokalen Backends, nur Entwicklung), später `oidc`.

## Weiterarbeiten

Regeln für Entwickler und Assistenten stehen in [AGENTS.md](AGENTS.md).
