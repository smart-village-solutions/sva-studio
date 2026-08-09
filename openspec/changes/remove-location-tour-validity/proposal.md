# Change: Ortsbezogene Tour-Gültigkeit entfernen

## Why

Der Gültigkeitszeitraum einer Waste-Tour wird zentral an der Tour gepflegt. Zusätzliche Start- und Enddaten an einzelnen Abholort-Zuordnungen erlauben widersprüchliche Zeiträume und entsprechen nicht dem gewünschten Fachmodell. Zudem ist die Reihenfolge der Abholorte im Zuordnungsdialog derzeit teilweise von ihrer Erstellungsreihenfolge abhängig.

## What Changes

- **BREAKING**: `startDate` und `endDate` werden aus dem Vertrag und der Persistenz von Orts–Tour-Zuordnungen entfernt.
- Vorhandene ortsspezifische Gültigkeitswerte werden ersatzlos entfernt; für alle zugeordneten Abholorte gilt ausschließlich der Zeitraum der Tour.
- Die Terminmaterialisierung wertet keine ortsspezifischen Zeitgrenzen mehr aus.
- Der Zuordnungsdialog zeigt ausgewählte Abholorte zuerst und sortiert innerhalb der ausgewählten und nicht ausgewählten Gruppe deterministisch nach Region, Ort und Straße.
- Import-, Duplizierungs-, Dokumentations- und Testpfade werden auf das zentrale Tour-Gültigkeitsmodell angepasst.

## Impact

- Affected specs: `waste-management`
- Affected code: Waste-Core-Verträge, Auth-Runtime-Handler und -Schemas, Waste-Repository, Runtime-Schema und Import, Mainserver-Terminmaterialisierung, Waste-Plugin und Tests
- Affected arc42 sections: keine neue Architekturgrenze; bestehende Waste-Bausteine und Datenflüsse bleiben erhalten
