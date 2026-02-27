# Change: IAM Core Data Layer aufbauen

## Why

Für belastbare Autorisierung und Mandantenfähigkeit fehlt eine konsistente IAM-Datenbasis. Ohne stabiles Schema sind Rollen, Permissions, Vererbung und Audit nicht zuverlässig umsetzbar.

## Kontext

Child B baut auf Child A auf und liefert das persistente Datenfundament für alle nachgelagerten IAM-Child-Changes. Postgres ist lokal derzeit noch nicht verfügbar und wird in diesem Change als Docker-basierter Dev-Baustein ergänzt.

## What Changes

- Einführung des `iam`-Schemas in Postgres
- Tabellen für `accounts`, `organizations`, `roles`, `permissions`, Zuordnungen und `activity_logs`
- Migrationspfad inkl. Seeds für Systemrollen (7 Personas)
- RLS-Baseline für mandantenfähige Isolation
- Kanonischer Mandanten-Scope: `instanceId` (eine Instanz enthält mehrere Organisationen)
- Bereitstellung einer lokalen Postgres-Instanz per Docker (analog Redis-Dev-Setup)
- Verschlüsselung sensibler IAM-Daten at Rest (wo sinnvoll und notwendig)
- Datenklassifizierung für IAM-Entitäten (Schutzlevel pro Datenart)

### In Scope

- Lokale Postgres-Bereitstellung für Entwicklung und Tests (Docker/Compose)
- `iam`-Schema inkl. Instanz-/Organisationsmodell
- `iam.activity_logs` als persistenter Audit-DB-Sink für Child-A-Dual-Write
- Migrations- und Rollbackfähigkeit
- Baseline-RLS für Instanzisolation
- Seeds für initiale IAM-Systemrollen (7 Personas als Startset)
- Verschlüsselung sensibler Felder at Rest (Spalten-Level-Encryption für Credentials, PII-Felder)
- Datenklassifizierung: Schutzlevel pro IAM-Entität (Vertraulich: Accounts/Credentials, Intern: Org-Metadaten, Öffentlich: Rollennamen)

### Out of Scope

- RBAC/ABAC-Evaluationslogik (`authorize`) und Permission-Engine
- Cache-Invalidierung und Redis-Permission-Snapshots
- Governance-Workflows (Delegation, Impersonation, Approval)
- Externe IdP-Integrationen und 2FA-Spezifika

### Delivery-Slices

1. **Infra Slice:** Postgres Docker + Konfiguration + Healthchecks
2. **Schema Slice:** Tabellen, FKs, Constraints, Indexes, RLS-Baseline
3. **Migration Slice:** versionierte Migrations + Rollback + Smoke-Test
4. **Data Slice:** Seeds + Basistests (Isolations- und Integritätstests)

## Impact

- Affected specs: `iam-organizations`, `iam-access-control`, `iam-auditing`
- Affected code: `packages/data`, ggf. `packages/core`
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`

## Dependencies

- Requires (erfüllt, archiviert am 27.02.2026): `setup-iam-identity-auth` (Identity-Basis)
- Blocks: `add-iam-authorization-rbac-v1`, `add-iam-abac-hierarchy-cache`

## Risiken und Gegenmaßnahmen

- **RLS-Fehlkonfiguration:** frühe Negativtests auf Instanzgrenzen + SQL-Policy-Reviews + Privilege-Escalation-Tests (Runtime-Rollen, Connection-Pooling mit `SET ROLE`)
- **RLS-Bypass durch privilegierte Rollen:** Anwendung nutzt ausschließlich Nicht-Superuser-Rollen ohne `BYPASSRLS`; privilegierte Zugriffe sind nur für Migrationen erlaubt und werden auditiert
- **Schema-Churn:** Migrationen klein schneiden und mit Rollback-Pfaden absichern
- **Lokale Drift (Docker/Env):** verbindliche Compose-Profile und dokumentierte Defaults
- **Unverschlüsselte sensible Daten:** frühzeitig festlegen, welche Spalten verschlüsselt werden; Produktivbetrieb erfordert zusätzlich TDE oder Volume-Encryption

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ✅ `instanceId` als kanonischer Mandanten-Scope bestätigt
2. ✅ Postgres wird lokal via Docker bereitgestellt (kein externer DB-Blocker)
3. ✅ Verantwortlichkeit für Migrationsfreigaben und Rollback benannt
4. ✅ Teststrategie für RLS-Isolation und Datenintegrität festgelegt

## Akzeptanzkriterien (Change-Ebene)

- Lokale Entwicklungsumgebung kann Postgres reproduzierbar starten und Healthcheck bestehen.
- `iam`-Schema ist migrierbar, rollbackbar und enthält Instanz-/Org-Beziehungen.
- RLS verhindert datenbankseitig Instanzüberschreitende Zugriffe.
- Seeds für 7 Personas sind idempotent einspielbar.
- Basistests für Migration + Isolation laufen grün.
- Sensible IAM-Felder (Credentials, PII) werden at Rest verschlüsselt gespeichert.
- Datenklassifizierung ist für alle IAM-Entitäten dokumentiert.
- RLS-Negativtests decken Runtime-Rollenhärtung (kein `SUPERUSER`/`BYPASSRLS`) und Connection-Pooling-Szenarien ab.

## Status

🟡 Draft Proposal (inhaltlich vervollständigt, bereit für Review)
