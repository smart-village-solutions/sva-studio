# Change: Namespacing-Governance für Plugin-Erweiterungen ausbauen

## Why

Das Studio nutzt bereits fully-qualified Action-IDs, aber derselbe Ordnungsgrad fehlt noch für andere Plugin-Beiträge wie Admin-Ressourcen, Content-Typen, Audit-Events und Registrierungskennungen. Mit wachsender Zahl statischer Packages wird ein konsequentes Namespacing nötig, um Kollisionen und uneinheitliche Benennung zu vermeiden.

## What Changes

- Einführung verbindlicher Namespace-Regeln für alle pluginbezogenen Host-Beiträge
- Ausdehnung der Namespace-Governance über Action-IDs hinaus auf Content-Typen, Admin-Ressourcen, Search-Facets, Audit-Events und i18n-Namespaces
- Definition technischer Identitäten für Plugins und ihrer abgeleiteten Registrierungsnamen
- Verankerung von Validierungs- und Review-Anforderungen für neue Namespaces
- Vorbereitung eines einheitlichen Diagnose- und Governance-Modells für wachsende Package-Landschaften

## Impact

- Affected specs:
  - `iam-access-control`
  - `iam-auditing`
  - `content-management`
  - `monorepo-structure`
- Affected code:
  - `packages/sdk`
  - `packages/auth`
  - `packages/plugin-example`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
