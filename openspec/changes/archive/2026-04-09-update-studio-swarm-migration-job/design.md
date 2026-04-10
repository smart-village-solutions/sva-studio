## Kontext

`goose` ist im Repo etabliert und fachlich passend. Die Betriebsprobleme entstehen nicht durch das Migrationstool selbst, sondern durch den aktuellen Remote-Transport über `quantum-cli exec`, Marker-Parsing und Inline-SQL-Uploads sowohl für das Schema als auch für den nachgelagerten DB-Bootstrap.

## Ziele

- `goose` im Projekt behalten
- denselben Runtime-Image-Digest für App und Migration verwenden
- denselben Runtime-Image-Digest auch für den Post-Migration-Bootstrap verwenden
- App-Rollout strikt von Schema-Rollout und Bootstrap trennen
- Migrations- und Bootstrap-Fehler über Exit-Code und Post-Migration-Assertions bewerten

## Nicht-Ziele

- kein Toolwechsel auf Flyway, Liquibase oder Atlas
- keine Änderung am lokalen Migrationspfad `packages/data/scripts/run-migrations.sh`
- keine Erweiterung auf destruktive oder nicht-rückwärtskompatible Rollback-Migrationen
- kein dritter Probe-Job in diesem Change; Verify bleibt zunächst auf HTTP- und Swarm-Statussignalen

## Entscheidungen

- Remote-Migrationen laufen als dedizierter One-off-Service `migrate` mit `replicas: 0` im Basis-Compose.
- Der Post-Migration-Bootstrap läuft als dedizierter One-off-Service `bootstrap` mit `replicas: 0` im Basis-Compose.
- Die Runtime-CLI rendert daraus ein temporäres Quantum-Projekt mit eigenem Job-Stack, damit der App-Service vor erfolgreicher Migration nicht aktualisiert wird.
- Der Job verbindet sich über das bestehende Overlay-Netzwerk `<stack>_internal` mit dem laufenden Postgres `<stack>_postgres`.
- `schema-guard` und der Hostname-Mapping-Check bleiben autoritative Post-Migration-Gates.
- Diese Job-Mechanik ist die verbindliche Grundlage fuer nachgelagerte Rollout-Changes; Folge-Changes duerfen sie voraussetzen, aber nicht erneut spezifizieren.
- `update-quantum-ops-decoupling` beschraenkt sich auf Read-only-Diagnostik und Operator-Kontext.
- `update-studio-rollout-network-consistency` beschraenkt sich auf Netzwerk-, Ingress- und Recovery-Vertrag rund um den bestehenden Job-Pfad.
- `update-studio-operational-drift-controls` beschraenkt sich auf zusaetzliche Gate-, Drift- und Reconcile-Vertraege auf Basis desselben Rolloutpfads.
- `add-tenant-realm-auth-routing` nutzt die vorhandene Rollout-Basis, ohne Migration oder Bootstrap neu zu entwerfen.

## Risiken / Trade-offs

- Remote-Job-Logs sind über `quantum-cli` nur eingeschränkt zugänglich; der Deploy-Report speichert deshalb zunächst Job-Metadaten, Exit-Code und Task-Zusammenfassung.
- Der Job-Stack benötigt Zugriff auf das bestehende interne Overlay-Netzwerk des Ziel-Stacks.
- Der Bootstrap-Job benötigt zusätzlich Runtime-Konfiguration für App-DB-User und Instanz-Allowlist, ohne dass diese Werte im Report landen dürfen.

## Migration Plan

1. Runtime-Image um Goose-Assets und Migrations-Entrypoint erweitern.
2. Compose-Dateien um `migrate` und `bootstrap` ergänzen.
3. Runtime-CLI auf `migration-job.ts` und `bootstrap-job.ts` umstellen.
4. Verify von `quantum-cli exec` auf Swarm-/HTTP-Signale umstellen.
5. Report- und Doku-Pfade aktualisieren.
6. OpenSpec validieren.

## Offener fachlicher Rest

Die mechanische Umstellung auf dedizierte `migrate`- und `bootstrap`-Jobs ist umgesetzt. Fachlich abgeschlossen ist der Change jedoch erst, wenn der `bootstrap`-Pfad fuer `studio` erfolgreich durchlaeuft.

- Massgeblicher Arbeitsstand und Evidenz liegen in `docs/reports/studio-rollout-hardening-status-2026-04-09.md`.
- Der verbleibende Rest umfasst die isolierte Diagnose des fehlschlagenden Bootstrap-Teilpfads, die Korrektur des betroffenen SQL-Pfads und den anschliessenden Erfolgsnachweis fuer `pnpm env:migrate:studio` inklusive `bootstrap`.
- Danach folgt ein kontrollierter Rollout auf den Ziel-Digest mit erfolgreichem `pnpm env:smoke:studio`- und `pnpm env:precheck:studio`-Nachweis.
