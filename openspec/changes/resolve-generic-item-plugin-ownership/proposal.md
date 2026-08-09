# Change: Plugin-Zuständigkeit für GenericItems auflösen

## Why

Die gemeinsame Inhaltsübersicht kann denselben Mainserver-Datensatz derzeit gleichzeitig als generischen und als fachlichen Inhalt anzeigen. Dadurch erscheinen beispielsweise Featured Projects zusätzlich als „Generische Inhalte“, obwohl ein registriertes Fachplugin ihren `genericType` bereits übernimmt.

## What Changes

- Fachplugins deklarieren ihren übernommenen Mainserver-`genericType` im Build-time-Registry-Vertrag.
- Die Registry erzwingt eine eindeutige Zuständigkeit je `genericType`.
- Die gemeinsame Inhaltsübersicht zeigt ein GenericItem ausschließlich über das zuständige Fachplugin; ohne registrierte Zuständigkeit übernimmt das Generic-Items-Plugin die Darstellung.
- Die Klassifikation ist unabhängig von den effektiven Rechten der lesenden Person. Fehlende Fachrechte führen nicht zu einem generischen Fallback in der gemeinsamen Inhaltsübersicht.
- Das eigenständige Modul „Generische Inhalte“ bleibt ein technischer Vollzugriff auf alle Mainserver-GenericItems.
- Die bisher ausdrücklich erlaubte doppelte Darstellung aus `allow-all-generic-items` wird für die gemeinsame Inhaltsübersicht aufgehoben.

## Impact

- Affected specs: `content-management`, `plugin-platform`, `sva-mainserver-integration`
- Affected code: Plugin-SDK und Build-time-Registry, GenericItem-Klassifikation und Inhaltsprojektion in `apps/sva-studio-react` und `packages/sva-mainserver`, zugehörige Tests
- Affected docs: GenericItems-Betriebsvertrag sowie arc42-Abschnitte 05, 06, 08 und gegebenenfalls 09
- Keine Datenbankmigration und keine Änderung des Mainserver-Datenmodells
