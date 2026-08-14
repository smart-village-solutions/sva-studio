## 1. Vertrag und Ausgangslage

- [x] 1.1 Bestehende Specs, konkurrierende Changes und Fallow-Ausgangswerte prüfen.
- [x] 1.2 Characterization-Tests für Regelpriorität, fehlenden Kontext, Geo-Hierarchie, Zeitfenster, Acting-as, Force-Deny und Provenance ergänzen und vor der Extraktion grün ausführen.

## 2. Implementierung

- [x] 2.1 ABAC-Eingaben in einen vollständig typisierten internen Regelkontext normalisieren.
- [x] 2.2 Geo-/Organisationsrestriktionen, Allow-Scopes, Zeitfenster, Acting-as und Force-Deny als kleine reine Evaluatoren extrahieren.
- [x] 2.3 Öffentlichen Einstieg und bestehende Entscheidungsreihenfolge unverändert erhalten; keine Suppressionen oder Fallback-Entscheidungen ergänzen.

## 3. Dokumentation und Qualität

- [x] 3.1 Arc42-Abschnitte 05, 08, 10 und 11 mit interner Boundary, fail-closed Reihenfolge, Qualitätsnachweis und Restrisiko aktualisieren.
- [x] 3.2 Fallow-Metriken und kanonische Complexity-Policy/Baseline prüfen; Baseline nur bei nachgewiesener echter Senkung ändern.
- [x] 3.3 Unit-, Type-, Lint-, Runtime-, Complexity-, OpenSpec- und Fallow-Gates ausführen.
- [x] 3.4 Vollständigen Diff prüfen und PR-Evidenz dokumentieren.
