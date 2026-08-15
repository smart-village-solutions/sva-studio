# Plan 007: Öffentliche Waste-Konfiguration normalisieren

## Status

- Status: DONE
- Priorität: P1
- Aufwand: M
- Risiko: HIGH
- Abhängigkeit: Überschneidungen mit PR #983 und #984 müssen ausgeschlossen sein
- Kategorie: Datenvalidierung und öffentliche Konfiguration

## Ziel und Ist-Zustand

`packages/core/src/waste-management-settings-public-config.ts` enthält in der
Normalisierung der E-Mail-Reminder-Konfiguration einen Fallow-Hotspot mit 56
zyklomatischen, 44 kognitiven Verzweigungen und 183 Zeilen. Die Funktion liegt
an einer öffentlichen Konfigurations- und Sicherheitsgrenze.

## Scope und Vorgehen

- gültige, partielle, fehlerhafte und unbekannte Eingaben vorab charakterisieren,
- kleine typisierte Parser für Empfänger, Zeitfenster, Signierung und optionale
  Felder extrahieren,
- bisheriges Fail-closed-Verhalten und Secret-Ausblendung unverändert halten,
- keine neuen Defaults und keine Änderung am serialisierten Vertrag einführen,
- bestehende Plattform-/Workspace-Validatoren wiederverwenden.

## Verifikation

- Core-Vertrags- und Public-Config-Unit-Tests inklusive Negativmatrix,
- Core Types, Server-Runtime, Complexity-Gate, Fallow und OpenSpec strict,
- betroffene Waste-Konsumenten mindestens typprüfen.

## Fertig, wenn

- der Hotspot nicht mehr kritisch ist,
- öffentliche Ausgabe und Secret-Grenze byte-/semantikgleich abgesichert sind,
- keine neue Validierungsabhängigkeit ohne belegten Ownership-Vorteil entsteht.

## STOP-Bedingungen

- ein offener Waste-PR ändert dieselbe Datei oder denselben Vertrag,
- Characterization zeigt widersprüchliche Defaults oder ein ungeklärtes Leak.

## Abschluss

- PR: #995
- Merge-Commit: `067e7a8e646589936bc7d59fa1f8260093e76096`
- Ergebnis: `normalizeWasteManagementEmailReminderConfig` von 56/44/183 auf
  3/2/11 (zyklomatisch/kognitiv/Funktionszeilen) reduziert. Die 46-fällige
  Parser-Matrix schützt Pflicht-/Optionalfelder, kanonische Key-Reihenfolge und
  Secret-Grenze; Fallow new-only endet ohne eingeführte Befunde.
