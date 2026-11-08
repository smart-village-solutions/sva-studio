# Change: Test-Gates ohne Verlust von Freigabenachweisen beschleunigen

## Why

Aktuelle GitHub-Läufe benötigen 21–28 Minuten für Voll-Coverage; App-Routen und Abfallplugin verbringen über 70 Prozent ihrer Vitest-Zeit in Imports. Der Nutzer hat den detaillierten Umsetzungsplan am 8. November 2026 freigegeben; zusätzliche Runner sind ausdrücklich zulässig.

## What Changes

- Doppelte Typprüfung entfernen und nachgewiesene Importkosten reduzieren.
- App-Unit-, Coverage- und E2E-Tests über isolierte Runner aufteilen.
- Vollständigkeit und Commit-Identität vor jeder aggregierten Freigabe prüfen.
- Sonar von der Testausführung trennen; keine Coverage-Floors oder Szenarien entfernen.

## Impact

Betroffen: bestehende Testkonfiguration, CI-Steuerung, Workflow-Aggregation und Testing-Dokumentation. Produkt-APIs, Datenbank und Deployment-Prozess bleiben unverändert. Relevante arc42-Sicht: Querschnittskonzepte/Qualitätssicherung.
