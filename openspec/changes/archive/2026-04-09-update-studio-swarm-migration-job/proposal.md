# Change: Swarm-Jobs für Migration und Bootstrap einführen

## Why

Der bisherige Remote-Migrations- und Post-Migration-Bootstrap-Pfad für `acceptance-hb` und `studio` hängt an `quantum-cli exec`, Marker-Parsing und ad-hoc bereitgestellten SQL-Dateien. Das ist betrieblich fragil und führt regelmäßig zu Fehlinterpretationen zwischen Transportfehlern und echten Schemafehlern.

## What Changes

- Remote-Migrationen werden aus `runtime/goose.ts` als `exec`-/Upload-Pfad herausgelöst.
- `goose` bleibt die Migrationsengine, läuft aber für `schema-and-app` und `env:migrate:*` in einem dedizierten Swarm-One-off-Job.
- Der nachgelagerte DB-Bootstrap für App-User, Grants und Instanz-Seeding läuft ebenfalls als dedizierter Swarm-One-off-Job.
- Das Runtime-Image enthält zusätzlich die Goose-Wrapper- und Migrationsdateien sowie separate Entrypoints `migrate-entrypoint.sh` und `bootstrap-entrypoint.sh`.
- Deploy-Reports erfassen zusätzlich Job-Metadaten für Migrations- und Bootstrap-Lauf.
- Die Betriebs- und Architekturdokumentation wird auf den neuen Ablauf `precheck -> migrate-job -> bootstrap-job -> schema-assertions -> app-rollout -> verify -> smoke` aktualisiert.
- Dieser Change bildet die technische Grundlage fuer nachgelagerte Rollout-Haertungen; spaetere Changes duerfen die neue Job-Mechanik nutzen, aber nicht erneut definieren.

## Folge-Changes und Abgrenzung

Die nachgelagerten Rollout-Changes bauen auf diesem Vertrag auf und bleiben bewusst in ihrem jeweiligen Teilproblem:

- `update-quantum-ops-decoupling` nutzt die bestehende Job-Mechanik und begrenzt nur Diagnose- sowie Operator-Kanaele.
- `update-studio-rollout-network-consistency` ergaenzt nur Netzwerk-, Ingress- und Recovery-Regeln rund um den bestehenden Job-Pfad.
- `update-studio-operational-drift-controls` erweitert nur Gate-, Drift- und Reconcile-Vertraege auf Basis des bestehenden Rolloutpfads.
- `add-tenant-realm-auth-routing` nutzt die stabile Rollout-Basis, ohne Migration oder Bootstrap erneut zu definieren.

## Impact

- Affected specs: `deployment-topology`, `architecture-documentation`
- Affected code: `deploy/portainer/*`, `scripts/ops/runtime-env.ts`, `scripts/ops/runtime/migration-job.ts`, `scripts/ops/runtime/bootstrap-job.ts`, `scripts/ops/runtime-env.shared.ts`
- Affected arc42 sections: `07-deployment-view`, `08-cross-cutting-concepts`
- Operativer Restblocker: Der Change gilt erst dann fachlich als abgeschlossen, wenn der `bootstrap`-Job fuer `studio` nicht mehr mit `exitCode=1` scheitert, der fehlernde SQL-Pfad korrigiert ist und die Kette `pnpm env:migrate:studio` -> kontrollierter Rollout (`schema-and-app` oder bewusst freigegebener `app-only`-Schritt) -> `pnpm env:smoke:studio` -> `pnpm env:precheck:studio` erfolgreich nachgewiesen ist. Der massgebliche Arbeitsstand dafuer liegt in `docs/reports/studio-rollout-hardening-status-2026-04-09.md`.
