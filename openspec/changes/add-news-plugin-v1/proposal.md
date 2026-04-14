# Change: Erstes News-Plugin für SVA Studio

## Why

SVA Studio soll fachliche Funktionen über eine Plugin-Architektur erweiterbar machen. Für eine erste belastbare Ausbaustufe wird ein News-Plugin benötigt, mit dem Redakteure News Items im Studio bearbeiten können, ohne dass das Plugin direkt an App- oder Backend-Interna gekoppelt wird.

## What Changes

- Neues Workspace-Plugin `@sva/plugin-news` als erste produktive Plugin-Referenz
- Erweiterung von `@sva/sdk` um einen stabilen Plugin-Vertrag für Routen, Navigation, i18n und Content-Type-Definitionen
- Einführung eines spezialisierten Content-Typs `news` auf Basis der bestehenden Mainserver-Content-API
- News werden direkt auf dem Mainserver gespeichert; das Studio speichert nur Audit-Log und Berechtigungen
- Plugin-spezifische News-Listen- und Editor-Ansichten im Studio (CRUD inkl. Löschen)
- Wiederverwendung der bestehenden IAM-Rechte `content.read`, `content.create`, `content.write`
- Serverseitige Payload-Validierung und HTML-Sanitisierung für News-Inhalte
- Plugin-eigene i18n-Namespaces und Translation-Keys (de + en)

## Impact

- Affected specs:
  - `content-management`
  - `routing`
  - `account-ui`
  - `monorepo-structure`
- Affected code:
  - `packages/sdk`
  - `packages/plugin-example` als Referenz für die neue Plugin-Form
  - neues `packages/plugin-news`
  - `apps/sva-studio-react`
  - bestehende IAM-Content-API in `packages/auth`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
  - `docs/architecture/12-glossary.md`
