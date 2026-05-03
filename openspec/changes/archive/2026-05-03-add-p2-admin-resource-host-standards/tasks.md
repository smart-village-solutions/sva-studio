## 1. Specification

- [x] 1.1 Host-Standards für Suche, Filter, Bulk-Actions, Historie und Revisionen spezifizieren
- [x] 1.2 Abgrenzung zwischen Host-Funktion und Package-Konfiguration dokumentieren
- [x] 1.3 Search-Param-, Routing- und Diagnoseerwartungen für Admin-Ressourcen spezifizieren
- [x] 1.4 Auditing-Erwartungen für Bulk-Actions, History-Zugriffe und Revision-Restores spezifizieren
- [x] 1.5 Pilotressource und rückwärtskompatible Migrationsstrategie dokumentieren
- [x] 1.6 Umsetzungsreihenfolge gegenüber `add-studio-ui-plugin-view-contract`, `refactor-p3-content-ui-specialization-boundaries` und `add-p3-plugin-extension-tier-governance` dokumentieren
- [x] 1.7 `openspec validate add-p2-admin-resource-host-standards --strict` ausführen

## 2. Implementation

- [x] 2.1 `AdminResourceDefinition` in `packages/plugin-sdk` rückwärtskompatibel um `capabilities.list` und `capabilities.detail` erweitern
- [x] 2.2 Minimale Capability-Typen für Search, Filter, Sorting, Pagination, Bulk-Actions, History und Revisions mit i18n-Keys, Binding-Keys und fully-qualified Action-IDs modellieren
- [x] 2.3 Plugin- und Admin-Resource-Guardrails um erlaubte Capability-Felder, eindeutige IDs/Params, Normalisierung und Fehlerfälle erweitern
- [x] 2.4 Routing/Search-Param-Validierung für deklarierte Listenfähigkeiten in `packages/routing` ergänzen
- [x] 2.5 Hostseitige UI-Bausteine für Search, Filter, Pagination und Bulk-Actions aus den Resource-Deklarationen ableiten
- [x] 2.6 Bulk-Action-Selection-Semantik (`explicitIds`, `currentPage`, `allMatchingQuery`) im Host und in Adapter-Inputs abbilden
- [x] 2.7 Mindestens eine bestehende Admin-Ressource, bevorzugt `content`, auf die Standards umstellen
- [x] 2.8 Hostgeführte Bulk-/History-/Revision-Operationen an bestehende Audit- und Content-History-Mechanismen anbinden
- [x] 2.9 Unit-, Type- und UI-Tests für Standardverhalten, Search-Params, Deep-Link-Rehydration, Auditing und unzulässige Konfigurationen ergänzen
- [x] 2.10 Relevante arc42-Abschnitte zu Building Blocks, Cross-Cutting Concepts und Quality Requirements aktualisieren
