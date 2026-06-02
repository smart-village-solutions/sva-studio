# Local Runtime Drift Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lokale Runtime-Drift sauber heilen, ohne `env:up:local-keycloak` wieder schreibend zu machen oder lokale Entwicklungsumgebungen regelmaessig neu aufzusetzen.

**Architecture:** Der lokale Standardstart bleibt read-only. Drifts werden explizit unterschieden in Schema, Snapshot, Instanz-Identitaet und Tenant-Secrets. Ein neuer Repair-Pfad fuehrt Migration, preserve- oder authoritative-Reconcile und Secret-Sync bewusst zusammen und schliesst mit einem maschinenlesbaren Doctor-Lauf ab.

**Tech Stack:** Nx, pnpm, TypeScript strict mode, tsx, Vitest, OpenSpec, Docker Compose, pg_dump

---

## File Structure Map

### Runtime und Diagnose

- Modify: `scripts/ops/runtime-env.ts`
- Modify: `scripts/ops/runtime-env.shared.ts`
- Create: `scripts/ops/runtime/db-schema-snapshot.ts`
- Create: `scripts/ops/runtime/db-schema-snapshot.test.ts`
- Modify: `scripts/ops/runtime-env.test.ts`
- Modify: `package.json`

### Betriebs- und Architekturdoku

- Modify: `docs/development/runtime-profile-betrieb.md`
- Modify: `docs/guides/lokale-instanz-db-initialisierung.md`
- Modify: `docs/guides/troubleshooting.md`
- Modify: `docs/architecture/10-quality-requirements.md`

### OpenSpec

- Create: `openspec/changes/refactor-local-runtime-drift-repair/proposal.md`
- Create: `openspec/changes/refactor-local-runtime-drift-repair/tasks.md`
- Create: `openspec/changes/refactor-local-runtime-drift-repair/design.md`
- Create: `openspec/changes/refactor-local-runtime-drift-repair/specs/deployment-topology/spec.md`
- Create: `openspec/changes/refactor-local-runtime-drift-repair/specs/instance-provisioning/spec.md`

## Task 1: Runtime-Doctor und Repair-Pfad implementieren

- [x] Doctor-Checks um `reasonCode`, `repairable` und `recommendedAction` erweitert
- [x] lokale Drift-Klassen `schema_snapshot`, `instance_identity` und `tenant_secrets` als eigene Checks sichtbar gemacht
- [x] neuen Befehl `pnpm env:repair:local-keycloak` eingefuehrt
- [x] Repair auf bestehenden Mechanismen aufgebaut: Migration, Registry-Reconcile, tenant-spezifischer Secret-Sync
- [x] `--authoritative` fuer den Repair- und Reconcile-Pfad verdrahtet

## Task 2: Schema-Snapshot-Governance umsetzen

- [x] neuen Befehl `pnpm env:verify:db-schema-snapshot` eingefuehrt
- [x] Snapshot-Vergleich als objektbasierte Verifikation implementiert
- [x] `graphile_worker` als bewusst ignoriertes Runtime-Schema ausgeschlossen
- [x] Snapshot-Drift als nicht-reparierbare, aber sichtbare Doctor-Klasse markiert

## Task 3: OpenSpec und Repo-Doku nachziehen

- [x] OpenSpec-Change `refactor-local-runtime-drift-repair` angelegt
- [x] Betriebsdoku auf den Eskalationspfad `up -> doctor -> repair -> reset` ausgerichtet
- [x] lokalen read-only Start und den expliziten Repair-Pfad konsistent dokumentiert
- [x] Snapshot als abgeleitetes Artefakt und Migrationen als Source of Truth verankert

## Task 4: Verifikation

- [x] `pnpm exec vitest run scripts/ops/runtime/db-schema-snapshot.test.ts scripts/ops/runtime-env.test.ts`
- [x] `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
- [x] `pnpm env:verify:db-schema-snapshot -- --json`
- [x] `pnpm env:doctor:local-keycloak --json`
- [x] `pnpm env:repair:local-keycloak -- --json`
