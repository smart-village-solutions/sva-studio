# Gemeinsame Datumseingabe für Studio

## Why

Issue #1280 zeigt unterbrochene Datumseingabe und Kalendernavigation im Veranstaltungseditor. Eine gemeinsame Komponente soll Maus- und Tastaturbedienung, Lokalisierung und zugängliche Fehlerbehandlung für weitere Verbraucher bereitstellen.

## What Changes

- Gemeinsamer DatePicker mit shadcn-/Radix-Popover und React DayPicker.
- Direkt beschreibbare lokale Datumseingabe und ISO-Kalenderdatum als Wert.
- Erstintegration in alle Terminzeilen des Veranstaltungseditors; Entfernung der fehlerhaften Ersetzung der gesamten Terminliste.
- Gezielte Unit-, Typ- und Browserprüfungen sowie Nutzungsdokumentation.

Der Umfang wurde im Arbeitsdialog freigegeben. Der konkrete Vertrag steht in [Datumseingabe](../../../docs/development/datumseingabe.md).

## Impact

Betroffen sind `studio-ui-react`, `plugin-events` und die Capability `ui-layout-shell`. API-/Datenbankschemata bleiben unverändert. Weitere Verbraucher können anschließend gezielt migriert werden.

Die gemeinsame UI-Bausteinsicht ist in [arc42 Abschnitt 5](../../../docs/architecture/05-building-block-view.md) aktualisiert.
