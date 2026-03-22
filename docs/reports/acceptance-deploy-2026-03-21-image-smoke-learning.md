# Acceptance-Deploy-Learning vom 21.03.2026

## Kontext

- Zielsystem: `https://hb-meinquartier.studio.smart-village.app`
- Zielartefakt: `ghcr.io/pwilimzig/sva-studio@sha256:b5099240164fa8a1269ef08388d422e14666484c7074a390c403ce246deeb49a`
- Release-Modus: `app-only`
- Ausgefuehrte Reports:
  - `artifacts/runtime/deployments/acceptance-deploy-2026-03-21T13-26-59-966Z.json`
  - `artifacts/runtime/deployments/acceptance-deploy-2026-03-21T13-29-24-398Z.json`

## Ergebnis

- Es wurde kein produktiver Stack-Rollout auf `acceptance-hb` ausgefuehrt.
- Beide Deploy-Laeufe wurden korrekt vor dem `deploy`-Schritt im Gate `image-smoke` gestoppt.
- Der zweite Lauf hat die eigentliche Root Cause sichtbar gemacht:
  - `SVA_AUTH_STATE_SECRET` fehlt fuer das produktionsnahe Image.
  - Der Container beendet sich deshalb direkt mit `ExitCode=1`.

## Technische Learnings

1. Der bisherige Quantum-`exec`-Pfad erzeugt TTY-/Websocket-Rauschen und abgeschnittene Marker.
   - Folge: `schema-guard` war zuvor ein falscher Blocker.
   - Repo-Nacharbeit: Output-Sanitisierung und Recovery fuer `schema-guard` wurden in `scripts/ops/runtime-env.ts` gehaertet.

2. Der bisherige `image-smoke`-Pfad war diagnostisch zu schwach.
   - Folge: Der erste Lauf verlor wegen `--rm` die eigentliche Container-Ursache.
   - Repo-Nacharbeit: `image-smoke` wartet jetzt auf `/health/live`, behaelt den Container bis zur Auswertung und schreibt `docker inspect`-State plus Logs in die Fehlermeldung.

3. Der Runtime-Vertrag war unvollstaendig.
   - Folge: `environment-precheck` hat `SVA_AUTH_STATE_SECRET` nicht als Pflichtvariable erkannt.
   - Repo-Nacharbeit: `packages/sdk/src/runtime-profile.ts` behandelt `SVA_AUTH_STATE_SECRET` jetzt als Pflichtvariable fuer Keycloak-gestuetzte Profile und damit auch fuer `acceptance-hb`.

## Operative Bewertung

- Der Releasepfad hat korrekt verhindert, dass ein nicht startfaehiges Artefakt in den Acceptance-Stack ausgerollt wird.
- Die positive Feedback-Schleife hat funktioniert:
  - erster Lauf liefert das Symptom,
  - Repo-Haertung verbessert die Evidenz,
  - zweiter Lauf liefert die eigentliche Root Cause,
  - der Runtime-Vertrag wurde danach direkt verschaerft.

## Verbindliche Nacharbeit

- `acceptance-hb.local.vars` oder die entsprechende Secret-Quelle muss `SVA_AUTH_STATE_SECRET` konsistent bereitstellen.
- Nach dem Nachziehen des Secrets ist derselbe Digest erneut durch `env:deploy:acceptance-hb` zu fahren.
- Der naechste Lauf muss danach wieder mit `pnpm env:feedback:acceptance-hb` ausgewertet werden.
