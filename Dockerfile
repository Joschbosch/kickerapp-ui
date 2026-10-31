# syntax=docker/dockerfile:1

# ---- Build: Angular-Produktions-Build (Tests laufen vorher mit `npm test`, nicht beim Image-Bau) ----
FROM node:22-alpine AS build
WORKDIR /workspace
ENV NG_CLI_ANALYTICS=false

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY angular.json tsconfig.json tsconfig.app.json ngsw-config.json ./
COPY public public
COPY src src
RUN npx ng build --configuration production

# ---- Laufzeit: nginx ohne Root, liefert die statischen Dateien aus ----
# Das Image enthält keine umgebungsspezifischen Werte. Die Einstellungen stehen in /usr/share/nginx/html/config.json
# (Adresse der API, Anmeldung). Im Cluster ersetzt das Helm-Chart die Datei durch eine ConfigMap, mit Docker pur geht
# `-v ./config.json:/usr/share/nginx/html/config.json:ro`.
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /workspace/dist/kickertool-ui/browser/ /usr/share/nginx/html/
COPY docker/config.json /usr/share/nginx/html/config.json

# Benutzer 101 (nginx), Port 8080
EXPOSE 8080
