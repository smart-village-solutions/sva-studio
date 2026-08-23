## Context

Der Betreiberbereich ist Teil des bestehenden kontrollierten POI-Formulars. Er verwendet dieselben `react-hook-form`-Werte und Validierungsfehler wie die Detailseite sowie den bestehenden browserseitigen Geocoding-Client. Die Änderung darf weder einen zweiten Persistenzpfad noch einen abweichenden Berechtigungs- oder Host-Vertrag einführen.

## Goals / Non-Goals

- Goals:
  - den kritischen Fallow-Hotspot auflösen,
  - reine Feld-, URL- und Adressableitungen ohne React testbar machen,
  - asynchrone Geocoding- und Karten-Zustände in einem internen Controller bündeln,
  - bestehende Feld-IDs, Texte, Fehlerzustände und Mutationsreihenfolge erhalten.
- Non-Goals:
  - neue Operator-Felder oder neue UI,
  - Änderungen an POI-Payload, Validierung, Berechtigungen oder Host-Geocoding-Endpunkten,
  - Zusammenlegung mit der fachlich getrennten Hauptadresse des POI.

## Decisions

1. Pure Ableitungen liegen in `poi.detail-operator-shared.ts`; sie kennen weder React noch Browserzustand.
2. `poi.detail-operator-controller.ts` bleibt pluginintern und besitzt Formbindung, Konfigurationsabruf, Geocoding-Mutationen sowie Lade- und Fehlerzustände.
3. Präsentationale Abschnitte bleiben kontrolliert und verwenden die vorhandenen Studio-UI-Komponenten und Feld-IDs.
4. `PoiDetailOperatorTab` bleibt der einzige Einbindungspunkt für den Content-Tab und wird zur dünnen Komposition.
5. Die Basis ist `origin/main` auf `66d2cf9fca784a0b1a5319d107ef9927622f871d`; PR #986 und #987 sind enthalten.

## Risks / Trade-offs

- Mehr interne Dateien erhöhen die Navigationsbreite. Die Grenzen folgen jedoch den bereits getrennten Verantwortungen und exportieren keine neue öffentliche API.
- Kontakt- und Adresswerte werden für kontrollierte Eingaben abgeflacht. Characterization- und Pure-Helper-Tests sichern leere optionale Teilobjekte und unabhängige Web-URL-Änderungen ab.

## Migration Plan

Keine Daten- oder Laufzeitmigration. Der interne Komponentenimport bleibt unverändert.
