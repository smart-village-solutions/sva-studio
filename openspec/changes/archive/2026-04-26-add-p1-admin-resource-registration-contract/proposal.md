# Change: Registrierungsvertrag für Admin-Ressourcen einführen

## Why

Der Admin-Teil des Studios benötigt für neue Fachmodule einen einheitlichen Vertrag, statt Listen-, Detail- und Editor-Flächen jeweils individuell im Host zu verdrahten. Ein expliziter Registrierungsvertrag für Admin-Ressourcen schafft eine belastbare Grundlage für package-basierte CMS-Erweiterungen.

## What Changes

- Einführung eines deklarativen Vertrags für Admin-Ressourcen aus Workspace-Packages
- Standardisierung der Beiträge für Listenansicht, Detailansicht, Erstellen, Bearbeiten und Historie
- Definition der minimalen Metadaten einer Admin-Ressource, inklusive Route, Titel, Guard-Anforderung und UI-Bindings
- Ausrichtung der Host-Materialisierung an kanonischen Admin-Ressourcen statt an lose verteilten Fachrouten
- Vorbereitung einer einheitlichen Basis für neue Content- und Verwaltungsbereiche im Studio-Admin

## Impact

- Affected specs:
  - `account-ui`
  - `routing`
  - `content-management`
- Affected code:
  - `packages/sdk`
  - `packages/routing`
  - `apps/sva-studio-react/src/routes/admin`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
