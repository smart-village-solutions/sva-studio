# Change: SSF-Runtime-Konfigurations-Backend und interne V1-API einführen

## Why

Der fachlich freigegebene Studio–SSF-Vertrag beschreibt die erste feste
Integrationsgrenze, ist aber noch nicht implementiert. SSF benötigt einen
tenantgebundenen, unmittelbar aktuellen Konfigurationsabruf, ohne eine eigene
Konfigurationspersistenz oder einen SSF-spezifischen Fachpfad im Studio Core
aufzubauen.

## What Changes

- Ein neues `@sva/plugin-ssf` besitzt Produktdefaults, Konfigurationsmodell,
  Auflösungslogik, HTML-Bereinigung und die SSF-Fachpersistenz.
- Pro Studio-/SSF-Installation wird genau eine plugin-eigene,
  mandantenfähige PostgreSQL-Datenbank betrieben. Sie speichert serverweite
  Anpassungen, Tenant-Policies, Tenant-Overrides und lokalisierte Texte.
- Der Host stellt den festen internen Endpoint
  `GET /internal/plugins/ssf/v1/runtime-configuration` über einen
  hostvalidierten Plugin-Serverbeitrag bereit.
- Der Endpoint authentifiziert ausschließlich ein kurzlebiges Service-Token
  des separaten SSF-Keycloaks. Es gibt keine zusätzliche Tenant-Assertion,
  keinen Replay-Speicher und keinen Browserzugriff.
- Die effektive Konfiguration folgt feldweise der Priorität
  Tenant-Override → serverweite Anpassung → versionierter Produktdefault und
  erhält einen deterministischen Inhaltsfingerabdruck.
- Das feste V1-Schema, Eingabegrenzen und Fehlerantworten werden als OpenAPI-
  und Laufzeitvertrag implementiert und getestet.
- Die Persistenz- und Domain-APIs für spätere Root-/Tenant-Schreibpfade werden
  vorbereitet; Administrationsoberflächen und öffentliche Schreibendpunkte
  sind nicht Bestandteil dieses Changes.
- Ohne verifizierte SSF-IAM-Projektionsrevision bleibt der Endpoint
  fail-closed mit `ssf_tenant_not_ready`. Die Permission-Projektion und ihre
  Keycloak-Lifecycle-Integration folgen in einem getrennten Change.

## Dependencies and Coordination

- `extend-plugin-platform-scopes-and-activation` und der Foundation-Slice aus
  PR #1246 sind gemergte Baselines. Der technische Service-Zugriff bleibt eine
  gezielte Erweiterung des Plugin-Dispatchers; er wird nicht als Tenant- oder
  Plattformzugriff modelliert.
- Die JWT-/JWKS-Prüfung in `@sva/auth-runtime` ist seit PR #1246 als
  generischer, konfigurierbarer Service-Token-Vertrag verfügbar; die
  MCP-spezifische Semantik blieb unverändert.
- `add-plugin-tenant-lifecycle`, `add-ssf-tenant-administration` und die
  revisionsgebundene SSF-Keycloak-Projektion bleiben getrennte Follow-ups.
  Der nächste Slice umfasst ausschließlich Service-Zugriff, internen
  GET-Endpunkt, Host-Gates und deren Integrationstests. Deployment,
  Administrationsoberflächen und Tenant-Lifecycle bleiben außerhalb.
- Der frühere, nur auf einem separaten Branch vorhandene Entwurf mit
  Tenant-Assertion und Replay-Speicher wird nicht übernommen. Maßgeblich sind
  der freigegebene V1-Vertrag und ADR-057.

## Impact

- Affected specs:
  - `plugin-platform`
  - `ssf-runtime-configuration` (neu)
  - `deployment-topology`
- Affected code:
  - neues Package `packages/plugin-ssf`
  - generische Service-Token-Verifikation in `packages/auth-runtime`
  - Plugin-Katalog und serverseitiger Plugin-Dispatcher
  - Deployment-Konfiguration für SSF-Plugin-Datenbank und Service-Identität
- Affected data:
  - neue, getrennte SSF-Plugin-Datenbank mit eigenem Migrationsledger und
    Sollschema-Snapshot
  - keine SSF-Fachtabellen in der zentralen Studio-Datenbank
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

## Success Criteria

- Zwei Testtenants können aus derselben Plugin-Datenbank keine Daten des
  jeweils anderen Tenants lesen oder verändern.
- Ein gültiges SSF-Service-Token und ein gebundener Tenant liefern exakt das
  dokumentierte V1-Schema; Browser-, Fremdtenant- und Fehlkontexte bleiben
  fail-closed.
- Änderungen an wirksamen Daten sind beim nächsten Abruf sichtbar und ändern
  `configurationRevision`; unwirksame gespeicherte Overrides ändern die
  Runtime-Antwort und Revision nicht.
- Ohne verifizierte `authorizationRevision`, bei inaktivem Plugin oder bei
  nicht betriebsbereitem Tenant wird keine Konfiguration ausgeliefert.
- Produktdefaults, serverweite Werte und Tenant-Overrides werden in genau
  einer pluginlokalen Auflösungslogik zusammengeführt.
- OpenAPI-, Unit-, PostgreSQL-Integrations-, Auth-, Server-Runtime- und
  Plugin-Boundary-Gates sind grün.
