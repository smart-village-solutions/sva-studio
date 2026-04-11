## 1. Analyse und Kanaltrennung

- [x] 1.0 `update-studio-swarm-migration-job` als vorausgesetzte Grundlage bestaetigen und den Scope dieses Changes auf Read-only-Diagnostik sowie Operator-Kontext begrenzen
- [x] 1.1 Alle Remote-Operationen in `scripts/ops/runtime-env.ts` nach read-only, `exec`-basiert und mutierend klassifizieren
- [x] 1.2 Fuer jeden read-only Pfad den Zielkanal festlegen: MCP oder Portainer-API
- [x] 1.3 Verbleibende `exec`-Pfadfaelle begruenden und als Fallback dokumentieren

## 2. Betriebsvertrag und Implementierung

- [x] 2.1 `doctor`- und `precheck`-Pfade so umbauen, dass read-only Befunde nicht mehr an lokaler `quantum-cli`-Authentisierung haengen
- [x] 2.2 `quantum-cli exec` aus dem Standard-Diagnosepfad entfernen und nur als expliziten Fallback verwenden
- [x] 2.3 Mutierende Rollouts fuer `studio` und `acceptance-hb` auf den kanonischen CI-/Runner-Pfad begrenzen, ohne die dedizierten Job-Pfade neu zu entwerfen

## 3. Nachweise und Dokumentation

- [x] 3.1 Tests fuer die neue Kanaltrennung und degradierte Fallback-Semantik ergaenzen
- [x] 3.2 `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md` und `docs/architecture/11-risks-and-technical-debt.md` fortschreiben
- [x] 3.3 Betriebsdoku unter `docs/development/runtime-profile-betrieb.md` und `docs/guides/swarm-deployment-runbook.md` auf den neuen Vertrag aktualisieren
