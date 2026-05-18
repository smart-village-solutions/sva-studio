# Change: Ausgabe-Tab und PDF-Erzeugung für den Abfallkalender

## Why
Für das Waste-Management fehlt aktuell ein produktiver Pfad, um aus den gepflegten Daten einen adressgenauen Abfallkalender als PDF zu erzeugen. Ein älterer Beispielgenerator existiert nur als Script mit Platzhalterdaten und ist nicht in Plugin, Runtime oder Datenmodell des Studios integriert.

## What Changes
- Neuer Waste-Management-Tab `Ausgabe` innerhalb des Plugins
- Erste Card `PDF-Ausdruck` für die Konfiguration einer Jahresausgabe pro Abholort
- Produktiver PDF-Generator auf Basis des bestehenden Beispiel-PDF-Bausteins
- Serverseitiger Erzeugungspfad für genau einen Abholort und genau ein Jahr
- Sichtbarkeit erzeugter PDF-Links zusätzlich in der Tabelle `Abholorte`
- Kein Vorschau-Viewer im `Ausgabe`-Tab im ersten Ausbau

## Impact
- Affected specs: `waste-management`
- Affected code:
  - `packages/plugin-waste-management/*`
  - `packages/auth-runtime/src/waste-management/*`
  - `packages/data-repositories/src/waste-management/*`
  - potenziell `packages/core/*` für das Dokumentmodell
  - Übernahme von Logik aus `scripts/ops/waste-calendar-example-pdf*.ts`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
