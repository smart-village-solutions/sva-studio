# Change: Waste-Touren und Fraktionen relational zuordnen

## Why

`waste_tours.waste_fraction_ids` speichert Referenzen als `TEXT[]` ohne Fremdschlüssel. Der reguläre Fraktions-Löschpfad kann deshalb verwendete Fraktionen entfernen und verwaiste Tour-Zuordnungen hinterlassen; Kalender und Erinnerungen finden diese Fraktionen anschließend nicht mehr.

Stand der Analyse: `2b5761662`, 2026-10-30. Es wurden keine Bestandsdaten oder Live-Datenbanken geprüft. Die Implementierung und die Expand/Contract-Anpassung wurden am 2026-10-30 vom Nutzer freigegeben. Ein Rollout ist nicht freigegeben.

## What Changes

- Tour–Fraktions-Zuordnungen erhalten eine eigene Tabelle `waste_tour_fractions` innerhalb jeder bestehenden Waste-Tenant-Datenbank, mit UUID-Fremdschlüsseln, eindeutigem Paar und erhaltener Reihenfolge.
- Das Löschen einer verwendeten Fraktion wird durch die Datenbank gesperrt und über den vorhandenen HTTP-409-Konfliktpfad beantwortet. Beim Löschen einer Tour werden nur deren Zuordnungen mitgelöscht.
- Tour und Zuordnungen werden über alle Schreibpfade atomar geändert. Gleichzeitige Touränderungen und Fraktionslöschungen bleiben konsistent.
- Bestehende öffentliche Verträge `wasteFractionIds: string[]`, Import-/Exportfelder und Berechtigungen bleiben erhalten.
- **BREAKING (internes DB-Schema):** Erst in der standardmäßig deaktivierten Contract-Stufe nach geprüftem Wechsel aller Verbraucher entfallen Arrayspalte und zugehöriger GIN-Index. Alte Anwendungsversionen sind danach inkompatibel.
- Der bestehende Waste-Migrationskatalog, Schema-Builder, Schema-Prüfung und Revisionsmechanismus werden erweitert; es entsteht kein zweiter Migrations- oder Deploymentpfad.

## Scope und Nicht-Ziele

Ziel des späteren Implementierungs-PRs ist ausschließlich die referenziell sichere, verlustfreie Speicherung und Nutzung der Beziehung zwischen Waste-Touren und Fraktionen.

Maximal betroffen sind Waste-Schema/Bestandsmigration, zugehörige Runtime-Repositories und Operationen, Datenaustausch, Jahresübernahme, Mainserver-Revisionsverfolgung sowie die direkten PostgreSQL-Leser des öffentlichen Kalenders und der Erinnerungen. Dazu kommen zugehörige Tests und aktuelle Dokumentation.

Nicht-Ziele sind andere Arrayfelder, neue Termin- oder Wiederholungslogik, allgemeines Index-Tuning, neue Plattformabstraktionen, zusätzliche Services und eine Neugestaltung der UI. Keine automatische Bereinigung ungültiger Bestandsdaten; keine Änderungen an IAM oder SSF.

## Impact

- Betroffene Specs: `waste-management`, `public-waste-calendar` (additive Integritäts- und Migrationsanforderungen; bestehende Anforderungen gelten weiter).
- Betroffene Codepfade und Nachweise: siehe `design.md` und `tasks.md`.
- Betroffene arc42-Abschnitte: `docs/architecture/05-building-block-view.md` (Persistenzzuständigkeit), `06-runtime-view.md` (atomare Mutation und Sync), `08-cross-cutting-concepts.md` (Integrität und Migration), `07-deployment-view.md` (Kompatibilitätsgrenze, soweit betroffen).
- Schema-Dokumentation: `docs/development/studio-db-schema.md`; zentralen Snapshot `studio-db-schema-final.sql` auf Betroffenheit prüfen. Fachliche Waste-Tenant-Tabellen bleiben außerhalb der zentralen IAM-Migrationen.
- Reguläre Auslieferung ausschließlich gemäß `docs/guides/studio-rollout-process.md`. Expand bleibt mit Altverbrauchern kompatibel; Contract erfordert eine ausdrückliche Betriebsbestätigung nach dem vollständigen Verbraucherwechsel. Details und Endbedingung stehen im Design.
