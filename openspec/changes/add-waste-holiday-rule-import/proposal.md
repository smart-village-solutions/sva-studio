# Change: Feiertagsbasierte Regelentwürfe im Waste Management

## Why
Das Waste-Management benötigt einen nachvollziehbaren, bundeslandspezifischen Feiertagsbestand als Grundlage späterer globaler Verschiebungsregeln. Bisher gibt es dafür weder ein persistiertes Bundesland-Setting noch einen strukturierten Import- und Pflegepfad.

## What Changes
- neues Bundeslandfeld in den Waste-Settings
- synchroner 10-Jahres-Sync gegen `feiertage-api.de` beim Settings-Speichern und per manueller Regeneration
- neuer persistierter Bestand für Feiertags-Regelentwürfe
- Scheduling-UI zur Pflege von Geltungsbereich und Strategie je Feiertag
- explizite Trennung zwischen importierten Feiertagsentwürfen und manuellen globalen Date-Shifts

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`, `packages/auth-runtime`, `packages/core`, `packages/data-repositories`
- Affected arc42 sections: keine Pflichtänderung; bestehende Settings- und Host-Fassaden bleiben architektonisch erhalten
