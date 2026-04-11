## 1. Runtime und Logger
- [x] 1.1 Logger-Laufzeitvertrag fuer `console_to_loki`, `otel_to_loki` und `degraded` im SDK verankern
- [x] 1.2 Bootstrap-Events `observability_ready` und `observability_degraded` mit stabilen Diagnosefeldern ergaenzen
- [x] 1.3 Fehlende Logger-Transports in produktionsnahen Profilen als expliziten Degraded-Zustand behandeln

## 2. Tenant-Auth und Keycloak-Diagnostik
- [x] 2.1 Strukturierte `tenant_auth_resolution_summary`- und `tenant_auth_callback_result`-Logs ergaenzen
- [x] 2.2 Keycloak-Status um tenant-spezifisches Secret-Alignment erweitern
- [x] 2.3 Root-Host-Instanzverwaltung um die neuen Secret-/Runtime-Statusfelder erweitern

## 3. Rollout-Gates und Dokumentation
- [x] 3.1 `precheck`/`doctor` um `observability-readiness` und `tenant-auth-proof` erweitern
- [x] 3.2 Runbooks und Rollout-Agent fuer den neuen Observability-Vertrag aktualisieren
- [x] 3.3 Quality Gates und `openspec validate update-rollout-observability-gates --strict` ausfuehren
