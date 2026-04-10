# Studio Rollout Hardening Status 2026-04-09

## Zusammenfassung

Am 9. April 2026 wurde der neue job-basierte Remote-Mutationspfad fuer `studio` weiter verhaertet und produktionsnah getestet. Der zentrale Fortschritt ist erreicht:

- der temp-stack-basierte `migrate`-Pfad laeuft inzwischen stabil und ohne Seiteneffekte auf den Live-Stack,
- der Live-Stack `studio` bleibt durch die Job-Ausfuehrung unangetastet,
- der verbleibende Blocker ist jetzt klar auf den dedizierten `bootstrap`-Job eingegrenzt.

Damit ist das Problem nicht mehr `goose`, nicht mehr `quantum-cli exec` als Migrationspfad und auch nicht mehr ein ungewollter Stack-Reconcile von `studio_app`. Offen ist nur noch die fachliche Ursache innerhalb des Bootstrap-SQL-Pfads.

## Zielbild und aktueller Stand

Zielbild:

1. `precheck`
2. `migrate`-Job im temp Stack
3. `bootstrap`-Job im temp Stack
4. `schema-and-app`-Rollout
5. `smoke` und `precheck`

Aktueller Stand:

- `migrate` im temp Stack: funktioniert
- `bootstrap` im temp Stack: schlaegt weiterhin mit `exitCode=1` fehl
- `app-only`-/Live-Rolloutpfad: gehaertet, aber fuer den neuen Ziel-Digest noch nicht erneut produktiv durchgezogen
- Soll-/Ist-Konvergenz: noch nicht abgeschlossen, weil der neue App-Digest noch nicht bewusst live ausgerollt wurde

## Umgesetzte Aenderungen

### 1. Rollout-Hardening und Architekturvertrag

Folgende Dokumentation und Spezifikation wurden fuer den neuen Rolloutvertrag erweitert:

- [proposal.md](/Users/wilimzig/Documents/Projects/SVA/sva-studio/openspec/changes/update-studio-rollout-network-consistency/proposal.md)
- [design.md](/Users/wilimzig/Documents/Projects/SVA/sva-studio/openspec/changes/update-studio-rollout-network-consistency/design.md)
- [tasks.md](/Users/wilimzig/Documents/Projects/SVA/sva-studio/openspec/changes/update-studio-rollout-network-consistency/tasks.md)
- [07-deployment-view.md](/Users/wilimzig/Documents/Projects/SVA/sva-studio/docs/architecture/07-deployment-view.md)
- [08-cross-cutting-concepts.md](/Users/wilimzig/Documents/Projects/SVA/sva-studio/docs/architecture/08-cross-cutting-concepts.md)
- [runtime-profile-betrieb.md](/Users/wilimzig/Documents/Projects/SVA/sva-studio/docs/development/runtime-profile-betrieb.md)

### 2. Technische Härtung des Remote-Pfads

Wesentliche Runtime-Aenderungen:

- Job-basierter `migrate`/`bootstrap`-Pfad ueber temporaere Swarm-Stacks statt ueber `quantum-cli exec`
- Isolierung von Live-Stack und Temp-Job-Stacks
- zusaetzliche Ingress-/Live-Spec-Konsistenzpruefung im Precheck
- Vergleich der Live-Service-Spec von `studio_app` gegen den gerenderten Soll-Vertrag

Relevante Dateien:

- [runtime-env.ts](/Users/wilimzig/Documents/Projects/SVA/sva-studio/scripts/ops/runtime-env.ts)
- [migration-job.ts](/Users/wilimzig/Documents/Projects/SVA/sva-studio/scripts/ops/runtime/migration-job.ts)
- [bootstrap-job.ts](/Users/wilimzig/Documents/Projects/SVA/sva-studio/scripts/ops/runtime/bootstrap-job.ts)
- [remote-service-spec.ts](/Users/wilimzig/Documents/Projects/SVA/sva-studio/scripts/ops/runtime/remote-service-spec.ts)
- [deploy-project.ts](/Users/wilimzig/Documents/Projects/SVA/sva-studio/scripts/ops/runtime/deploy-project.ts)

### 3. Bootstrap-Haertung

Der Bootstrap-Entrypoint wurde in mehreren Schritten verbessert:

- App-Role-Reconcile kann fuer Remote-Bootstrap deaktiviert werden
- bestehende `is_primary=true`-Hostnames derselben Instanz werden vor dem Upsert zurueckgesetzt
- neue Diagnose-Schalter erlauben die getrennte Isolierung von:
  - Schema-Guard
  - Instanz-Reconcile
  - Hostname-Guard

Relevante Dateien:

- [bootstrap-entrypoint.sh](/Users/wilimzig/Documents/Projects/SVA/sva-studio/deploy/portainer/bootstrap-entrypoint.sh)
- [docker-compose.studio.yml](/Users/wilimzig/Documents/Projects/SVA/sva-studio/deploy/portainer/docker-compose.studio.yml)
- [docker-compose.yml](/Users/wilimzig/Documents/Projects/SVA/sva-studio/deploy/portainer/docker-compose.yml)

