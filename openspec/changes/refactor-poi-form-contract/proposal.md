# Change: POI-Formvertrag verhaltensgleich entflechten

## Why

Das produktive POI-Formular besitzt zwei stark verzweigte Transformationsrichtungen: bestehende Mainserver-Inhalte werden in Formularwerte gemappt und bearbeitete Formularwerte werden wieder in den Mutationsvertrag serialisiert. Die derzeitige Komplexität erschwert die sichere Pflege von Legacy-, Clear-, Reihenfolge- und Fallback-Semantik und erhöht damit das Risiko unbemerkter Datenverluste.

## What Changes

- Der bestehende POI-Inbound-Mapper wird durch fachlich benannte, pluginlokale Transformationen vereinfacht.
- Die POI-Serialisierung wird entlang der bestehenden Feldgruppen entkoppelt, ohne den Mainserver- oder Formularvertrag zu verändern.
- Characterization-Tests sichern Legacy-Daten, explizite Leerungen, ungültige Runtime-Werte, Reihenfolge, Fallbacks und Roundtrips vor der produktiven Änderung ab.
- UI-Primitives, Validierung, öffentliche Typen und Cross-Plugin-Abstraktionen bleiben unverändert.

## Impact

- Affected specs: `content-management`
- Affected code: `packages/plugin-poi/src/poi.detail-form.mapping.ts`, `packages/plugin-poi/src/poi.detail-form.serialization.ts`, `packages/plugin-poi/tests/poi.detail-form.test.ts`
- Affected arc42 sections: keine; pluginlokales, verhaltensgleiches Refactoring ohne neue Architektur- oder Ownership-Grenze
- Related changes: `refactor-shared-editor-primitives` bleibt für UI-Sections und Repeater zuständig; `add-studio-data-form-and-test-foundations` bleibt für gemeinsame Formular- und Test-Foundations zuständig
