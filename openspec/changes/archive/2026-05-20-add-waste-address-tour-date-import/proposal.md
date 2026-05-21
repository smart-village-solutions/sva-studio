# Change: Neuer Waste-Import für Tourzuordnungen nach Fraktionen

## Why
Der bestehende Waste-Import deckt kanonische Stammdaten-, Tour- und Ausweichtermin-Tabellen ab, aber nicht das fachnahe CSV-Format `Region?;Ort;Straße?;Hausnummern?;Hausmüll;Papier;...`, in dem die Fraktionsspalten die Abfallarten definieren und die Zellwerte Tourbezeichnungen enthalten.

## What Changes
- Neues spezialisiertes Waste-Importprofil für Tourzuordnungen nach Fraktionen mit optionalem Region-/Hausnummernblock und dynamischen Fraktionsspalten
- Auto-Anlage fehlender Abfallarten, Touren und Adressstammdaten statt neuer Terminpersistenz
- Neuer synchroner Preview-Endpunkt mit Delimiter-Override, Fehlerliste und Importvorschau
- Erweiterte Waste-Import-UI mit Vorlage, Preview, Fehlerdatei und Import-Gating

## Impact
- Affected specs: `waste-management`, `plugin-operations-platform`
- Affected code: `packages/core`, `packages/data-repositories`, `packages/auth-runtime`, `packages/plugin-waste-management`, `apps/sva-studio-react`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`
