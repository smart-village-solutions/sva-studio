## ADDED Requirements

### Requirement: Handlungsleitende IAM-Fehler- und Statusanzeigen

Die UI SHALL IAM-Fehler und degradierte Zustände so darstellen, dass Benutzer und Operatoren zwischen Sitzungsproblemen, Berechtigungsproblemen, Infrastrukturfehlern, Drift und Dateninkonsistenzen unterscheiden können, ohne unsichere Interna offenzulegen.

#### Scenario: Self-Service-Fehlerbild bleibt verständlich und sicher

- **WHEN** in Self-Service-Flows wie `/account` oder vergleichbaren IAM-nahen Ansichten ein IAM-Fehler auftritt
- **THEN** zeigt die UI eine verständliche, auf den Benutzerkontext zugeschnittene Meldung mit passender Folgeaktion wie Re-Login, Retry oder Support-Hinweis
- **AND** kann die UI eine Request-ID und freigegebene Diagnosedetails ausgeben, sofern diese für die Bearbeitung nötig sind
- **AND** werden keine sensitiven Interna oder technische Rohdaten angezeigt

#### Scenario: Admin-UI kann Ursachenklassen unterscheiden

- **WHEN** in Admin-Flows ein IAM-Fehler mit sicherer Diagnose auftritt
- **THEN** unterscheidet die UI mindestens zwischen Auth-/Session-Problemen, fehlender Actor-/Membership-Auflösung, Keycloak-Abhängigkeit, Datenbank-/Schema-Drift und Registry-/Provisioning-Drift
- **AND** zeigt für diese Klassen unterschiedliche Hinweise oder Folgeschritte an
- **AND** reduziert strukturierte Diagnosedetails nicht pauschal auf eine generische Standardmeldung

#### Scenario: Erfolgreiches Recovery wird nicht mit gesundem Zustand verwechselt

- **WHEN** die UI einen temporären IAM-Fehler über einen stillen Recovery- oder Refetch-Pfad überbrückt
- **THEN** bleibt der Zwischenzustand für Diagnose und Statuskommunikation nachvollziehbar
- **AND** Benutzer erhalten keine irreführende Darstellung eines vollständig gesunden Systems, wenn weiterhin degradierte Bedingungen vorliegen

#### Scenario: Self-Service und Admin teilen denselben Diagnosekern

- **WHEN** Self-Service- und Admin-Ansichten denselben IAM-Fehlerklassifikationskern verarbeiten
- **THEN** verwenden beide Pfade dieselbe Fehlerklasse, denselben handlungsleitenden Status und dieselbe `requestId`
- **AND** unterscheiden sich nur in Sprache, Detailtiefe und empfohlenen Folgeschritten passend zum jeweiligen Kontext
