# Change: Interne SSF-Runtime-Konfigurations-API einführen

## Why

Nach der SSF-Tenant- und Nutzerverwaltung muss die SSF-Runtime ihre
tenantbezogene Konfiguration sicher aus dem SSF-Plugin beziehen können. Eine
frei übergebene `instanceId` ist keine Vertrauensgrundlage; zugleich soll kein
SSF-spezifischer Authentisierungs-Sonderpfad im Host entstehen.

## What Changes

- Der Host erhält einen generischen internen Service-API-Vertrag für
  hostgeführte Plugin-Handler.
- Interne Zugriffe benötigen eine technische Service-Identität mit eigener
  Audience und eine kurzlebige, signierte Tenant-Assertion.
- Der Host prüft Signatur, Issuer, Audience, Gültigkeit, Token-ID,
  Replay-Schutz und Tenant-Bindung, bevor er den Execution-Context erzeugt.
- Das SSF-Plugin stellt eine minimale, versionierte tenantbezogene
  Runtime-Konfiguration mit Konfigurationsrevision bereit.
- Deaktivierte, suspendierte oder nicht bereite Tenants bleiben fail-closed.
- Customer-Session-Token werden ausschließlich durch SSF ausgewertet und nicht
  als Studio-Identitäten materialisiert.
- ClickHouse, Session-Datenbanken, Gesprächsinhalte und Auswertungen bleiben
  außerhalb dieses Changes.

## Dependencies and Coordination

- Depends on `extend-plugin-platform-scopes-and-activation` für
  scopevalidierte Serverbeiträge.
- Depends on `add-plugin-tenant-lifecycle` für Aktivierungs- und
  Readiness-Gates.
- Depends on `add-ssf-tenant-administration` für Tenant-, Realm-, Client- und
  Datenbankgrundzustand.
- Reuses die bestehende JWT-/JWKS-, Audience-, Action- und
  Server-Execution-Context-Infrastruktur.

## Impact

- Affected specs:
  - `internal-service-api` (neu)
  - `ssf-runtime-configuration` (neu)
- Affected code:
  - Auth-/Server-Runtime für interne Service-Identitäten
  - Plugin-SDK für interne Serverbeiträge
  - Host-Routing und Replay-Speicher
  - SSF-Plugin-Handler und SSF-Datenbank-Repositories
  - Deployment-Secrets und Keycloak-Service-Client
- Affected arc42 sections:
  - `docs/architecture/03-context-and-scope.md`
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
