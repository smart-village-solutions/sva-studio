# Change: Erklärende Tooltips für Waste-Icon-Aktionen ergänzen

## Why

Reine Icon-Aktionsbuttons im Waste-Management sind zwar zugänglich beschriftet, erklären ihre Funktion visuell aber erst nach Interpretation des Symbols. Das bestehende Tooltip-Verhalten der Studio-Kopfzeile soll konsistent genutzt werden.

## What Changes

- Alle reinen Icon-Aktionsbuttons im Waste-Management erhalten einen erklärenden Tooltip.
- Tooltip und zugängliche Beschriftung verwenden denselben bereits übersetzten Text.
- Icons neben sichtbarem Text sowie rein dekorative Tab-, Überschriften- und Sortiersymbole bleiben unverändert.

## Impact

- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`
- Affected arc42 sections: keine; vorhandene Design-System-Primitiven werden wiederverwendet
