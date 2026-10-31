# Kickertool UI

Angular-Oberfläche für das [Kickertool](https://github.com/Joschbosch/kickerapp) (Kicker-Turnierverwaltung). Eine
responsive App, installierbar als PWA: Handy für Spieler, Desktop-Web für Admin und Spieler.

Stand: Anmeldung, Turnierliste (markiert, wo man angemeldet ist, lädt sich alle 30 Sekunden neu) und die Spieler-Ansicht
eines Turniers: zum Turnier anmelden, pausieren, ausscheiden, der eigene Stand („Platz 3 von 10“), mein Spiel mit Tisch,
Partner und Gegnern, Ergebnis eintragen (mit Prüfung gegen das Tor-Limit), bestätigen oder ablehnen, Spielzeit-Zähler am Tisch,
Platz in der Warteschlange, alle Tische der Runde und die Rangliste.

**Statistik** (`/statistik`, im Benutzermenü „Meine Statistik“): Summen über alle laufenden und beendeten Turniere (Turniere,
Spiele, Siege/Unentschieden/Niederlagen, Tore, Punkte, Titel, Podestplätze) und der Stand in jedem Turnier mit Link dorthin. Jeder
darf die Statistik jedes Spielers sehen: In der Rangliste führt der Name zu `/statistik/:id`. Es gibt keine Gesamtrangliste über
alle Spieler. Die Zahlen rechnet das Backend (`GET /api/players/{id}/statistics`), die UI zeigt sie nur an.

**„Du bist dran“:** Sobald ein Match des Spielers einem Tisch zugewiesen wird (neue Runde oder die nächste Welle, auch als
Einspringer), erscheint auf jeder Seite der App ein Hinweis mit Tisch, Partner und Gegnern, dazu Vibration, ein Signalton und, wenn
die Seite gerade nicht sichtbar ist, eine Systembenachrichtigung. Im Benutzermenü lässt sich der Ton ausschalten und die
Systembenachrichtigung erlauben. Das funktioniert nur, solange die App im Browser läuft (auch im Hintergrund-Tab), **nicht** bei
geschlossener App oder gesperrtem Handy: Dafür bräuchte es echtes Web-Push mit Unterstützung im Backend.

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

### Test am Handy im lokalen Netz

Das Handy erreicht `localhost` des PCs nicht, alles läuft deshalb über die Adresse des PCs im WLAN (im Folgenden `<PC-Adresse>`, z. B. `192.168.1.20`):

1. `docker compose up -d` im Backend-Repo (Keycloak, Postgres). Der Aussteller im Token ist die Adresse, unter der der Browser
   Keycloak aufruft. Das Backend bekommt genau diese: `KICKERTOOL_OIDC_ISSUER_URI=http://<PC-Adresse>:8180/realms/kickertool`,
   dazu `KICKERTOOL_CORS_ALLOWED_ORIGINS=http://<PC-Adresse>:4200,http://localhost:4200`, dann `.\mvnw.cmd -pl kickertool-bootstrap spring-boot:run`.
   Wechselt der Aussteller (z. B. von `localhost` auf die Adresse), kennt das Backend dieselben Nutzer als neue Spieler: dann
   eine frische Datenbank nehmen (`KICKERTOOL_DB_URL`).
2. `public/config.json`: `apiBaseUrl` und `oidc.authority` auf die Adresse des PCs, `authMode` auf `oidc` und
   `"allowInsecureContext": true` (siehe unten). **Diese Werte nicht committen.**
3. `npx ng serve --host 0.0.0.0 --allowed-hosts`, am Handy `http://<PC-Adresse>:4200` öffnen.
4. Die Windows-Firewall muss die Ports 4200, 8080 und 8180 aus dem lokalen Netz zulassen.

**Warum `allowInsecureContext`:** Der Browser erlaubt `crypto.subtle` (SHA-256 für PKCE) nur über HTTPS oder `localhost`. Am Handy
über `http://<PC-Adresse>:4200` fehlt es, die Anmeldung scheitert. Die Option baut ein SHA-256 in JavaScript ein
(`core/auth/insecure-crypto.ts`). Sie ist standardmäßig aus und gehört nur in Tests im eigenen Netz. Im Betrieb gibt es HTTPS, dann
ist sie nicht nötig. Browser-Benachrichtigungen (Systembenachrichtigung) gibt es über HTTP ebenfalls nicht, Vibration, Ton und der
Hinweis in der App gehen.

## Container und Kubernetes

Die UI ist eine statische App. Das Image (`Dockerfile`) baut sie mit Node und liefert sie mit nginx aus, ohne Root (Benutzer 101),
auf Port 8080, mit schreibgeschütztem Dateisystem lauffähig. Das Image enthält keine Umgebungswerte: Adresse der API und
Anmeldung stehen in `/usr/share/nginx/html/config.json` (Standard: `docker/config.json`, also `localhost`) und werden beim Start
durch die eigene Datei ersetzt, ohne neu zu bauen.

```bash
docker build -t kickertool-ui:0.1.0 .
docker run --rm -p 4200:8080 -v ./config.json:/usr/share/nginx/html/config.json:ro kickertool-ui:0.1.0
```

**Im Cluster** (Chart `helm/kickertool-ui`, nur die UI; Backend, Datenbank und Keycloak kommen aus dem Chart `kickertool` im
Backend-Repo). Pflicht sind die Adressen, unter denen der **Browser** die API und Keycloak erreicht:

```bash
helm install ui helm/kickertool-ui \
  --set config.apiBaseUrl=https://api.turnier.example.com \
  --set config.oidc.authority=https://auth.turnier.example.com/realms/kickertool \
  --set ingress.enabled=true --set ingress.host=turnier.example.com
```

Zum lokalen Ausprobieren (Rancher Desktop) mit dem lokalen Backend-Chart und `port-forward` (Anleitung in
`helm/kickertool-ui/values-local.yaml`):

```bash
helm install ui helm/kickertool-ui -f helm/kickertool-ui/values-local.yaml
kubectl port-forward svc/ui-kickertool-ui 4200:8080     # dann http://localhost:4200
```

- Ohne `config.apiBaseUrl` (und im Modus `oidc` ohne `config.oidc.authority`) bricht die Installation ab.
- Das Backend muss die UI zulassen: ihre Adresse in `app.corsAllowedOrigins` (CORS), in Keycloak als Weiterleitung
  (`<UI>/auth/callback`, `<UI>/abgemeldet`) und als Web-Origin. Die Hinweise nach der Installation (`NOTES.txt`) listen das auf.
- `config.authMode=password` gibt es nur am simulierten Login des lokalen Backends, nie im Betrieb. `config.oidc.allowInsecureContext`
  ist nur für Tests über HTTP im eigenen Netz.
- Die UI ist zustandslos, mehrere Replikas sind unkritisch. Das Backend dagegen hält Live-Updates im Speicher und bleibt bei einer.
- nginx (`docker/default.conf`) liefert die Startseite für jede App-Adresse (`/turniere/42`, `/auth/callback`), `index.html`,
  `config.json` und die Service-Worker-Dateien mit `no-cache` und Dateien mit Hash im Namen ein Jahr lang. Eine Content-Security-Policy
  gibt es nicht, sie hinge von den Adressen der API und von Keycloak ab (am besten am Ingress setzen).

## Gesamtpaket mit einem Befehl (UI, API, PostgreSQL, Keycloak)

Das Chart `helm/kickertool-stack` fasst die Charts der UI und des Backends (Repo `kickerapp`, muss **neben** diesem Repo
ausgecheckt sein) zusammen. Von außen gibt es zwei Adressen: einen Host für UI und API (`/` ist die UI, `/api` die API, also ohne
CORS) und einen für Keycloak. Beide müssen auf den Ingress des Clusters zeigen. Alles andere (Adresse der API in der UI, Aussteller des
Tokens, Weiterleitungen und Web-Origin in Keycloak, Ingress-Hosts, TLS) wird daraus abgeleitet.

```bash
helm dependency update helm/kickertool-stack
helm install kicker helm/kickertool-stack \
  --set global.host=turnier.example.com --set global.authHost=auth.example.com \
  --set global.tls=true --set global.ingressClassName=nginx
```

- Die Images `kickertool` (Backend, `docker build` im Backend-Repo) und `kickertool-ui` (hier) müssen der Cluster erreichen: lokal
  ein `docker build`, sonst in eine Registry schieben und `kickertool.image.repository`, `kickertool-ui.image.repository` setzen.
- Lokal in Rancher Desktop (Traefik): `-f helm/kickertool-stack/values-local.yaml`, dann http://kicker.localhost. Das legt die Testnutzer
  `admin`, `anna`, `ben` (Passwort = Benutzername) an, nur für Tests.
- Einstellungen der Teile stehen unter `kickertool:` (Backend, PostgreSQL, Keycloak) und `kickertool-ui:` (UI), z. B. `kickertool.postgresql.storage.size`
  oder `kickertool.keycloak.registrationAllowed=false`. Die vollständige Liste steht in den `values.yaml` der Teil-Charts.
- Ohne HTTPS gehen die Anmeldung (PKCE braucht `crypto.subtle`) und Systembenachrichtigungen nur über `localhost` und `*.localhost`.
  Im Betrieb `global.tls=true` setzen, das Zertifikat kommt aus `global.tlsSecretName` oder vom Ingress (z. B. cert-manager).
- Keycloak importiert den Realm nur beim ersten Start. Spätere Änderungen an Weiterleitungen oder Rollen macht man in der Keycloak-Konsole.
- Für die Live-Updates (Server-Sent Events) hinter nginx die Annotationen `proxy-buffering: "off"` und ein langes `proxy-read-timeout`
  setzen (`kickertool.ingress.annotations`), das Backend bleibt bei einer Instanz.
- Die Unter-Charts (`helm/kickertool-stack/charts/`) und `Chart.lock` entstehen mit `helm dependency update` und sind nicht eingecheckt.

## Weiterarbeiten

Regeln für Entwickler und Assistenten stehen in [AGENTS.md](AGENTS.md).
