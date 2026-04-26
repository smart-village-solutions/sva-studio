## 1. Specification

- [x] 1.1 Plugin-Registrierungsphasen fuer Content, Admin, Routing und Audit spezifizieren
- [x] 1.2 Materialisierungsreihenfolge und Fehlerdiagnostik in `design.md` dokumentieren
- [x] 1.3 OpenSpec-Deltas fuer `monorepo-structure`, `content-management`, `iam-auditing` und `routing` ergaenzen
- [x] 1.4 `openspec validate add-p2-plugin-lifecycle-registration-phases --strict` ausfuehren

## 2. Implementation

- [x] 2.1 Interne Phasen-Typen und Phasenoutputs in `@sva/plugin-sdk` modellieren, ohne die bestehende `BuildTimeRegistry`-Public-API zu brechen
- [x] 2.2 Bestehende Registry-Erzeugung in Phasenhelfer fuer Preflight, Content, Admin, Audit, Routing und Publish aufteilen
- [x] 2.3 `@sva/sdk`-Re-Exports/Adapter pruefen und nur bei geaenderter Exportflaeche anpassen
- [x] 2.4 Host-Materialisierung in Routing und App-Host auf validierte Snapshot-Outputs vorbereiten, ohne bestehende direkte Plugin-Definition-Caller zu brechen
- [x] 2.5 Tests fuer Phasenreihenfolge, bestehende Output-Kompatibilitaet und phasenfremde Guardrail-Verletzungen ergaenzen
- [x] 2.6 Relevante arc42-Abschnitte aktualisieren
