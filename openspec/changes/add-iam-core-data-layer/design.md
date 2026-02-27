# Design: Child B – IAM Core Data Layer

## Kontext

Child B liefert das persistente Fundament für nachgelagerte IAM-Children (RBAC, ABAC, Governance, DSGVO). Der Mandanten-Scope ist `instanceId`; Organisationen sind Untereinheiten je Instanz.

## Ziele

- Reproduzierbares Postgres-Setup für Entwicklung und Tests
- Stabiles, migrierbares IAM-Schema mit klaren Relationen
- Durchgängige Instanzisolation auf Datenbankebene (RLS)
- Security-Basis: Verschlüsselung sensibler Felder und Datenklassifizierung

## Architekturentscheidungen

1. Persistenz in Postgres mit dediziertem `iam`-Schema
2. Mandantenmodell über `instanceId` in allen mandantenrelevanten Tabellen
3. Row-Level-Security als Default für Laufzeitzugriffe; Migrationen dokumentieren explizite Ausnahmen
4. Idempotente Seeds für 7 Personas als deterministischer Startzustand
5. Application-Level Column Encryption (Envelope Encryption) für Credentials und PII-Felder; Schlüsselmaterial liegt außerhalb der Datenbank

## Datenmodell (logisch)

- Kern: `instances`, `accounts`, `organizations`, `roles`, `permissions`, `activity_logs`
- Zuordnung: `instance_memberships`, `account_organizations`, `account_roles`, `role_permissions`
- Audit-relevante Referenzen bleiben stabil, damit nachfolgende Children unveränderbare Nachweise erzeugen können

## RLS-Topologie

- Jeder Request setzt den aktiven Instanzkontext
- Policies erlauben nur Zugriff auf Datensätze der aktiven `instanceId`
- Fail-Closed: ohne gültigen Kontext kein Datenzugriff
- Laufzeitzugriffe erfolgen nur über dedizierte App-Rollen ohne `SUPERUSER`/`BYPASSRLS`
- Negativtests decken Rollenhärtung sowie Pooling-Fehlkonfigurationen ab

## Migrationsstrategie

- Versionierte Migrationen mit `up/down`
- Rollback-Fähigkeit für jede Migration (außer explizit als irreversibel markierte Schritte)
- Validierung über `up -> down -> up`-Zyklus in CI

## Observability und Security-Betrieb

- Migrations- und Seed-Läufe erzeugen strukturierte, korrelierbare Betriebslogs
- Sicherheitsrelevante Abweichungen (z. B. RLS-Ausnahmepfade) sind explizit markiert und auditierbar

## Architekturartefakte

- ADR: `instanceId` als kanonischer Mandanten-Scope
- ADR: Postgres (Docker) als alleinige Datenbankplattform
- ADR: Verschlüsselungsstrategie für sensible IAM-Daten (Application-Level Encryption + externes Key-Management)

## Alternativen und Abwägung

- Zentrale App-Isolation ohne RLS: verworfen wegen hohem Bypass-Risiko
- Pro-Mandant-eigenes Schema: verworfen wegen Betriebsaufwand und Migrationskomplexität

## Verifikation

- Schema-/Seed-Tests auf Konsistenz und Idempotenz
- Isolationstests für Instanzgrenzen und RLS-Bypass-Negativfälle
- Security-Tests: verschlüsselte Felder sind via direktem SQL nicht im Klartext lesbar
