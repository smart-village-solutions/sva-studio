# Change: Tenant-IAM-Doctor auf eindeutige Evidenz umstellen

## Why

Der Tenant-IAM-Doctor kann einen vorhandenen Keycloak-Client als fehlend melden, wenn die für die Prüfung verwendete Serviceidentität den Client nicht lesen darf. Ein leeres Suchergebnis ist in diesem Fall keine belastbare Existenzaussage. Gleichzeitig besitzt der tenantlokale IAM-Client derzeit weiterreichende Client-Schreibrechte, obwohl Client-Provisioning dem Provisioner gehört.

Der in `docs/architecture/keycloak-serviceidentitaeten-und-berechtigungen.md` beschriebene Zielzustand soll deshalb als ausführbarer Diagnose- und Berechtigungsvertrag umgesetzt werden: Struktur, operativer Tenant-IAM-Zugriff und Reconcile werden getrennt, jeweils mit der zuständigen Serviceidentität geprüft und mit ihrer Evidenzquelle ausgewiesen.

## What Changes

- Der Doctor bewertet Keycloak-Struktur ausschließlich anhand einer hinreichend berechtigten, eindeutig benannten Provisioning-Evidenz.
- Die Tenant-IAM-Rechteprobe läuft ausschließlich mit der tenantgebundenen Serviceidentität und prüft nur deren eigenen Betriebsvertrag.
- Ein leeres Client-Suchergebnis gilt nur dann als `missing`, wenn die prüfende Identität nachweislich die erforderliche Lesecapability besitzt; andernfalls wird `forbidden` oder `unknown` gemeldet.
- Der Tenant-IAM-Service-Account erhält für Clientdiagnosen `view-clients`, aber kein `manage-clients`; Clientmutationen bleiben beim Provisioner.
- Diagnoseergebnisse weisen Achse, Serviceidentität, Quelle, Prüfzeitpunkt, stabilen Fehlercode und nach Möglichkeit `requestId` aus.
- Reparaturempfehlungen adressieren den zuständigen Service und lösen während einer Gesundheitsprüfung keine Keycloak-Mutation aus.
- Die Umstellung bestehender Service-Accounts erfolgt gestuft: Leserecht ergänzen und nachweisen, anschließend überflüssiges Schreibrecht entziehen.

## Impact

- Affected specs:
  - `iam-core`
  - `instance-provisioning`
- Affected code:
  - `packages/auth-runtime/src/keycloak-admin-client/*`
  - `packages/auth-runtime/src/iam-instance-registry/*`
  - `packages/instance-registry/src/*`
  - Tenant-IAM-Diagnose und Rollen-Provisioning in `apps/sva-studio-react`
  - zugehörige Unit-, Integrations- und E2E-Tests
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
- Affected ADRs:
  - neue ADR zur Trennung von Provisioning-, Tenant-IAM- und Diagnoseevidenz
- Datenbankschema:
  - keine Schemaänderung geplant; vorhandene Status- und Reconcile-Evidenz wird weiterverwendet
- External systems:
  - Keycloak Master-Realm und Tenant-Realms
