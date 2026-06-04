# Change: Erinnerungs-Konfiguration pro Abfallfraktion im Waste Management

## Why
Für künftige Abhol-Erinnerungen benötigen Abfallfraktionen eine fachliche Konfiguration, die vorgibt, ob Bürger keine, eine oder zwei Erinnerungen nutzen dürfen, welche maximale Vorlaufzeit je Erinnerung gilt und welche Kanäle grundsätzlich verfügbar sind. Diese Freigabe fehlt bisher vollständig im Waste-Management.

## What Changes
- Erweiterung des Fraktionsmodells um eine direkte Reminder-Konfiguration
- Persistenz und Host-Fassade für Reminder-Anzahl, maximale Vorlaufzeiten und globale Kanalfreigaben
- Fraktionsdialog mit einem neuen Erinnerungs-Abschnitt inklusive Dropdowns und Kanal-Switches
- Serverseitige Normalisierung nicht relevanter Reminder-Felder für kanonische Zustände

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/core`, `packages/plugin-sdk`, `packages/data-repositories`, `packages/auth-runtime`, `packages/plugin-waste-management`
- Affected arc42 sections: keine Pflichtänderung; bestehende Host-Fassade und Plugin-Boundary bleiben erhalten
