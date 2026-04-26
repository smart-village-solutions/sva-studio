## 1. Specification

- [ ] 1.1 Host-Standards für Suche, Filter, Bulk-Actions, Historie und Revisionen spezifizieren
- [ ] 1.2 Abgrenzung zwischen Host-Funktion und Package-Konfiguration dokumentieren
- [ ] 1.3 Search-Param-, Routing- und Diagnoseerwartungen für Admin-Ressourcen spezifizieren
- [ ] 1.4 Auditing-Erwartungen für Bulk-Actions, History-Zugriffe und Revision-Restores spezifizieren
- [ ] 1.5 Pilotressource und rückwärtskompatible Migrationsstrategie dokumentieren
- [ ] 1.6 `openspec validate add-p2-admin-resource-host-standards --strict` ausführen

## 2. Implementation

- [ ] 2.1 `AdminResourceDefinition` in `packages/plugin-sdk` um deklarative Standards für Listen- und Detailfähigkeiten erweitern
- [ ] 2.2 Plugin- und Admin-Resource-Guardrails um erlaubte Capability-Felder, Normalisierung und Fehlerfälle erweitern
- [ ] 2.3 Routing/Search-Param-Validierung für deklarierte Listenfähigkeiten in `packages/routing` ergänzen
- [ ] 2.4 Hostseitige UI-Bausteine für Search, Filter, Pagination und Bulk-Actions aus den Resource-Deklarationen ableiten
- [ ] 2.5 Mindestens eine bestehende Admin-Ressource, bevorzugt `content`, auf die Standards umstellen
- [ ] 2.6 Hostgeführte Bulk-/History-/Revision-Operationen an bestehende Audit- und Content-History-Mechanismen anbinden
- [ ] 2.7 Unit-, Type- und UI-Tests für Standardverhalten, Search-Params, Auditing und unzulässige Konfigurationen ergänzen
- [ ] 2.8 Relevante arc42-Abschnitte zu Building Blocks, Cross-Cutting Concepts und Quality Requirements aktualisieren
