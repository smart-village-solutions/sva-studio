## ADDED Requirements

### Requirement: Mainserver-Identitätsreconciliation ist ein begrenzter tenantlokaler Ausnahmeprozess

Das System SHALL Mainserver-Identitätsreconciliation ausschließlich über die fully-qualified Action `iam.reconcileMainserverUserConflict` und getrennt von normalen Tenant-Admin-Mutationen ausführen. Die Action SHALL auf `system_admin` der Zielinstanz begrenzt sein, Zielaccount und Konfliktbefund erneut prüfen und keine implizite Berechtigung aus E-Mail-Gleichheit oder einer Plattformrolle ableiten.

#### Scenario: System-Admin derselben Instanz beantragt Reconciliation

- **GIVEN** ein `system_admin` ist für die Zielinstanz authentifiziert
- **AND** ein aktueller Konfliktbefund liegt für den Zielaccount vor
- **WHEN** er eine Reconciliation beantragt
- **THEN** akzeptiert der Server den Antrag innerhalb dieser Instanz
- **AND** erzeugt noch keine externe Mutation

#### Scenario: Fremdinstanzlicher oder normaler Tenant-Admin versucht Reconciliation

- **WHEN** ein Benutzer ohne `system_admin`-Berechtigung für die Zielinstanz die Action aufruft
- **THEN** lehnt der Server die Operation vor jedem Mainserver-Aufruf ab

### Requirement: Mainserver-Identitätsreconciliation verwendet Vier-Augen-Freigabe

Das System SHALL einen Rebind nur ausführen, wenn ein anderer `system_admin` derselben Instanz einen unveränderten Antrag explizit bestätigt hat.

#### Scenario: Antragsteller und Bestätiger sind unterschiedlich

- **GIVEN** ein Antrag ist `requested`
- **WHEN** ein anderer berechtigter `system_admin` ihn bestätigt
- **THEN** darf der Vorgang in `approved` übergehen

#### Scenario: Antragsteller bestätigt sich selbst

- **WHEN** der Account des Antragstellers eine Bestätigung anfordert
- **THEN** lehnt der Server die Bestätigung deterministisch ab
- **AND** bleibt der Vorgang `requested`
