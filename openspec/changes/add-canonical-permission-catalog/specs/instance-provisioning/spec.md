## ADDED Requirements

### Requirement: Tenant-Baseline und Rollout reconciliieren den kanonischen Permission-Katalog

Das System MUST bei Tenant-Erstellung, explizitem IAM-Baseline-Reconcile und kontrolliertem Rollout für bestehende Tenants denselben kanonischen Permission-Katalog additiv anwenden. Der Operatorvertrag darf keine freien Permission-Payloads oder freien SQL-Eingaben akzeptieren.

#### Scenario: Neuer Tenant erhält vollständige Core-Basis

- **WHEN** ein neuer Tenant mit `system_admin` initialisiert wird
- **THEN** materialisiert der Baseline-Reconcile alle aktiven tenantweiten Katalog-Permissions
- **AND** erhält `system_admin` alle standardmäßig vorgesehenen Grants

#### Scenario: Bestehende Tenants werden nach Katalogerweiterung aktualisiert

- **WHEN** ein Release einen erweiterten Permission-Katalog enthält
- **THEN** führt der kanonische Rollout einen kontrollierten additiven Reconcile für die Zielumgebung aus
- **AND** sind Ergebnis, Request-ID, betroffene Instanzen und sichere Änderungszähler nachvollziehbar
- **AND** führt ein wiederholter Lauf nicht zu Dubletten

#### Scenario: Reconcile schlägt für eine Instanz fehl

- **WHEN** der Permission-Reconcile für eine Zielinstanz nicht vollständig abgeschlossen werden kann
- **THEN** wird die Instanz als nicht erfolgreich reconciled ausgewiesen
- **AND** wird der Fehler ohne freie SQL-Reparatur über den bestehenden Diagnose- und Rollout-Vertrag behandelt

