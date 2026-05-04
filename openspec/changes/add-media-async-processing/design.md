# Design: Asynchrone Medienverarbeitung

## Zielbild

Der Folge-Change löst teure oder fehleranfällige Bildverarbeitung aus dem synchronen Request-Pfad. Upload-Abschluss bestätigt nur Validierung und Job-Annahme; Varianten, seltene Presets und nachgelagerte Prüfungen laufen in einem dedizierten Worker.

## Leitplanken

- kein Fachmodul erhält direkten Zugriff auf Queue- oder Storage-Artefakte
- Upload- und Asset-Status bleiben fail-closed und auditierbar
- bestehende `MediaReference`-Verträge und Delivery-Pfade bleiben kompatibel

## Offene Entscheidungen

- konkrete Queue-Technologie
- Retry-Strategie und Dead-Letter-Policy
- Trennung zwischen eager Kleinstvarianten und vollständig asynchroner Verarbeitung
