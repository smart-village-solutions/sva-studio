# Tasks: add-iam-core-data-layer

## 1. Schema & Migration

- [ ] 1.1 Lokale Postgres-Instanz per Docker bereitstellen (Compose, Volumes, Healthcheck)
- [ ] 1.2 Verbindliche lokale Env-Konfiguration für DB-Connection definieren und dokumentieren
- [ ] 1.3 `iam`-Schema anlegen
- [ ] 1.4 Kern-Tabellen modellieren (`accounts`, `organizations`, `roles`, `permissions`)
- [ ] 1.5 Zuordnungstabellen modellieren (`account_roles`, `role_permissions`, `account_organizations`)
- [ ] 1.6 Instanzmodell ergänzen (`instances`, `instance_memberships`, instanzgebundene Org-Zuordnung)
- [ ] 1.7 Migrations und Rollback validieren (inkl. sauberem Down-Pfad)
  - Akzeptanzkriterien: `up → down → up`-Zyklus läuft fehlerfrei; destruktive Schritte (DROP) sind dokumentiert und als irreversibel gekennzeichnet

## 2. Multi-Tenancy-Basis

- [ ] 2.1 `instanceId`-Konvention in relevanten Tabellen durchziehen (Organisationen bleiben untergeordnet)
- [ ] 2.2 RLS-Basispolicies erstellen
- [ ] 2.3 Isolationstests für Mandantenzugriff schreiben (Negativtests auf Instanzüberschreitung)
- [ ] 2.4 RLS-Bypass-Negativtests: Superuser-Zugriff, Connection-Pooling ohne `SET ROLE`, Privilege-Escalation
- [ ] 2.5 Connection-Pooling: Fail-Closed-Verhalten bei fehlendem Rollenkontext sicherstellen
- [ ] 2.6 Migrations-RLS-Bypass dokumentieren (wo und warum RLS deaktiviert wird)

## 3. Seeds & Qualität

- [ ] 3.1 Seed-Daten für 7 Personas anlegen (idempotent)
- [ ] 3.2 Repositories/Typen in Strict-TS ergänzen
- [ ] 3.3 Unit-/Integrationstests für Datenzugriff ergänzen

## 4. Verifikation & Dokumentation

- [ ] 4.1 Nx-Task(s) für lokale DB-Initialisierung und Migration dokumentieren
- [ ] 4.2 Kurze Betriebsnotiz für lokale Wiederherstellung/Reset ergänzen
- [ ] 4.3 arc42-Referenzen in betroffenen Child-Dokumenten final gegenprüfen

## 4a. Encryption at Rest & Datenklassifizierung (Security-Review 26.02.2026)

- [ ] 4a.1 Datenklassifizierung für alle IAM-Entitäten dokumentieren (Vertraulich/Intern/Öffentlich)
- [ ] 4a.2 Column-Level Encryption für sensible Felder implementieren (Credentials, PII)
- [ ] 4a.3 Schlüsselmanagement-Strategie definieren (kein Key in der DB)
- [ ] 4a.4 Tests: verschlüsselte Felder sind bei direktem SQL-Zugriff nicht im Klartext lesbar

## 5. Architektur-Dokumentation (Review-Befund)

- [ ] 5.1 `design.md` für Child B erstellen (Schema-Entscheidungen, Migrations-Strategie, RLS-Topologie, Alternativen-Abwägung)
- [ ] 5.2 ADR erstellen: „`instanceId` als kanonischer Mandanten-Scope" (unter `docs/adr/`)
- [x] 5.3 ~~ADR erstellen: „Postgres vs. Supabase"~~ → Entschieden (26.02.2026): Supabase wird nicht verwendet. Postgres lokal via Docker.
- [x] 5.4 ~~Supabase-Referenzen bereinigen~~ → Erledigt (26.02.2026): Alle Supabase-Referenzen in aktiven OpenSpec-Dokumenten entfernt.
