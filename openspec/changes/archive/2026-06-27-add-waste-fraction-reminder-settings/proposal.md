# Change: Erinnerungs-Konfiguration pro Abfallfraktion im Waste Management

## Why
Für künftige Abhol-Erinnerungen benötigen Abfallfraktionen eine fachliche Konfiguration, die vorgibt, welche Kanäle grundsätzlich verfügbar sind und welche kanalbezogenen Erinnerungs-Slots mit stabilen IDs, maximalen Vorlaufzeiten und UI-Defaults gelten. Die bisherige flache Zweifeld-Logik deckt das vorgegebene JSON-Schema nicht ab und reicht nicht aus, um spätere nutzerbezogene Einstellungen stabil gegen persistente Slot-IDs zu speichern.

## What Changes
- Erweiterung des Fraktionsmodells um eine direkte kanalbezogene Reminder-Konfiguration passend zum vorgegebenen JSON-Schema
- Persistenz und Host-Fassade für `reminder_config` als fachlich führenden Vertrag an `waste_fractions`
- Migration und Backfill der bisherigen flachen Reminder-Felder in das neue JSONB-Modell
- Fraktionsdialog mit kanalbezogenen Slot-Einstellungen für `push`, `email` und `calendar`
- Serverseitige Validierung und Normalisierung stabiler Slot-IDs, Lead-Day-Grenzen und kanalbezogener Defaults

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/core`, `packages/plugin-sdk`, `packages/data-repositories`, `packages/auth-runtime`, `packages/plugin-waste-management`, `apps/sva-studio-react`
- Affected arc42 sections: keine Pflichtänderung; bestehende Host-Fassade und Plugin-Boundary bleiben erhalten
