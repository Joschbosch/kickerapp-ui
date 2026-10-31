{{/* Name des Charts, ggf. überschrieben */}}
{{- define "kickertool-ui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Voller Name: Release und Chart, ohne Doppelung */}}
{{- define "kickertool-ui.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "kickertool-ui.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "kickertool-ui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kickertool-ui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "kickertool-ui.labels" -}}
helm.sh/chart: {{ include "kickertool-ui.chart" . }}
{{ include "kickertool-ui.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "kickertool-ui.image" -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) }}
{{- end }}

{{/*
Gemeinsame Adressen aus dem Gesamt-Chart (global.host, global.authHost, global.realm, global.tls, global.tlsSecretName). Sie
ersetzen nur, was nicht selbst gesetzt ist (config.apiBaseUrl, config.oidc.authority, ingress.host). Ohne sie bleibt alles beim Alten.
*/}}
{{- define "kickertool-ui.scheme" -}}
{{- if (default dict .Values.global).tls }}https{{ else }}http{{ end }}
{{- end }}

{{- define "kickertool-ui.ingressHost" -}}
{{- default (default dict .Values.global).host .Values.ingress.host }}
{{- end }}

{{/* TLS-Abschnitt des Ingress (als YAML): eigene Angabe, sonst aus global.tls, sonst leer */}}
{{- define "kickertool-ui.ingressTls" -}}
{{- $g := default dict .Values.global }}
{{- if .Values.ingress.tls }}
{{- toYaml .Values.ingress.tls }}
{{- else if $g.tls }}
{{- $entry := dict "hosts" (list (include "kickertool-ui.ingressHost" .)) }}
{{- with $g.tlsSecretName }}{{ $_ := set $entry "secretName" . }}{{ end }}
{{- toYaml (list $entry) }}
{{- end }}
{{- end }}

{{- define "kickertool-ui.apiBaseUrl" -}}
{{- $g := default dict .Values.global }}
{{- if .Values.config.apiBaseUrl }}{{ .Values.config.apiBaseUrl }}{{ else if $g.host }}{{ printf "%s://%s" (include "kickertool-ui.scheme" .) $g.host }}{{ end }}
{{- end }}

{{- define "kickertool-ui.authority" -}}
{{- $g := default dict .Values.global }}
{{- if .Values.config.oidc.authority }}{{ .Values.config.oidc.authority }}{{ else if $g.authHost }}{{ printf "%s://%s/realms/%s" (include "kickertool-ui.scheme" .) $g.authHost (default "kickertool" $g.realm) }}{{ end }}
{{- end }}

{{/*
Der Inhalt von config.json. Ohne API-Adresse (und im Modus oidc ohne Aussteller) bricht die Installation ab:
Sonst käme eine UI heraus, die im Browser ins Leere ruft.
*/}}
{{- define "kickertool-ui.configJson" -}}
{{- $cfg := .Values.config }}
{{- $apiBaseUrl := required "config.apiBaseUrl (oder global.host) ist nötig: die Adresse der API, wie der Browser sie aufruft" (include "kickertool-ui.apiBaseUrl" .) }}
{{- if not (has $cfg.authMode (list "oidc" "password")) }}
{{- fail "config.authMode muss oidc oder password sein" }}
{{- end }}
{{- $out := dict "apiBaseUrl" (trimSuffix "/" $apiBaseUrl) "authMode" $cfg.authMode }}
{{- if eq $cfg.authMode "oidc" }}
{{- $oidc := dict "authority" (required "config.oidc.authority (oder global.authHost) ist nötig, wenn authMode=oidc" (include "kickertool-ui.authority" .)) "clientId" $cfg.oidc.clientId }}
{{- if $cfg.oidc.allowInsecureContext }}
{{- $_ := set $oidc "allowInsecureContext" true }}
{{- end }}
{{- $_ := set $out "oidc" $oidc }}
{{- end }}
{{- toPrettyJson $out }}
{{- end }}
