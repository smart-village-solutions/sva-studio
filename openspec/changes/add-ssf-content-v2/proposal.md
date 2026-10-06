# Change: SSF-Inhaltsverträge V2 im Studio bereitstellen

## Why

SSF benötigt getrennte Inhalte vor der Mandantenauswahl und nach der Mandantenbindung. Der bestehende V1-Endpunkt und die V1-Administration enthalten nur wenige Sprach- und Speichertexte. Der vereinbarte V2-Vertrag und der [freigegebene UI-Entwurf](../../../docs/development/ssf-v2-inhaltsverwaltung-ui.md) beschreiben die fehlenden Felder und ihre Bearbeitung.

## What Changes

- Das SSF-Plugin stellt `GET /internal/plugins/ssf/v2/installation-content` installationsweit und `GET /internal/plugins/ssf/v2/runtime-configuration` mandantengebunden bereit.
- Die Systemseite bearbeitet Installationsinhalte und eine globale Vorlage für Mandanten. Die Mandantenseite überschreibt einzelne Felder dieser Vorlage.
- Das Plugin speichert und validiert V2-Inhalte, löst die wirksamen Antworten auf und berechnet `configurationRevision` aus den effektiven Inhalten.
- Die erste UI bearbeitet nur die fünf vereinbarten Feedbackfragen; V2-Antworten und gespeicherte unbekannte Fragen bleiben erweiterbar.
- V1-Endpunkt, V1-Administration und bestehende Mandantendaten bleiben während der Umstellung funktionsfähig.

## Impact

- Affected specs: `ssf-content-v2` (neu), bestehende V1-Verträge bleiben unverändert.
- Affected code: `packages/plugin-ssf`, bestehender Plugin-Handler-Dispatcher und Studio-SSF-Servicezugriff in `apps/sva-studio-react` beziehungsweise `packages/auth-runtime` nur soweit für die zwei Routen nötig.
- Affected data: additive Migration der getrennten SSF-Plugin-Datenbank und deren Schema-Snapshot; keine Änderung des zentralen Studio-DB-Schemas.
- Affected docs: V2-Schemas und UI-Entwurf; arc42-Abschnitte für Laufzeit-/Trust-Grenzen.

## Scope

Studio liefert und administriert die zwei V2-Antworten. Die SSF-Anwendung, Feedbackantworten, ihr Rückimport und produktive Textfreigaben sind eigene Liefergegenstände. V1 bleibt für bestehende Verbraucher verfügbar.
