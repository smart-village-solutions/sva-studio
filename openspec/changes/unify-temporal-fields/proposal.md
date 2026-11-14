# Einheitliche Datums- und Zeitverarbeitung

## Why

Der gemeinsame DatePicker ist bisher nur in Veranstaltungen integriert. Andere Eingaben und Anzeigen verwenden unterschiedliche Browser-/Formatierungspfade; die fachlichen Werte und API-Formate müssen bei ihrer Vereinheitlichung erhalten bleiben.

## What Changes

- Bestehende UI-Bausteine um gemeinsame Kalenderdatum-, Uhrzeit- und lokale Datum/Uhrzeit-Eingaben ergänzen; vorhandene Formatter im SDK wiederverwenden und vervollständigen.
- Alle entsprechenden App-/Plugin-Verbraucher auf die passenden Bausteine umstellen; Fachkalender für Mehrfachauswahl erhalten.
- API-Serialisierung je Feldvertrag explizit prüfen: Kalendertag, Uhrzeit, lokaler Datum/Uhrzeit-Wert oder absoluter Zeitpunkt. API-spezifische Regeln verbleiben im zuständigen Adapter.
- Payload-, Roundtrip-, Locale- und Zeitzonentests sowie gezielte Interaktionsprüfungen ergänzen.

Der Entwurf und die Umsetzung wurden am 14.11.2026 im Arbeitsdialog freigegeben; Umsetzung im separaten Worktree. #1274, #1280 und #1283 bleiben geschlossen.

## Impact

Betroffen: `studio-ui-react`, `plugin-sdk`, die zeitbezogenen Felder und Anzeigen der Studio-App und Fachplugins sowie bestehende Serializer/API-Adapter, soweit die Prüfung einen Fehler belegt. Keine API-/DB-Schemaänderung, Datenmigration, neue Packages oder Änderung von Veröffentlichungspolitik und fachlichen Terminregeln. Architekturabschnitte 5 und 8 sowie die bestehende Datumseingabe-Dokumentation werden fortgeschrieben.


## Verbindlicher PR-Zuschnitt

Ziel: Datums-/Zeitwerte in den bestehenden Studio-Oberflächen einheitlich erfassen und darstellen, ihre fachlichen API-Formate erhalten und den ausdrücklich beauftragten bestehenden i18n-Formatterfehler beheben.

Nicht-Ziele: API-/DB-Schemaänderungen, Datenmigration, neue Packages/Provider, geänderte Veröffentlichungs- oder Terminregeln, Wiedereröffnung der abgeschlossenen Tickets sowie Merge oder Rollout.

Maximal betroffene Bereiche: bestehende zeitbezogene UI-/SDK-Pfade, ihre App-/Plugin-Verbraucher und Tests, notwendige bestehende Alias-/Importgrenzen und Abhängigkeiten, der vorhandene i18n-Formatter samt Ressourcenstruktur sowie die zugehörige Entwicklungs-/Architekturdokumentation und dieser OpenSpec-Change. Der i18n-Folgeauftrag erhält alle bisherigen Übersetzungsschlüssel und Werte.
