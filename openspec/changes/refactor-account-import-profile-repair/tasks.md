## 1. Vertrag und Ausgangslage

- [x] 1.1 Bestehende Specs, aktive Changes und Fallow-Ausgangswerte prüfen.
- [x] 1.2 Betroffene Unit- und Type-Baseline auf unverändertem Produktivcode grün ausführen.
- [x] 1.3 Characterization-Matrix für Fallbacks, Blank-/Partial-/Konfliktfälle, Instanz-/Subject-Bindung, Fehler, Reihenfolge, Reporting und PII-freies Logging gegen den Altcode grün ausführen.

## 2. Implementierung

- [x] 2.1 Reinen internen Profilreparaturplan aus Quellprofil und lokalem Seed extrahieren.
- [x] 2.2 Seiteneffekt-Wiring und Einzelobjektverarbeitung ohne zusätzliche Provider-/Service-Abstraktion entflechten.
- [x] 2.3 Bestehende Fallback-, No-op-, genau-einmal-, Fehler- und Report-Semantik unverändert erhalten.

## 3. Dokumentation und Qualität

- [x] 3.1 Arc42-Abschnitte 05 und 08 um interne Entscheidungsgrenze und fail-closed Datenfluss ergänzen.
- [x] 3.2 Fallow-Vorher-/Nachherwerte und echte Nx-Coverage erfassen; keine Baseline oder Schwelle anheben.
- [ ] 3.3 Unit-, Type-, Lint-, Runtime-, Complexity-, OpenSpec-, File-Placement-, Changelog- und Fallow-Gates grün ausführen.
- [ ] 3.4 Vollständigen Diff und PR-Evidenz für Root- und unabhängiges Security-Review vorbereiten.
