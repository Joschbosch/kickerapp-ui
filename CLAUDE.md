@AGENTS.md

# Zusätze für Claude Code auf dieser Maschine

Die allgemeinen Projektregeln stehen in `AGENTS.md` (gilt für alle Assistenten). Hier nur, was für Claude Code oder
diesen Rechner gilt.

- Node.js liegt unter `C:\Tools\nodejs`, Git unter `C:\Tools\Git\cmd`. Wenn sie in einer Shell nicht im PATH sind, den PATH aus
  Maschine und Benutzer neu laden. Für Angular-Befehle `NG_CLI_ANALYTICS=false` und `CI=true` setzen (keine Rückfragen).
- Das Backend (`C:\sandbox\kickerapp`) braucht `JAVA_HOME=%USERPROFILE%\.jdks\openjdk-26.0.1`, `scripts\run-local.ps1` findet es selbst.
- Der Auftraggeber will bei Unklarheiten gefragt werden und Annahmen offen genannt bekommen (siehe `AGENTS.md`).
