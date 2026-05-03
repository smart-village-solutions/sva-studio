## ADDED Requirements

### Requirement: Instanzen fuehren einen expliziten zugewiesenen Modulsatz

Das System SHALL pro Instanz einen expliziten Satz zugewiesener Module persistieren und diesen Satz als kanonische Betriebsquelle fuer modulbezogene Freigaben und IAM-Basis verwenden. Die Zuweisung erfolgt ausschliesslich durch den Studio-Admin.

#### Scenario: Bestehende Instanz startet ohne impliziten Modulsatz

- **GIVEN** eine bestehende Instanz wird nach Einfuehrung des Modulvertrags gelesen
- **WHEN** fuer diese Instanz noch keine explizite Modulzuordnung durch den Studio-Admin gepflegt wurde
- **THEN** behandelt das System ihren Modulsatz als leer
- **AND** aktiviert keine Module implizit aus globaler Plugin-Registrierung, `featureFlags` oder Integrationsdaten

### Requirement: Modulzuweisung seedet die IAM-Basis in derselben Operation

Das System SHALL die Zuweisung eines Moduls zu einer Instanz als Studio-Admin-Mutation behandeln, die die fachliche Freigabe und das IAM-Baseline-Seeding fuer `Core + zugewiesene Module` in derselben Operation ausfuehrt.

#### Scenario: Modul wird einer Instanz zugewiesen

- **GIVEN** ein global bekanntes Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin das Modul der Instanz zuweist
- **THEN** persistiert das System die Modulzuordnung fuer diese Instanz
- **AND** legt es fehlende modulbezogene Permissions idempotent an oder aktualisiert sie
- **AND** bringt es kanonische Systemrollen und `role_permissions` fuer `Core + zugewiesene Module` auf Sollstand
- **AND** ist das Modul nach erfolgreichem Abschluss fachlich sofort nutzbar

#### Scenario: Zuweisung eines nicht global registrierten Moduls wird abgelehnt

- **GIVEN** eine gueltige Instanz existiert
- **WHEN** der Studio-Admin ein Modul zuweist, das nicht in der globalen Plugin-Registrierung bekannt ist
- **THEN** lehnt das System die Operation mit einem Validation-Fehler ab
- **AND** wird keine Modulzuordnung persistiert
- **AND** wird kein IAM-Seeding ausgefuehrt

#### Scenario: IAM-Seeding schlaegt waehrend Modulzuweisung fehl

- **GIVEN** ein global bekanntes Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin das Modul zuweist
- **AND** der IAM-Baseline-Seeding-Schritt schlaegt mit einem Fehler fehl
- **THEN** rollt das System die Modulzuordnung fuer diese Instanz zurueck
- **AND** persistiert keine Teilzuordnung
- **AND** wird der Fehler dem Studio-Admin mit Diagnosekontext zurueckgemeldet
- **AND** startet ein erneuter Zuweisungsversuch die Operation idempotent von vorn

### Requirement: Modulentzug entfernt modulbezogene IAM-Basis hart

Das System SHALL den Entzug eines Moduls von einer Instanz als Studio-Admin-Mutation behandeln, die modulbezogene Rechte und Rollenzuordnungen hart entfernt. Die Mutation erfordert ein explizites `confirmation`-Feld im Request; der Server lehnt den Entzug ohne dieses Feld mit einem eigenen Fehlercode ab.

#### Scenario: Modul wird einer Instanz entzogen

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** der Studio-Admin den Entzug mit expliziter Bestaetigung (`confirmation: "REVOKE"`) ausfuehrt
- **THEN** entfernt das System die Modulzuordnung fuer diese Instanz
- **AND** entfernt es die modulbezogenen Permissions hart
- **AND** entfernt es modulbezogene `role_permissions` und systemische Rollenerweiterungen hart
- **AND** bleibt die Core-IAM-Basis der Instanz unveraendert erhalten

#### Scenario: Gleichzeitige Zuweisung und Entzug desselben Moduls

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** zwei nebenlaeuifge Operationen gleichzeitig ausgefuehrt werden: Operation A entzieht das Modul, Operation B weist es erneut zu
- **THEN** laesst das System genau eine Operation atomar gewinnen
- **AND** der finale Modulsatz der Instanz ist entweder vollstaendig zugewiesen oder vollstaendig entzogen – kein Zwischenzustand wird persistiert
- **AND** die unterlegene Operation schlaegt mit einem deterministischen Conflict-Fehler fehl

### Requirement: Instanz-Cockpit diagnostiziert IAM-Basis zugewiesener Module

Das System SHALL fuer jede Instanz einen expliziten Betriebsbefund ueber die Vollstaendigkeit der IAM-Basis fuer `Core + zugewiesene Module` ableiten und dem Studio-Admin als direkte Diagnose auf der Instanz-Detailseite verfuegbar machen.

#### Scenario: Zugewiesene Module haben unvollstaendige IAM-Basis

- **GIVEN** eine Instanz hat zugewiesene Module
- **AND** mindestens eine erwartete Permission, Systemrolle oder `role_permission` fuer `Core + zugewiesene Module` fehlt
- **WHEN** der Studio-Admin die Instanzdetailansicht laedt
- **THEN** zeigt das Cockpit einen degradierten Befund fuer die IAM-Basis zugewiesener Module
- **AND** enthaelt der Befund eine direkte Reparaturaktion zum Neu-Seeden
