## 1. OpenSpec und Architektur

- [ ] 1.1 Spec-Deltas für `content-management`, `routing`, `account-ui` und `monorepo-structure` anlegen
- [ ] 1.2 Betroffene arc42-Abschnitte in `docs/architecture/` identifizieren und Aktualisierungen planen

## 2. SDK und Plugin-Vertrag

- [ ] 2.1 `@sva/sdk` um einen stabilen Plugin-Vertrag für Plugin-Metadaten, Navigation, Routen und Content-Type-Definitionen erweitern
- [ ] 2.2 Registry-/Merge-Helfer für Plugin-Routen, Plugin-Navigation und Plugin-Content-Types ergänzen
- [ ] 2.3 Tests für den neuen SDK-Vertrag und die Merge-Logik ergänzen

## 3. News-Plugin

- [ ] 3.1 Neues Workspace-Package `@sva/plugin-news` anlegen
- [ ] 3.2 News-Content-Type `news` mit Payload-Validierung definieren
- [ ] 3.3 Plugin-Routen für Liste, Neu-Anlage und Bearbeitung definieren
- [ ] 3.4 Plugin-spezifische Listen- und Editor-UI für News erstellen

## 4. Studio-Integration

- [ ] 4.1 Plugin-Registrierung im Studio-Kern einführen
- [ ] 4.2 Plugin-Routen in den bestehenden Route-Baum integrieren
- [ ] 4.3 Plugin-Navigation in die Shell integrieren
- [ ] 4.4 Guards für Plugin-Routen auf bestehende Account-/Content-Schutzmechanismen aufsetzen

## 5. IAM- und Content-Wiederverwendung

- [ ] 5.1 Bestehende IAM-Content-Endpoints für `contentType = news` nutzbar machen
- [ ] 5.2 Optionalen serverseitigen `contentType`-Filter für Content-Listen ergänzen
- [ ] 5.3 Historie, Statusmodell und Aktivitätslogs unverändert für News wiederverwenden

## 6. Tests und Dokumentation

- [ ] 6.1 Unit- und Integrationstests für News-Plugin, SDK-Registrierung und Content-Filter ergänzen
- [ ] 6.2 E2E-Szenario für News anlegen, bearbeiten und veröffentlichen ergänzen
- [ ] 6.3 Relevante Doku unter `docs/` und die betroffenen arc42-Abschnitte aktualisieren
