## ADDED Requirements

### Requirement: Runtime-Boot blockiert bei Migrationsdrift

Das System MUST vor der Request-Annahme prüfen, ob die produktive Datenbank den erwarteten Migrationsstand für die laufende Runtime erreicht hat.

#### Scenario: Datenbank ist auf erwartetem Stand

- **WHEN** die Runtime bootet oder ein prod-naher Release-Precheck läuft
- **THEN** verifiziert das System den erwarteten Migrations-Head gegen die Datenbank
- **AND** erst danach werden Readiness und Request-Annahme freigegeben

#### Scenario: Migrationsstand driftet hinter dem erwarteten Head

- **WHEN** Boot oder Release-Precheck einen tatsächlichen Migrationsstand unterhalb des erwarteten Image-Heads erkennen
- **THEN** blockiert das System Request-Annahme oder Rollout
- **AND** Readiness, Diagnoseausgabe und Release-Report benennen die Drift maschinenlesbar

#### Scenario: Datenbank ist neuer als der Runtime-Head

- **WHEN** bei einem App-Rollback der tatsächliche Migrationsstand oberhalb des im älteren Image enthaltenen Heads liegt
- **THEN** blockiert der Head-Vergleich den Runtime-Boot nicht allein aufgrund des neueren Ledgers
- **AND** der kritische Schema-Guard bleibt weiterhin verbindlich
