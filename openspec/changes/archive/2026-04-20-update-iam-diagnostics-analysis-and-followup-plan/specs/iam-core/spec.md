## ADDED Requirements

### Requirement: End-to-End-IAM-Fehlertaxonomie und Diagnosevertrag

Das System SHALL für den IAM-Laufzeitpfad eine konsistente, schichtübergreifende Fehlertaxonomie und einen sicheren Diagnosevertrag bereitstellen, damit Auth-, Session-, Keycloak-, Registry- und Datenfehler technisch unterscheidbar und operativ bearbeitbar bleiben.

#### Scenario: Fehlerklasse ist über Schichtgrenzen konsistent

- **WHEN** ein IAM-Fehler im Pfad Host-Auflösung, Auth-Konfiguration, OIDC, Session, Actor-Auflösung, Keycloak-Integration oder IAM-Datenhaltung entsteht
- **THEN** ordnet das System den Fehler einer stabilen Fehlerklasse zu
- **AND** Response, Logging und interne Diagnose verwenden dieselbe fachliche Fehlerklasse
- **AND** unterschiedliche Ursachen werden nicht ausschließlich als generisches `unauthorized` oder `internal_error` sichtbar

#### Scenario: Sichere Diagnosedetails bleiben allowlist-basiert

- **WHEN** das System technische Zusatzinformationen für UI oder Betrieb ausgibt
- **THEN** werden nur vorab definierte sichere Diagnosedetails wie `reason_code`, `dependency`, `actor_resolution`, `schema_object`, `expected_migration` oder gleichwertige allowlist-basierte Felder ausgegeben
- **AND** Tokens, Secrets, Session-IDs, Stacktraces und nicht freigegebene Rohdaten bleiben verborgen

#### Scenario: Recovery-Pfade bleiben diagnostisch nachvollziehbar

- **WHEN** das System einen Silent-Recovery-, Session-Hydration-, JIT-Provisioning- oder sonstigen Recovery-Pfad ausführt
- **THEN** ist dieser Pfad über korrelierbare Diagnoseinformationen und Request-Kontext nachvollziehbar
- **AND** der ursprüngliche Fehlertyp bleibt für Analyse und Folgeentscheidungen unterscheidbar

#### Scenario: Öffentlicher Diagnosevertrag verwendet stabile Kernfelder

- **WHEN** ein IAM-Fehler UI- oder API-seitig als diagnosefähiger Fehler ausgegeben wird
- **THEN** enthält der öffentliche Vertrag mindestens einen stabilen Fehlercode, eine Fehlerklasse, `requestId`, allowlist-basierte `safeDetails`, einen handlungsleitenden Status und eine empfohlene nächste Handlung
- **AND** diese Felder bleiben über Auth-, IAM- und Provisioning-nahe Laufzeitpfade semantisch kompatibel
