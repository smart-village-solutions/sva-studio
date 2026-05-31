# Change: Tour-Duplizierung im Waste Management

## Why
Redakteure können Touren derzeit nur manuell neu anlegen oder bestehende Touren anpassen. Für wiederkehrende Tourkonfigurationen mit identischen Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen verursacht das unnötigen Erfassungsaufwand und erhöht das Fehlerrisiko.

## What Changes
- Neue Tabellenaktion `Duplizieren` im Tourenbereich
- Erweiterung des bestehenden Tour-Create-Flows um einen optionalen Duplizierungs-Kontext `duplicateFromTourId`
- Serverseitige Kopie von Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen nach erfolgreichem Speichern der neuen Tour
- UI-Hinweis im Duplizierungsfall, dass abhängige Daten erst nach dem Speichern übernommen werden

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`, `packages/auth-runtime`, `packages/data-repositories`
- Affected arc42 sections: keine Pflichtänderung; bestehende fachliche Architektur und Host-Fassade bleiben erhalten
