# Tasks: add-iam-core-data-layer

## 1. Schema & Migration

- [x] 1.1 Lokale Postgres-Instanz per Docker bereitstellen (Compose, Volumes, Healthcheck)
- [x] 1.2 Verbindliche lokale Env-Konfiguration für DB-Connection definieren und dokumentieren
- [x] 1.3 `iam`-Schema anlegen
- [x] 1.4 Kern-Tabellen modellieren (`accounts`, `organizations`, `roles`, `permissions`)
- [x] 1.5 Zuordnungstabellen modellieren (`account_roles`, `role_permissions`, `account_organizations`)
- [x] 1.6 Instanzmodell ergänzen (`instances`, `instance_memberships`, instanzgebundene Org-Zuordnung)
- [x] 1.7 Migrations und Rollback validieren (inkl. sauberem Down-Pfad)
  - Akzeptanzkriterien: `up → down → up`-Zyklus läuft fehlerfrei; destruktive Schritte (DROP) sind dokumentiert und als irreversibel gekennzeichnet

## 2. Multi-Tenancy-Basis

- [x] 2.1 `instanceId`-Konvention in relevanten Tabellen durchziehen (Organisationen bleiben untergeordnet)
- [x] 2.2 RLS-Basispolicies erstellen
- [x] 2.3 Isolationstests für Mandantenzugriff schreiben (Negativtests auf Instanzüberschreitung)
- [x] 2.4 RLS-Bypass-Negativtests: Runtime-DB-Rolle ohne `BYPASSRLS`/`SUPERUSER`, Connection-Pooling ohne `SET ROLE`, Privilege-Escalation
- [x] 2.5 Connection-Pooling: Fail-Closed-Verhalten bei fehlendem Rollenkontext sicherstellen
- [x] 2.6 Migrations-RLS-Bypass dokumentieren (wo und warum RLS deaktiviert wird)

## 3. Seeds & Qualität

- [x] 3.1 Seed-Daten für 7 Personas anlegen (idempotent)
  - Arbeitsgrundlage (anpassbarer Erstentwurf): `openspec/changes/add-iam-core-data-layer/seed-persona-matrix.md`
- [x] 3.2 Repositories/Typen in Strict-TS ergänzen
- [x] 3.3 Unit-/Integrationstests für Datenzugriff ergänzen
- [x] 3.4 Audit-DB-Sink für Child-A-Dual-Write implementieren: Login/Logout/Account-Erstellung in `iam.activity_logs` persistieren (Referenz: `setup-iam-identity-auth` Task 1.7.5)

## 4. Verifikation & Dokumentation

- [x] 4.1 Nx-Task(s) für lokale DB-Initialisierung und Migration dokumentieren
- [x] 4.2 Kurze Betriebsnotiz für lokale Wiederherstellung/Reset ergänzen
- [x] 4.3 arc42-Referenzen in betroffenen Child-Dokumenten final gegenprüfen

## 4a. Encryption at Rest & Datenklassifizierung (Security-Review 26.02.2026)

- [x] 4a.1 Datenklassifizierung für alle IAM-Entitäten dokumentieren (Vertraulich/Intern/Öffentlich)
- [x] 4a.2 Application-Level Column Encryption für sensible Felder implementieren (Credentials, PII)
- [x] 4a.3 Schlüsselmanagement-Strategie definieren (kein Key in der DB)
- [x] 4a.4 Tests: verschlüsselte Felder sind bei direktem SQL-Zugriff nicht im Klartext lesbar

## 5. Architektur-Dokumentation (Review-Befund)

- [x] 5.1 ~~`design.md` für Child B erstellen~~ → Erledigt (27.02.2026): `design.md` liegt vor und wurde gegen den Change-Scope abgeglichen.
- [x] 5.2 ADR erstellen: „`instanceId` als kanonischer Mandanten-Scope" (unter `docs/adr/ADR-011-instanceid-kanonischer-mandanten-scope.md`)
- [x] 5.3 ~~ADR erstellen: „Postgres vs. Supabase"~~ → Entschieden (26.02.2026): Supabase wird nicht verwendet. Postgres lokal via Docker.
- [x] 5.4 ~~Supabase-Referenzen bereinigen~~ → Erledigt (26.02.2026): Alle Supabase-Referenzen in aktiven OpenSpec-Dokumenten entfernt.
- [x] 5.5 ADR erstellen: „Verschlüsselungsstrategie für IAM Core Data Layer" (unter `docs/adr/ADR-010-verschluesselung-iam-core-data-layer.md`)
