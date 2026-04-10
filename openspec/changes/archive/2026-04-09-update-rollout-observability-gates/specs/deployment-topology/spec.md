## MODIFIED Requirements
### Requirement: Studio-Remoteprofil hat einen reproduzierbaren Rollout-Pfad
Das System SHALL den Rollout fuer das Runtime-Profil `studio` ueber feste diagnostische und fachliche Gates absichern.

#### Scenario: Observability ist Teil des Release-Gates
- **WHEN** `pnpm env:doctor:studio` oder `pnpm env:precheck:studio` ausgefuehrt wird
- **THEN** prueft das System neben Runtime- und Stack-Zustand auch den aktiven Logger-Modus und die Sichtbarkeit frischer App-Logs in Loki
- **AND** meldet den Gate-Zustand als `observability-readiness`

#### Scenario: Tenant-Auth ist Teil des Release-Gates
- **WHEN** `pnpm env:doctor:studio` oder `pnpm env:precheck:studio` ausgefuehrt wird
- **THEN** prueft das System mindestens tenant-spezifische Login-Redirects und zugehoerige Diagnose-Events in Loki
- **AND** meldet den Gate-Zustand als `tenant-auth-proof`
