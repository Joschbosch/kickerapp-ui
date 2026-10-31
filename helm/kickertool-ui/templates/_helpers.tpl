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
Der Inhalt von config.json. Ohne API-Adresse (und im Modus oidc ohne Aussteller) bricht die Installation ab:
Sonst käme eine UI heraus, die im Browser ins Leere ruft.
*/}}
{{- define "kickertool-ui.configJson" -}}
{{- $cfg := .Values.config }}
{{- $apiBaseUrl := required "config.apiBaseUrl ist nötig (Adresse der API, wie der Browser sie aufruft)" $cfg.apiBaseUrl }}
{{- if not (has $cfg.authMode (list "oidc" "password")) }}
{{- fail "config.authMode muss oidc oder password sein" }}
{{- end }}
{{- $out := dict "apiBaseUrl" (trimSuffix "/" $apiBaseUrl) "authMode" $cfg.authMode }}
{{- if eq $cfg.authMode "oidc" }}
{{- $oidc := dict "authority" (required "config.oidc.authority ist nötig, wenn authMode=oidc" $cfg.oidc.authority) "clientId" $cfg.oidc.clientId }}
{{- if $cfg.oidc.allowInsecureContext }}
{{- $_ := set $oidc "allowInsecureContext" true }}
{{- end }}
{{- $_ := set $out "oidc" $oidc }}
{{- end }}
{{- toPrettyJson $out }}
{{- end }}
