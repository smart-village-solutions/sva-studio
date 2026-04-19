# Change: Capability-Mapping für Inhaltsaktionen auf primitive Studio-Rechte ausrichten

## Why

Das Studio besitzt bereits eine zentrale Permission Engine, aber fachnahe Inhaltsaktionen können mit wachsendem CMS-Umfang zu verstreuter Speziallogik führen. Ein explizites Capability-Mapping zwischen Fachaktion und primitiven Studio-Rechten würde die Autorisierungslogik konsistenter, besser prüfbar und besser erklärbar machen.

## What Changes

- Einführung eines Zielbilds für Capability-Mapping bei Inhalts- und Admin-Aktionen
- Trennung zwischen fachlichen Aktionen wie Publish, Archive oder Bulk-Edit und primitiven Studio-Rechten
- Klärung der Rolle des Mappings innerhalb der bestehenden Permission Engine
- Vereinheitlichung der Sicherheitslogik zwischen UI, API und Audit-Pfad
- Vorbereitung nachvollziehbarer Autorisierungsentscheidungen für neue Content-Typen und Admin-Ressourcen

## Impact

- Affected specs:
  - `iam-access-control`
  - `content-management`
  - `iam-auditing`
- Affected code:
  - `packages/auth`
  - `packages/core`
  - `packages/sdk`
  - `apps/sva-studio-react`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
