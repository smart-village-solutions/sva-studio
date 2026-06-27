# Change: Benutzerdefinierte Abstandspresets im Waste Management

## Why
Die festen Turnuswerte der Waste-Touren decken Standardfälle ab, erlauben aber keine instanzspezifischen zusätzlichen Abstände, die zentral gepflegt und in mehreren Touren wiederverwendet werden können. Fachlich wird deshalb ein ergänzendes Preset-Modell benötigt, das an den Waste-Einstellungen der aktiven Instanz hängt.

## What Changes
- Neue instanzbezogene Abstandspresets im Settings-Bereich des Waste-Managements
- Erweiterung des Tour-Modells um eine optionale Preset-Referenz `customRecurrenceId`
- Terminauflösung für benutzerdefinierte Tagesabstände zusätzlich zu den festen Default-Turnussen
- Löschdialog mit verpflichtender Fallback-Auswahl für referenzierte Presets

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/core`, `packages/plugin-sdk`, `packages/data-repositories`, `packages/auth-runtime`, `packages/plugin-waste-management`, `apps/public-waste-calendar-web`, `apps/sva-studio-react`
- Affected arc42 sections: keine Pflichtänderung; bestehende Host-Fassade und Instanzgrenzen bleiben erhalten
