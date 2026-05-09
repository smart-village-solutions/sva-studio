## 1. Specification

- [x] 1.1 Neue Capability `plugin-operations-platform` für generische Plugin-Jobs und strukturierte Importe spezifizieren
- [x] 1.2 Build-Time-Registry-, `plugin-sdk`- und Package-Boundaries für Jobtypen und Importprofile spezifizieren
- [x] 1.3 Host-Routing- und Runtime-Einbindung über den typisierten Route-Katalog spezifizieren
- [x] 1.4 Zentrale Persistenz- und Governance-Grenzen für pluginübergreifende Jobs spezifizieren
- [x] 1.5 Architekturwirkungen auf Package-Zielarchitektur, Runtime-Sicht und Querschnittskonzepte dokumentieren
- [x] 1.6 `openspec validate update-plugin-platform-for-generic-jobs-imports --strict` ausführen

## 2. Slice A: Plugin-Verträge und Registry

- [x] 2.1 In `packages/plugin-sdk` deklarative Beitragstypen für registrierte Jobtypen definieren
- [x] 2.2 In `packages/plugin-sdk` deklarative Beitragstypen für registrierte Importprofile definieren
- [x] 2.3 Die Build-Time-Registry so erweitern, dass Operations-Beiträge deterministisch validiert und publiziert werden
- [x] 2.4 Guardrails für Namespace, Ownership, Kollisionen und Pflichtfelder der neuen Operations-Beiträge ergänzen

## 3. Slice B: Gemeinsame Core- und API-Verträge

- [x] 3.1 In `packages/core` gemeinsame Typen für Jobstatus, Jobdetail, Jobstart, Importprofil-Metadaten und Ergebniszustände ergänzen
- [x] 3.2 Gemeinsame Error- und Statusverträge für hostgeführte Plugin-Operations-Endpunkte festlegen
- [x] 3.3 Klar dokumentieren, welche Felder generisch stabil sind und welche fachpluginspezifisch bleiben

## 4. Slice C: Persistenz und Host-Runtime

- [x] 4.1 In `packages/data-repositories` die zentrale Persistenz für pluginübergreifende Jobs im Studio-Postgres anlegen
- [x] 4.2 In `packages/server-runtime` und `packages/auth-runtime` die Host-Orchestrierung für Jobstart, Statusabfrage und Fehlerabbildung ergänzen
- [x] 4.3 Sicherstellen, dass externe Fachdatenbanken keine führende Persistenz für die generische Jobplattform werden

## 5. Slice D: Routing und Host-Einbindung

- [x] 5.1 Den typisierten Runtime-Route-Katalog für generische Plugin-Operations-Endpunkte erweitern
- [x] 5.2 Die Handler-Mappings in `packages/routing` und `packages/auth-runtime` an die neuen Endpunkte anbinden
- [x] 5.3 Optionale erste Host-UI-Einstiege nur so weit ergänzen, wie sie keinen Monitoring- oder Wizard-Vollausbau erzwingen

## 6. Slice E: Tests und Doku

- [x] 6.1 Unit- und Type-Tests für neue Plugin-Registry-, Core-, Routing- und Runtime-Verträge ergänzen
- [x] 6.2 Architektur- und Entwicklerdoku für Operations-Beiträge, zentrale Job-Persistenz und Host-Grenzen fortschreiben
- [x] 6.3 Dokumentieren, dass Fachchanges wie Waste diese Plattform konsumieren statt neu definieren
