## 1. Analyse und Design
- [ ] 1.1 Bestehende Operator-Schritte für `realmMode = new` und `realmMode = existing` fachlich auseinanderziehen
- [ ] 1.2 Gemeinsame Detail-Shell und modusspezifische Workflow-Views konzipieren
- [ ] 1.3 Statusmodell für Aufbau-, Diagnose- und Historienzustände definieren
- [ ] 1.4 Die reale `new realm`-Schrittkette aus Registry, Preflight, Plan, Keycloak-Ausführung, Secret-Sync und Abschlussvalidierung als führendes UI-Modell festziehen
- [ ] 1.5 Den Abschluss des `new`-Kernflows und die explizite Abgrenzung von Tenant-IAM-/Modul-IAM-Folgearbeiten festziehen

## 2. Spec-Deltas
- [ ] 2.1 `account-ui` um modusspezifische Detailansicht und progressive Workflow-Führung erweitern
- [ ] 2.2 `instance-provisioning` um mode-aware Bewertung erwartbarer vs. defekter Artefakte ergänzen
- [ ] 2.3 Für `new realm` explizit festlegen, welche Zwischenausgaben, Evidenzquellen und Next-Step-Ableitungen pro Teilphase sichtbar sein müssen
- [ ] 2.4 Die feste Prioritätsregel für die primäre nächste Aktion und die kompakte Erstblick-/Detailtrennung normativ festhalten

## 3. Umsetzungsplanung
- [ ] 3.1 Ableiten, welche UI-Bausteine in gemeinsame Shell, `NewRealmOperationsView` und `ExistingRealmOperationsView` zerlegt werden
- [ ] 3.2 Teststrategie für beide Modi und deren Statusprojektionen festlegen
- [ ] 3.3 Edge-Case-Strategie für Teil-Erfolge, Moduskonflikte, veraltete Evidenz und nicht ausführbare Aktionen festlegen
- [ ] 3.4 Betroffene arc42-Abschnitte unter `docs/architecture/` für die spätere Umsetzung markieren
- [ ] 3.5 Verbindliche Qualitätsstrategie für Coverage- und Complexity-Gates festlegen, inklusive zusätzlicher Tests und nötiger Vereinfachung kritischer Komponenten
- [ ] 3.6 Mapping definieren, wie aus Preflight, Plan, Run-Schritten und finalem Status jeweils die eine primäre nächste Aktion abgeleitet wird
- [ ] 3.7 Den minimalen Implementierungszuschnitt festlegen: zuerst nur Überblick/Projektionslogik für `new`, Folgearbeiten und Sekundärbereiche nachgelagert

## 4. Qualitäts-Gates für die Umsetzung
- [ ] 4.1 Die spätere Implementierung so zuschneiden, dass die betroffenen Packages die bestehenden Coverage-Gates des Repositories weiterhin erfüllen
- [ ] 4.2 Die spätere Implementierung so strukturieren, dass die betroffenen Dateien und Flows die bestehenden Complexity-Gates des Repositories weiterhin erfüllen
- [ ] 4.3 Happy-Path- und Edge-Case-Tests für beide Realm-Modi als Gate-relevante Abdeckung ergänzen
- [ ] 4.4 Vor Abschluss der Umsetzung die relevanten Gate-Kommandos im PR-Standard-Workflow ausführen und dokumentieren
- [ ] 4.5 Tests ergänzen, die für `new realm` die korrekte Schrittfolge, Fehlerlokalisierung und Next-Step-Ableitung absichern
- [ ] 4.6 Tests ergänzen, die die feste Prioritätsregel und die Trennung von Kernworkflow vs. Folgearbeiten absichern
