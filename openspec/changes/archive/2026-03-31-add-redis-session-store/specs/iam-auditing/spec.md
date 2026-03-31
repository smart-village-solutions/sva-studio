## ADDED Requirements

### Requirement: Auditspur für Redis-basierte Session-Lebenszyklen
Das System SHALL Redis-basierte Session-Lebenszyklen revisionsfähig protokollieren, ohne Tokenwerte, Session-IDs oder sonstige sensitive Details im Klartext offenzulegen.

#### Scenario: Session-Erstellung wird auditiert
- **WHEN** nach erfolgreichem Login eine App-Session im Redis-Store angelegt wird
- **THEN** erzeugt das System ein Audit-Event für die Session-Erstellung
- **AND** das Event enthält mindestens Zeitpunkt, pseudonymisierte Actor-Referenz, Instanzkontext und Ergebnis
- **AND** das Event enthält keine Klartext-Tokens, keine rohe Session-ID und keine Klartext-PII

#### Scenario: Session-Invalidierung wird auditiert
- **WHEN** eine App-Session durch Logout, Revocation oder Ablauf explizit invalidiert wird
- **THEN** erzeugt das System ein Audit-Event mit Grundklasse und Ergebnis
- **AND** das Ereignis bleibt von normalen Login- oder Forced-Reauth-Events unterscheidbar

### Requirement: Auditspur für Login-State-Objekte
Das System SHALL kurzlebige Login-State-Objekte und deren sicherheitsrelevante Zustandswechsel nachvollziehbar protokollieren.

#### Scenario: Login-State wird erzeugt und verbraucht
- **WHEN** das System einen Login-State für einen OIDC-Flow anlegt und später erfolgreich konsumiert
- **THEN** entstehen auditierbare Ereignisse für Erzeugung und Verbrauch
- **AND** die Nachweise enthalten keine sensitiven State-, Code- oder Tokenwerte im Klartext

#### Scenario: Login-State läuft ab oder wird ungültig
- **WHEN** ein Login-State abläuft oder als ungültig verworfen wird
- **THEN** wird ein unterscheidbares Audit-Ereignis mit Ergebnis `expired` oder `rejected` erzeugt

### Requirement: Audit-Retention und Löschtrennung für Sessions
Das System SHALL für sessionbezogene Auditdaten Archivierung und operative Löschung klar trennen.

#### Scenario: Benutzerbezogene Sessiondaten werden gelöscht
- **WHEN** operative Session- oder Login-State-Daten aus Datenschutz- oder Sicherheitsgründen entfernt werden
- **THEN** bleiben zugehörige Audit-Nachweise nur in pseudonymisierter, revisionsfähiger Form erhalten
- **AND** Audit-Archive werden nicht mit dem operativen Session-Store gekoppelt gelöscht
