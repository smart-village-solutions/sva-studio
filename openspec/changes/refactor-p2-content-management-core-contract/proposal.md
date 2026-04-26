# Change: Core-Vertrag des Inhaltsmanagements auf CMS-Kern schärfen

## Why

Damit das Studio als package-basiertes CMS stabil wächst, muss der Kern des Inhaltsmanagements bewusst klein und kanonisch bleiben. Fachspezifische Anforderungen sollen über registrierte Erweiterungen ergänzt werden, ohne den Core-Vertrag für Status, Historie, Validierung und Rechte unnötig aufzublähen.

## What Changes

- Schärfung des minimalen Core-Vertrags für Inhalte: Identität, `contentType`, Mandanten-/Owner-Scope, Status, Validierungszustand, Veröffentlichungsmetadaten, Historienreferenzen und auditrelevante Metadaten
- Abgrenzung zwischen hostseitiger Kernsemantik und pluginseitiger Facherweiterung für Payload-Schema, Fachfelder, UI-Bindings und zusätzliche Validierung
- Festlegung, dass Statusübergänge, Persistenz, Autorisierung, Historie, Revisionen und Audit-Emission hostgeführt bleiben
- Einführung stabiler, fully-qualified Content-Core-Actions als IAM-Primitive, auf die spätere fachliche Capabilities gemappt werden können
- Definition eines payload-unabhängigen Audit-Metadatenvertrags für Content-Core-Mutationen
- Vorbereitung einer belastbaren Trennung zwischen Content-Kern, UI-Spezialisierung und Plugin-Metadaten

## Impact

- Affected specs:
  - `content-management`
  - `iam-access-control`
  - `iam-auditing`
- Affected code:
  - `packages/core`
  - `packages/sdk`
  - `packages/auth-runtime`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`

## Non-Goals

- Keine Einführung eines neuen Content-Admin-UI-Vertrags; UI-Spezialisierung bleibt in nachgelagerten Changes abgegrenzt.
- Keine package-spezifischen Content-Statusmodelle im Core.
- Keine dynamische Runtime-Registrierung von Content-Typen außerhalb des validierten Build-time-Registry-Snapshots.
- Keine Migration bestehender Fachpayloads in hosteigene Fachfelder, solange sie nicht für Core-Status, Rechte, Historie oder Audit benötigt werden.
