# Change: Core-Vertrag des Inhaltsmanagements auf CMS-Kern schärfen

## Why

Damit das Studio als package-basiertes CMS stabil wächst, muss der Kern des Inhaltsmanagements bewusst klein und kanonisch bleiben. Fachspezifische Anforderungen sollen über registrierte Erweiterungen ergänzt werden, ohne den Core-Vertrag für Status, Historie, Validierung und Rechte unnötig aufzublähen.

## What Changes

- Schärfung des minimalen Core-Vertrags für Inhalte und Statusmodell
- Abgrenzung zwischen hostseitiger Kernsemantik und pluginseitiger Facherweiterung
- Klärung, welche Felder und Workflows immer hostgeführt bleiben und welche registrierbar sind
- Vorbereitung einer belastbaren Trennung zwischen Content-Kern, UI-Spezialisierung und Plugin-Metadaten
- Dokumentation des Zielbilds für ein kleines, stabiles CMS-Rückgrat des Studios

## Impact

- Affected specs:
  - `content-management`
  - `iam-access-control`
  - `iam-auditing`
- Affected code:
  - `packages/core`
  - `packages/sdk`
  - `packages/auth`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
