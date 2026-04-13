# Change: Erstes News-Plugin für SVA Studio

## Why

SVA Studio soll fachliche Funktionen über eine Plugin-Architektur erweiterbar machen. Für eine erste belastbare Ausbaustufe wird ein News-Plugin benötigt, mit dem Redakteure News Items im Studio bearbeiten können, ohne dass das Plugin direkt an App- oder Backend-Interna gekoppelt wird.

## What Changes

- Neues Workspace-Plugin `@sva/plugin-news` als erste produktive Plugin-Referenz
- Erweiterung von `@sva/sdk` um einen stabilen Plugin-Vertrag für Routen, Navigation und Content-Type-Definitionen
- Einführung eines spezialisierten Content-Typs `news` auf Basis der bestehenden IAM-Content-Infrastruktur
- Plugin-spezifische News-Listen- und Editor-Ansichten im Studio
- Wiederverwendung der bestehenden IAM-Rechte `content.read`, `content.create`, `content.write`
- Optionaler serverseitiger Filter für `contentType`, damit Plugin-Ansichten nicht alle Inhalte clientseitig filtern müssen

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
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
