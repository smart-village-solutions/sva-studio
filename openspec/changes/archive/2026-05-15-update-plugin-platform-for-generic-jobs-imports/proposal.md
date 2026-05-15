# Change: Generische Plugin-Plattform für Jobs und strukturierte Importe

## Why

Der Workspace besitzt heute bereits klare Host-Grenzen für Plugins, Routing, Modul-IAM und Build-Time-Registrierung. Gleichzeitig fehlen noch generische Plattformverträge für langlaufende Plugin-Operationen und strukturierte Importe. Dadurch würden Fachchanges wie `add-waste-management-plugin` derzeit entweder zu viel plattformweite Vorarbeit in einen Fachchange ziehen oder implizite Sonderlösungen aufbauen.

Ein vorgelagerter Plattform-Change schafft deshalb zuerst die generischen Verträge, Registries und Host-Boundaries für Jobs und Importe. Fachplugins können diese Fähigkeiten danach nutzen, ohne selbst neue Querschnittsarchitektur zu definieren.

## What Changes

- Neue Capability `plugin-operations-platform` für generische, hostgeführte Plugin-Jobs und strukturierte Importe
- Explizite Plugin-Verträge im `@sva/plugin-sdk` für registrierte Jobtypen und Importprofile
- Erweiterung der Build-Time-Registry um validierte Operations-Beiträge, ohne einen zweiten parallelen Plugin-Registry-Pfad einzuführen
- Hostgeführte zentrale Persistenz für pluginübergreifende Jobs im Studio-Postgres als führender Vertrag
- Hostgeführte API- und Routing-Einbindung für Plugin-Operations-Endpunkte über den bestehenden typisierten Runtime-Route-Katalog
- Eine erste lesende Host-Oberfläche unter `Monitoring > Jobs` mit Tabs für aktive Jobs und Historie
- Eine hostgeführte Listen-API für Jobs mit Filtern, Pagination und Polling-tauglicher Projektion
- Klare Trennung zwischen generischer Plattformlogik für Jobs/Importe und fachplugin-spezifischen Payloads, Validierungen und UI-Abläufen
- Monitoring- oder Wizard-Oberflächen werden in diesem Change nicht vollumfänglich ausgebaut; die Jobs-Ansicht bleibt ein gezielter lesender Einstieg ohne Eingriffs-UI

## Non-Goals

- Kein fachliches Waste-Management oder anderes Fachplugin in diesem Change
- Keine vollständige Monitoring-Suite jenseits des Unterbereichs `Monitoring > Jobs`
- Kein verpflichtender generischer Import-Wizard als fertige Endnutzeroberfläche
- Keine zweite Plugin- oder Route-Registry außerhalb der bestehenden Host-Build-Time-Registry
- Keine Verlagerung von Plugin-Job-Persistenz in externe Fachdatenbanken als führenden Plattformvertrag
- Keine manuellen Job-Aktionen wie Retry, Delete oder Bulk-Operationen in der ersten Monitoring-Ansicht

## Impact

- Affected specs:
  - `plugin-operations-platform`
  - `monorepo-structure`
  - `routing`
  - `architecture-documentation`
- Affected code:
  - `packages/plugin-sdk`
  - `packages/core`
  - `packages/auth-runtime`
  - `packages/routing`
  - `packages/data-repositories`
  - `packages/server-runtime`
  - `packages/studio-module-iam`
  - `apps/sva-studio-react`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