### 4. Polling-/Task-Auswertung gefixt

Ein echter Fehler im Job-Polling wurde beseitigt:

- bereits normalisierte Task-Snapshots wurden bisher erneut als rohe Quantum-Tasks behandelt
- dadurch erkannte das Polling Terminalzustaende nicht sauber
- Folge war ein scheinbar haengender `env:migrate:studio`-Lauf

Der Fix liegt in:

- [migration-job.ts](/Users/wilimzig/Documents/Projects/SVA/sva-studio/scripts/ops/runtime/migration-job.ts)
- [migration-job.test.ts](/Users/wilimzig/Documents/Projects/SVA/sva-studio/packages/sdk/tests/migration-job.test.ts)

## Verifizierte Ergebnisse

### Lokale Checks

Folgende Checks liefen erfolgreich:

- `bash -n deploy/portainer/bootstrap-entrypoint.sh`
- `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
- `pnpm nx run sdk:test:unit --skip-nx-cache -- --reporter=dot packages/sdk/tests/bootstrap-job.test.ts packages/sdk/tests/migration-job.test.ts`

### Produktionsnahe Runtime-Tests

Verifiziert:

- `env:migrate:studio` startet einen temporaeren `migrate`-Stack
- der `migrate`-Task laeuft bis zum Ende durch
- der temporaere `migrate`-Stack wird wieder entfernt
- `studio_app`, `postgres` und `redis` im Live-Stack werden dabei nicht reconciled

Nicht erfolgreich:

- der nachgelagerte `bootstrap`-Temp-Stack endet weiterhin mit:
  - `state=failed`
  - `exitCode=1`
  - `message=started`

## Aktueller Ziel-Digest

Der aktuell konfigurierte Zielstand fuer `studio` wurde auf folgenden Digest gesetzt:

- `ghcr.io/smart-village-solutions/sva-studio@sha256:27ec595d2cc5baf6ad5150c57ae3c7760063cf6109f7daba5984723419c8424b`
- Tag: `bootstrap-hostname-reconcile-20260409-190537-b680461`

Konfigurationsdatei:

- [studio.local.vars](/Users/wilimzig/Documents/Projects/SVA/sva-studio/config/runtime/studio.local.vars)

Wichtig:

- Dieser Digest ist als Soll-Zustand konfiguriert.
- Ein kontrollierter produktiver `app-only`-Rollout auf genau diesen Digest ist zum Stand dieses Reports noch nicht abgeschlossen.
- Damit ist die Soll-/Ist-Konvergenz weiterhin offen.

## Offener Blocker

Der verbleibende Blocker liegt ausschliesslich im Bootstrap-Job.

Was bereits ausgeschlossen werden konnte:

- `goose` als Ursache
- der alte `quantum-cli exec`-Migrationspfad
- ungewollte Stack-Updates von `studio_app` waehrend `env:migrate:studio`
- fehlende Grundrechte des DB-Users `sva`
- der Polling-/Terminal-State-Bug im Job-Orchestrator

Was weiterhin wahrscheinlich ist:

- ein fachlicher Fehler in genau einem der drei Bootstrap-Teilbereiche:
  - Schema-Guard
  - Instanz-Reconcile fuer `iam.instances`
  - Hostname-Reconcile bzw. Hostname-Guard fuer `iam.instance_hostnames`

## Nächster sinnvoller Schritt

Der naechste Schritt ist kein weiterer Volltest auf Verdacht, sondern ein gezielter Diagnose-Lauf mit den bereits eingebauten Schaltern:

1. Bootstrap nur mit `schema_guard`
2. Bootstrap nur mit `instance`-/`hostname`-Reconcile
3. Bootstrap mit Hostname-Guard separat

Ziel:

- den fehlschlagenden fachlichen Teil eindeutig isolieren
- danach nur diesen SQL-Pfad korrigieren
- anschliessend erneut:
  - `pnpm env:migrate:studio`
  - `pnpm env:deploy:studio -- --release-mode=schema-and-app`
  - `pnpm env:smoke:studio`
  - `pnpm env:precheck:studio`

## Wiedereinstieg

Fuer die naechste Sitzung sind diese Punkte der beste Einstieg:

1. Debug-Image mit den neuen Bootstrap-Diagnose-Schaltern fertigstellen oder den zuletzt gebauten Debug-Stand verwenden.
2. Den Bootstrap-Job mit den neuen Env-Schaltern isoliert laufen lassen.
3. Den fehlernden Teil auf SQL-Ebene korrigieren.
4. Erst danach den kontrollierten produktiven `app-only`-Rollout auf den konfigurierten Ziel-Digest durchziehen.

Der entscheidende Befund fuer die weitere Arbeit lautet:

`migrate` ist jetzt technisch stabil. Die Restarbeit ist ein isoliertes Bootstrap-Problem.
