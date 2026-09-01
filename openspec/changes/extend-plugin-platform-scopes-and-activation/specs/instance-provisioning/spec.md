## MODIFIED Requirements

### Requirement: Instanzen fuehren einen expliziten zugewiesenen Modulsatz

Das System SHALL pro Instanz einen expliziten Satz zugewiesener Module persistieren und diesen Satz als kanonische Betriebsquelle fuer modulbezogene Freigaben und IAM-Basis verwenden. Eine Zuweisung entsteht ausschließlich durch eine autorisierte Root-Mutation oder durch den hostgeführten Reconcile einer installierten Plugin-Aktivierungsrichtlinie; globale Plugin-Registrierung, `featureFlags` und Integrationsdaten sind keine implizite Betriebsquelle.

#### Scenario: Bestehende Instanz ohne Richtlinienzuweisung startet ohne impliziten Modulsatz

- **GIVEN** eine bestehende Instanz wird nach Einführung des Modulvertrags gelesen
- **AND** für ein installiertes Plugin besteht weder eine explizite Root-Zuweisung noch ein persistiertes Reconcile-Ergebnis aus `automatic` oder `required`
- **WHEN** der effektive Modulsatz aufgelöst wird
- **THEN** behandelt das System dieses Plugin als nicht zugewiesen
- **AND** aktiviert es nicht implizit aus globaler Plugin-Registrierung, `featureFlags` oder Integrationsdaten

#### Scenario: Richtlinien-Reconcile persistiert eine automatische Zuweisung

- **GIVEN** ein installiertes Plugin deklariert `automatic` oder `required`
- **WHEN** der hostgeführte Reconcile den Sollzustand einer Instanz erfolgreich materialisiert
- **THEN** persistiert er die Zuweisung im expliziten Modulsatz einschließlich Richtlinie, Herkunft und Revision
- **AND** konsumieren Routing, IAM und Plugin-Runtime anschließend ausschließlich diesen persistierten Zustand

### Requirement: Modulentzug entfernt modulbezogene IAM-Basis hart

Das System SHALL die Deaktivierung beziehungsweise den Entzug eines Moduls von einer Instanz als Root-Admin-Mutation behandeln, die modulbezogene Rechte und Rollenzuordnungen hart entfernt, aber Plugin-Fachdaten und Audit-Historie erhält. Die Mutation erfordert ein explizites `confirmation`-Feld im Request; der Server lehnt den Entzug ohne dieses Feld mit einem eigenen Fehlercode ab. Ein `required`-Plugin darf tenantbezogen nicht entzogen werden; bei `automatic` wird die Deaktivierung als persistenter manueller Override geführt.

#### Scenario: Optionales oder automatisches Modul wird einer Instanz entzogen

- **GIVEN** ein `optional`- oder `automatic`-Modul ist einer Instanz zugewiesen
- **WHEN** der Root-Admin den Entzug mit expliziter Bestätigung (`confirmation: "REVOKE"`) ausführt
- **THEN** entfernt das System die Modulzuordnung für diese Instanz
- **AND** entfernt es die modulbezogenen Permissions hart
- **AND** entfernt es modulbezogene `role_permissions` und systemische Rollenerweiterungen hart
- **AND** bleibt die Core-IAM-Basis der Instanz unverändert erhalten
- **AND** bleiben Plugin-Fachdaten und Audit-Historie erhalten
- **AND** persistiert es bei `automatic` den manuellen Deaktivierungs-Override

#### Scenario: Pflicht-Modul darf nicht entzogen werden

- **GIVEN** ein installiertes Modul deklariert `required`
- **WHEN** ein Root-Admin oder ein Tenant-Request den Entzug anfordert
- **THEN** lehnt das System die Mutation mit einem stabilen Policy-Fehler ab
- **AND** verändert weder Modulsatz noch IAM-Basis oder Plugin-Daten

#### Scenario: Gleichzeitige Zuweisung und Entzug desselben Moduls

- **GIVEN** ein nicht verpflichtendes Modul ist einer Instanz zugewiesen
- **WHEN** zwei nebenläufige Operationen gleichzeitig ausgeführt werden: Operation A entzieht das Modul, Operation B weist es erneut zu
- **THEN** lässt das System genau eine Operation atomar gewinnen
- **AND** der finale Modulsatz der Instanz ist entweder vollständig zugewiesen oder vollständig entzogen – kein Zwischenzustand wird persistiert
- **AND** die unterlegene Operation schlägt mit einem deterministischen Conflict-Fehler fehl
