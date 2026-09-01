# Change: Generischen Plugin-Tenant-Lifecycle einführen

## Why

Mehrere Plugins benötigen tenantbezogene Fachprovisionierung, Reconcile und
Readiness. Waste besitzt bereits einen hostgeführten Provisionierungsjob; SSF
benötigt einen ähnlichen Lebenszyklus mit anderer Datenbanktopologie. Ohne
gemeinsamen Vertrag würden Plugin-spezifische Orchestrierungen, Statusmodelle
und Reparaturpfade im Host entstehen.

## What Changes

- Plugins können tenantbezogene Lifecycle-Beiträge für `provision`,
  `reconcile`, `suspend`, `reactivate` und `readiness` deklarieren.
- Der Host führt Lifecycle-Schritte über die bestehende persistente
  Plugin-Operations-Plattform aus.
- Sollgeneration, Claim, Fortschritt, Ergebnis, Fehler und Retry-Evidenz werden
  generisch und idempotent geführt.
- Plugins melden einen gemeinsamen operationalen Tenantstatus mit einzelnen
  Readiness-Prüfungen.
- Das Instanz-Cockpit stellt Plugin-Readiness und Reparaturaktionen generisch
  dar, ohne pluginId-spezifische Host-UI.
- Datenbanktopologie, Fachmigrationen, Repositories und fachliche Checks bleiben
  im jeweiligen Plugin.

## Dependencies and Coordination

- Depends on `extend-plugin-platform-scopes-and-activation` für den
  persistierten effektiven Tenant-Aktivierungszustand.
- Reuses `plugin-operations-platform`, statt einen zweiten Jobrunner
  einzuführen.
- `add-ssf-tenant-administration` ist der erste neue Verbraucher; der
  bestehende Waste-Provisionierungsweg dient als Migrations- und
  Kompatibilitätsfall.

## Impact

- Affected specs:
  - `plugin-tenant-lifecycle` (neu)
  - `plugin-operations-platform`
  - `instance-provisioning`
- Affected code:
  - `packages/plugin-sdk`
  - `packages/auth-runtime` Plugin-Operations
  - `packages/instance-registry`
  - Instanz-Cockpit und Operations-UI
  - bestehende Waste-Provisionierungsintegration
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
