# Kickertool UI

Angular-Oberfläche für das [Kickertool](https://github.com/Joschbosch/kickerapp) (Kicker-Turnierverwaltung). Eine
responsive App, installierbar als PWA: Handy für Spieler, Desktop-Web für Admin und Spieler.

Stand: Anmeldung, Turnierliste und die Spieler-Ansicht eines Turniers (zum Turnier anmelden, pausieren, ausscheiden,
mein Spiel mit Tisch und Teams, Ergebnis eintragen, bestätigen oder ablehnen, Rangliste).

Live-Updates: Spieler-Seite, Admin-Seite und Anzeige lösen sich bei jeder Änderung des Turniers von selbst neu (Server-Sent
Events mit Ticket, `core/events/`). Ein Abzeichen zeigt „Live“, „Verbinde …“ oder „Offline“. Ohne Verbindung fragt die Seite in
Abständen nach (30 Sekunden, die Anzeige 15 Sekunden), die Schaltfläche „Aktualisieren“ bleibt.

Admin-Ansicht (nur mit Admin-Rolle, `/admin`): Turnier anlegen, Name, Datum und Konfiguration ändern (auch im laufenden
Turnier), starten, Runden auslosen, beenden (mit Rückfrage), Spieler anmelden, abmelden, pausieren oder ausscheiden lassen,
Ergebnisse festlegen und korrigieren (Streitfälle sind hervorgehoben). Dazu die Anzeige `/anzeige/:id` für weitere
Bildschirme: Rangliste und Tische in großer Schrift ohne Menü.

Anmeldung: Entwicklung mit Formular am simulierten Login des lokalen Backends (`authMode: password`), sonst über einen
OIDC-Provider wie Keycloak (`authMode: oidc`, Authorization Code mit PKCE). Das Token wird mit dem Refresh-Token
rechtzeitig vor Ablauf von selbst erneuert, auch in Fenstern, die stundenlang offen sind (Anzeige, Admin). Neu geöffnete
Fenster melden sich beim Provider ohne Eingabe an, solange dessen Sitzung läuft.

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
{
  "apiBaseUrl": "http://localhost:8080",
  "authMode": "password",
  "oidc": { "authority": "http://localhost:8180/realms/kickertool", "clientId": "kickertool-app" }
}
```

- `apiBaseUrl`: Adresse des Backends. Das Backend muss die Herkunft der UI freigeben (`KICKERTOOL_CORS_ALLOWED_ORIGINS`).
- `authMode`: `password` (Formular am simulierten Login des lokalen Backends, nur Entwicklung) oder `oidc`.
- `oidc.authority`: Adresse des Realms, genau so, wie sie im Token als Aussteller (`iss`) steht und das Backend sie kennt
  (`KICKERTOOL_OIDC_ISSUER_URI`). `oidc.clientId`: öffentlicher Client ohne Secret.

### Anmeldung mit Keycloak

Im Backend-Repo startet `docker compose up -d` Keycloak (Port 8180, Realm `kickertool`, Nutzer `admin`/`admin`, `anna`/`anna`,
`ben`/`ben`) und PostgreSQL, das Backend läuft dann ohne lokalen Modus
(`KICKERTOOL_CORS_ALLOWED_ORIGINS=http://localhost:[*]`). In `public/config.json` `"authMode": "oidc"` setzen.

Am Client müssen für die Adresse der UI (hier `https://kicker.example.org`) freigegeben sein (Standard-Realm: alles):

- Gültige Weiterleitungs-URI: `https://kicker.example.org/auth/callback`
- Gültige Weiterleitungs-URI nach dem Abmelden: `https://kicker.example.org/abgemeldet`
- Web-Origin: `https://kicker.example.org` (für den Austausch des Codes und die Erneuerung)
- Client öffentlich, PKCE `S256`, Standard-Flow an. Ein Refresh-Token liefert Keycloak dabei mit.

## Weiterarbeiten

Regeln für Entwickler und Assistenten stehen in [AGENTS.md](AGENTS.md).
