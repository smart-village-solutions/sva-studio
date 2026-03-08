# Implementation Tasks

## 1. Spec & Governance
- [ ] 1.1 Capability `complexity-quality-governance` mit normativen Requirements und Szenarien anlegen
- [ ] 1.2 `test-coverage-governance` um komplexitätssensitive Floors für kritische Module erweitern
- [ ] 1.3 Modulklassen `zentral` und `kritisch` samt Ownership, Geltungsbereich und Review-Zyklus definieren

## 2. Metrik-Erfassung & Policy
- [ ] 2.1 Automatisierte Erfassung für Dateigröße, Funktionslänge, Cyclomatic Complexity und öffentliche Exports implementieren
- [ ] 2.2 Versionierte Policy-Datei für Schwellwerte, Baselines und Ausnahmen einführen
- [ ] 2.3 Report-Ausgabe so gestalten, dass Modul, Datei, Metrik, Ist/Soll-Wert und Trend nachvollziehbar sind

## 3. Enforcement & Ticketing
- [ ] 3.1 CI-/PR-Workflow für Komplexitätsauswertung und strukturierte Summary ergänzen
- [ ] 3.2 Prozess oder Automation einführen, sodass jede Schwellwertüberschreitung auf ein Refactoring-Ticket verweist
- [ ] 3.3 Ausnahmeprozess dokumentieren, damit Überschreitungen nicht ohne begründete Nachverfolgung akzeptiert werden

## 4. Coverage-Governance für kritische Module
- [ ] 4.1 Kritische Module mit Mindest-Coverage-Floors in die bestehende Coverage-Policy aufnehmen
- [ ] 4.2 Bei steigender Komplexität Coverage-Floors anheben oder auf Paket-/Pfad-/Dateiebene feiner granulieren
- [ ] 4.3 Sicherstellen, dass Komplexitätsanstieg nie zu abgesenkten Coverage-Anforderungen führt

## 5. Dokumentation & Architektur
- [ ] 5.1 Entwicklerdokumentation für Quality-Gates, Schwellwerte und Refactoring-Folgeprozess ergänzen
- [ ] 5.2 arc42-Abschnitte `08-cross-cutting-concepts.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` aktualisieren
- [ ] 5.3 PR-/Review-Dokumentation um Nachweise für Komplexitätsüberschreitungen und Tickets erweitern
