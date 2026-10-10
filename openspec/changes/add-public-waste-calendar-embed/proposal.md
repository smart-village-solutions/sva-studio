# Change: Abfallkalender direkt in externe Webseiten einbetten

## Why
Externe Webseiten benötigen eine Integration über div und JavaScript ohne iframe. Der bestehende Kalender startet ausschließlich als eigene Seite.

## What Changes
- Freigegebener Entwurf: bestehende React-UI im offenen Shadow DOM eines div rendern, mit eigener Regionsbindung und API-Origin pro Instanz.
- Zweiter Browser-Einstieg im bestehenden App-Build; keine neue App, Dependency oder Datenquelle.
- Öffentliche API und Browser-Assets für Cross-Origin-Nutzung ohne Credentials freigeben; bestehende Validierung und Rate Limits erhalten.
- Tastatur, Fokus, ARIA-Beziehungen und Exporte im eingebetteten Kontext prüfen.

## Impact
- Affected specs: public-waste-calendar
- Affected code: apps/public-waste-calendar-web (Browser-Einstieg, API-Aufrufe, Fokus, Build und öffentliche HTTP-Antworten)
- Affected arc42: 05 Bausteinsicht und 08 Querschnittliche Konzepte
- Nicht-Ziele: Backend-Fachlogik, Datenmodell, neue Themes, Studio-Plugin, Deployment oder PR-Erstellung.

## Invarianten und Nachweise
- Host-URL bestimmt nie Widget-Region; zwei Widgets teilen keinen veränderlichen API-Zustand: Unit- und Browser-Test.
- Host-CSS und Widget-CSS bleiben getrennt; kein iframe und keine Änderung der Host-Navigation: Browser-Test.
- Bestehende öffentliche Endpunkte behalten Validierung und Limits; CORS enthält keine Credential-Freigabe und gilt nicht für Erinnerungsbestätigung/Abmeldung: Runtime-Tests.
- Regionsauswahl, Tastatur, Dialogfokus, PDF und iCal verwenden vorhandene Komponenten: Unit-Tests und Browser-Test mit Axe. Eine manuelle Screenreader-Prüfung bleibt gesondert erforderlich.
