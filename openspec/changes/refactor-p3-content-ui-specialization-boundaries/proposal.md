# Change: Grenzen zwischen gemeinsamem Inhaltsmodell und spezialisierten Fach-Views schärfen

## Why

Das Studio soll für verschiedene Inhaltsdomänen eine gemeinsame CMS-Basis bereitstellen, ohne die UI in ein starres Einheitsmodell zu zwingen. Dafür braucht es eine klarere Architekturgrenze zwischen kanonischem Inhaltsmodell und packagespezifischen Listen-, Detail- und Editor-Ansichten.

## What Changes

- Definition eines Zielbilds für spezialisierte Fach-Views auf Basis eines gemeinsamen Content-Kerns
- Klärung, welche UI- und Validierungsaspekte packagespezifisch bleiben dürfen und welche Host-Standards nutzen müssen
- Abgrenzung zwischen Core-Semantik, pluginseitiger Darstellung und pluginseitigen Editor-Sektionen
- Vorbereitung konsistenter Plugin-Ansichten ohne Aufweichung der Content-Kernlogik
- Unterstützung weiterer Fachdomänen über spezialisierte Views statt über Core-Forks

## Impact

- Affected specs:
  - `content-management`
  - `account-ui`
  - `ui-layout-shell`
- Affected code:
  - `packages/core`
  - `packages/sdk`
  - `apps/sva-studio-react`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
