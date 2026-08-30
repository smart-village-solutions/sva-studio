# Change: Plugin-Plattform um Scopes und Aktivierungsrichtlinien erweitern

## Why

Der bestehende Plugin-Vertrag kann Beiträge nur tenantbezogen autorisieren und
kennt für Instanzen ausschließlich manuelle Modulzuweisungen. Admin-Plugins wie
SSF benötigen jedoch ausdrücklich freigegebene Root-Beiträge sowie
wiederverwendbare Standard-, Auto- und Pflichtaktivierungen, ohne dafür
fachspezifische Core-Schalter einzuführen.

## What Changes

- Plugins können hostvalidierte Routen, Navigation, Aktionen und serverseitige
  Beiträge explizit im Plattform- oder Tenant-Scope deklarieren.
- Extension-Tier, Contribution-Typ und Autorisierungsanforderung begrenzen
  Plattformbeiträge fail-closed.
- Plugin-Manifeste deklarieren eine tenantbezogene Aktivierungsrichtlinie
  `optional`, `automatic` oder `required`.
- Effektiver Aktivierungszustand, Herkunft, Revision und manuelle Overrides
  werden persistent, concurrency-sicher und auditierbar.
- Der explizite Instanz-Modulsatz bleibt die einzige Runtime-Wahrheit und kann
  zusätzlich durch einen hostgeführten Richtlinien-Reconcile aktualisiert
  werden.
- Deaktivierung und Deployment-Entfernung löschen keine Plugin-Fachdaten
  automatisch.

## Dependencies and Coordination

- Der aktive Change `add-p3-plugin-extension-tier-governance` muss die zulässige
  Admin-Erweiterungstiefe für Plattformbeiträge bereitstellen oder mit diesem
  Change konsolidiert werden.
- Der aktive Change `refactor-cross-cutting-runtime-guardrails` verändert
  ebenfalls `packages/plugin-sdk`; es darf nur einen kanonischen Validator- und
  Snapshot-Pfad geben.
- `add-plugin-tenant-lifecycle` baut auf den hier persistierten
  Aktivierungszuständen auf.

## Impact

- Affected specs:
  - `plugin-platform`
  - `instance-provisioning`
  - `routing`
- Affected code:
  - `packages/plugin-sdk`
  - `packages/routing`
  - Plugin-Katalog und Snapshot-Materialisierung
  - Instanz-Registry, Modul-IAM und Studio-Datenmodell
  - Root-/Tenant-Routing in `apps/sva-studio-react`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
