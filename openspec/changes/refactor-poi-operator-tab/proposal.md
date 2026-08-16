# Change: POI-Betreiberbereich in testbare Verantwortungen zerlegen

## Why

`PoiDetailOperatorTab` bündelt kontrollierte Formularfelder, Geocoding-Konfiguration, Vorwärts- und Rückwärts-Geocoding, Kartenstatus, Validierungsanzeige und Darstellung in einer kritischen React-Funktion. Auf der nach PR #986 und #987 aktualisierten Basis `66d2cf9fca784a0b1a5319d107ef9927622f871d` misst Fallow 62 zyklomatische, 43 kognitive Komplexität und 341 Funktionszeilen.

## What Changes

- Bestehende Operator-Journeys werden vor der Extraktion durch Characterization-Tests für Felder, Web-URL-Paare, Ladezustände, Fehler, Karte und Geocoding fixiert.
- Reine Ableitungen werden von React getrennt; Formular-, Konfigurations- und Geocoding-Zustand liegen in einem kleinen internen Controller.
- Kontakt, Adresse, Geocoding-Aktionen, Karte und Koordinaten werden als getrennte präsentationale Abschnitte gerendert.
- UI, Texte, Berechtigungen, Validierung, Mainserver-Payload und Host-Geocoding-Vertrag bleiben unverändert.
- Die Reduktion wird über Fallow und das kanonische Complexity-Gate nachgewiesen, ohne Suppression oder Grenzwertänderung.

## Impact

- Affected specs: `complexity-quality-governance`
- Affected code: `packages/plugin-poi/src/poi.detail-operator-*` und zugehörige POI-Tests
- Affected arc42 sections: `05-building-block-view`, `10-quality-requirements`
- Breaking changes: keine
