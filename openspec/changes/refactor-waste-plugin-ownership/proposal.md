# Change: Waste-Fachcode dem optionalen Plugin zuordnen (#1505, #1506)

## Why

`@sva/core` und `@sva/plugin-sdk` veröffentlichen Waste-Fachverträge und -funktionen. `@sva/auth-runtime`, `@sva/routing` und `@sva/data-repositories` enthalten ausführbare Waste-Handler, feste Routen und Fach-SQL. Daher bleibt Waste-Code im Host, auch wenn das Plugin nicht installiert ist.

## What Changes

- **Abschnitt 1 – #1505:** Browserfähige Waste-Verträge und reine Fachfunktionen in `@sva/waste-management-contracts` verschieben; alle direkten Verbraucher einschließlich Plugin-UI, Jobs, Instanzdetail und Public-Waste geschlossen umstellen. Waste-Exports und den `waste-output`-Subpath aus Core sowie Waste-Weiterreichungen aus dem SDK im selben Abschnitt löschen.
- **Abschnitt 2 – #1506:** Waste-Handler und fachliche SQL-Repositories in die vorhandenen Waste-Pakete verschieben. Die bestehende Plugin-Server-Validierung und -Dispatch-Schicht für den vertraglichen Waste-Pfad `/api/v1/waste-management/*` und dessen Parameter ertüchtigen; die festen Waste-Routen und Handler-Exports aus Routing/Auth im selben Abschnitt löschen.
- Host-Authentifizierung, Tenant-Bindung, Rechte, CSRF, Audit, Fehlervertrag, Jobausführung und generische DB-/Secret-Fähigkeiten bleiben Host-Aufgaben. Die bestehende Waste-Runtime konsumiert diese Fähigkeiten über den Host-Kontext.

## Nicht-Ziele

- Keine Änderung von Touren-, Import-, PDF- oder Reminder-Fachregeln; keine DB-Schemaänderung, Datenlöschung oder neue Package-Familie.
- Kein Umbau der globalen Schema-Readiness (#1507), Registry-Provisionierung (#1508), allgemeinen Plugin-Lader (#1511/#1512) oder Queue-Isolation (#1407).
- Kein zweiter dauerhafter HTTP- oder Repository-Pfad und keine Kompatibilitäts-Barrels in Core/SDK/Auth.

## Impact

- Affected specs: `plugin-platform`, `waste-management` (bestehendes Verhalten bleibt maßgeblich), `public-waste-calendar` (bestehende Ausgabe bleibt maßgeblich).
- Maximal betroffene Bereiche: `packages/{core,plugin-sdk,waste-management-contracts,waste-management-runtime,plugin-waste-management,plugin-news,auth-runtime,routing,data-repositories,instance-registry,iam-governance,server-runtime}`, `apps/{sva-studio-react,public-waste-calendar-web}`, deren gezielte Tests, direkte Workspace-Abhängigkeiten, die Pfadeinträge der bestehenden Complexity-Policy und betroffene arc42-/Plugin-Dokumentation.
- Affected arc42: `04-solution-strategy.md`, `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`.
- Datenbank: nur Ownership des bestehenden Fach-SQL; keine Migration.

## Lieferfolge

#1505 ist die Voraussetzung für #1506. Die Umsetzung erfolgt in zwei eigenständig build- und testbaren PRs: PR 1 zieht alle Verträge/reinen Funktionen samt Verbrauchern ohne Rückexporte um; PR 2 baut auf dessen gemergtem Stand auf und verlagert Handler, Repositories und Dispatch. Wenn PR 1 nicht unabhängig grün wird, wird der Zuschnitt vor dem Push überarbeitet; es entsteht kein temporärer Kompatibilitätspfad. Ziel, Nicht-Ziele und maximale Bereiche werden für jeden PR vor dessen Codeänderung festgehalten.

## Erfolg

Core und SDK bauen/importieren ohne Waste-Fachpakete. Der allgemeine Auth-/Routing-Ausführungspfad lädt ohne Waste-Installation weder Waste-Handler noch Fach-SQL. Ein Build mit Waste behält die bestehenden HTTP-Pfade, Daten- und Fehlerverträge. Vollständige physische Optionalität des gesamten Studio-Artefakts hängt zusätzlich von #1507/#1508/#1511/#1512 ab. Die Nachweise in `design.md` gelten für den exakten Implementierungs-HEAD; das Proposal allein ist keine Abnahme.
