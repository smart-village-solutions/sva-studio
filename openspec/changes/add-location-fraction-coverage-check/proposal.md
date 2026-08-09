# Change: Vollständigkeit von Abholort-Zuordnungen prüfen

## Why

Für einen frei wählbaren Zeitraum ist derzeit nicht erkennbar, ob jeder aktive Abholort lückenlos einer Tour einer bestimmten Abfallfraktion zugeordnet ist. Fehlende Zuordnungen und Lücken zwischen den zentralen Gültigkeitszeiträumen der zugeordneten Touren müssen gezielt nachgepflegt werden können.

## What Changes

- Der Abholort-Bereich erhält eine Prüfung nach Abfallfraktion, Startdatum und Enddatum.
- Die Prüfung unterscheidet vollständig fehlende Zuordnungen von zeitlich unvollständiger Abdeckung durch zugeordnete aktive Touren; inaktive Touren zählen nicht als operative Abdeckung.
- Zeitlich unvollständige Ergebnisse weisen die konkreten Lücken aus.
- Betroffene Abholorte können über die bestehenden Einzel- und Sammelaktionen Touren zugeordnet werden.

## Impact

- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`
- Affected arc42 sections: keine; bestehende Plugin- und Datenflussgrenzen bleiben unverändert
