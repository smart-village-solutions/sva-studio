## 1. Spezifikation und Architektur

- [ ] 1.1 Spec-Deltas für `account-ui`, `routing` und `content-management` anlegen
- [ ] 1.2 Betroffene arc42-Abschnitte §04, §05, §06 und §08 auf den Registrierungsvertrag referenzieren
- [ ] 1.3 Deklarativen Zielzustand und Nicht-Ziele in `design.md` dokumentieren

## 2. SDK-Vertrag

- [ ] 2.1 Öffentlichen Admin-Ressourcen-Vertrag in `@sva/sdk` definieren
- [ ] 2.2 Minimale Metadaten für Identität, Titel, Guard, Route-Segmente und UI-Bindings festlegen
- [ ] 2.3 Historie-, Detail-, Erstellen- und Bearbeiten-Flächen als kanonische Beitragsarten modellieren

## 3. Host-Materialisierung

- [ ] 3.1 Host-Projektionspfad für registrierte Admin-Ressourcen einführen
- [ ] 3.2 Routing-Materialisierung für Listen-, Detail- und Editorpfade aus dem Vertrag ableiten
- [ ] 3.3 Navigation und Seitengerüst an registrierte Admin-Ressourcen anbinden

## 4. Referenzintegration

- [ ] 4.1 Mindestens eine bestehende Admin- oder Fachfläche als Referenz auf den Vertrag ausrichten
- [ ] 4.2 `plugin-example` oder gleichwertiges Referenzpackage auf den neuen Vertrag vorbereiten
- [ ] 4.3 App-lokale Sonderverdrahtungen identifizieren und abbauen

## 5. Qualitätssicherung

- [ ] 5.1 Unit-Tests für Vertrag und Host-Projektion ergänzen
- [ ] 5.2 Type-Tests für den öffentlichen SDK-Vertrag ergänzen
- [ ] 5.3 Betroffene Nx-/Type-/Runtime-Gates ausführen
