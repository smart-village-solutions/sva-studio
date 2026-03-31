# iam-auditing Specification

## Purpose
TBD - created by archiving change setup-iam-identity-auth. Update Purpose after archive.
## Requirements
### Requirement: Immutable Logging für Identity-Basisereignisse
Das System MUST sicherheitsrelevante Identity-Ereignisse aus Child A unveraenderbar protokollieren und Audit- von operativen Logging-Pfaden strikt trennen.

#### Scenario: Login/Logout wird protokolliert

- **WHEN** ein Benutzer sich erfolgreich anmeldet oder abmeldet
- **THEN** wird ein unveraenderbares Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz und Ergebnis erzeugt
- **AND** Klartext-PII wird nicht gespeichert
- **AND** tokenhaltige Redirect- oder Logout-URLs werden weder im Audit- noch im operativen Log als Klartext gespeichert

#### Scenario: Token-Validierungsfehler wird protokolliert

- **WHEN** Token-Validierung fehlschlaegt (z. B. `invalid`, `expired`, `issuer_mismatch`, `audience_mismatch`)
- **THEN** wird ein `warn`-faehiges Sicherheitsereignis mit Fehlerklasse erzeugt
- **AND** Tokenwerte, tokenhaltige URLs, Session-IDs und Klartext-PII werden nicht geloggt

### Requirement: Dual-Write für Child-A-Sicherheitsereignisse

Das System MUST Child-A-Sicherheitsereignisse sowohl in `iam.activity_logs` als auch über den SDK Logger in die OTEL-Pipeline emittieren.

#### Scenario: Duale Emission bei Login-Ereignis

- **WHEN** ein Login-Ereignis entsteht
- **THEN** wird ein Audit-Record in `iam.activity_logs` geschrieben
- **AND** ein strukturierter SDK-Logeintrag mit korrelierbaren IDs (`request_id`, `trace_id`) emittiert

### Requirement: Auditierbare Migrations- und Seed-Operationen

Das System SHALL sicherheitsrelevante IAM-Migrations- und Seed-Operationen nachvollziehbar protokollieren.

#### Scenario: Ausführung einer IAM-Migration

- **WHEN** eine Migration im `iam`-Schema ausgeführt wird
- **THEN** wird ein nachvollziehbarer Lauf mit Zeitpunkt, Version und Ergebnis erzeugt
- **AND** fehlgeschlagene Läufe sind für Betrieb und Incident-Analyse sichtbar

### Requirement: Audit-Kontext für RLS-Ausnahmepfade

Das System SHALL dokumentierte RLS-Ausnahmepfade in Migrationen oder Admin-Prozessen als Sicherheitskontext erfassbar machen.

#### Scenario: Geplanter RLS-Bypass in Migration

- **WHEN** ein legitimierter Prozess RLS temporär umgeht
- **THEN** enthält der Vorgang einen dokumentierten Grund und Scope
- **AND** nach Abschluss ist der Normalzustand wiederhergestellt und nachweisbar

### Requirement: Unveränderbare Governance-Audit-Events

Das System SHALL für alle Governance-Aktionen unveränderbare Audit-Events erzeugen und revisionssicher speichern.

#### Scenario: Rechteänderung wird protokolliert

- **WHEN** eine Rollen- oder Rechteänderung beantragt, genehmigt oder abgelehnt wird
- **THEN** erzeugt das System ein Audit-Event mit Zeitstempel, pseudonymisierter Actor-ID, Zielobjekt und Ergebnis
- **AND** das Event kann nachträglich nicht verändert werden
- **AND** Klartext-PII (E-Mail, volle IP-Adresse) wird nicht im Event gespeichert

### Requirement: Exportfähige Compliance-Nachweise

Das System SHALL Audit- und Compliance-Nachweise in den Formaten CSV, JSON und SIEM-kompatibel bereitstellen.

#### Scenario: Export für Auditprüfung

- **WHEN** eine Compliance-Prüfung einen Zeitraum anfordert
- **THEN** kann das System die relevanten Governance-Events exportieren
- **AND** die Exportdaten sind konsistent zu den gespeicherten Audit-Events

### Requirement: Nachweisbare Legal-Text-Akzeptanzen

Das System SHALL Versionen von Rechtstexten und deren Akzeptanz durch Benutzer nachvollziehbar speichern.

#### Scenario: Prüfung einer Akzeptanzhistorie

- **WHEN** die Akzeptanz eines Rechtstextes nachgewiesen werden muss
- **THEN** kann das System Version, Zeitpunkt und zugehörigen Benutzerkontext bereitstellen
- **AND** die Nachweise sind exportierbar

### Requirement: Einheitlicher Exportvertrag für Governance-Events

Das System SHALL Governance-Events in CSV, JSON und SIEM-formatiert mit feldäquivalenten Pflichtdaten exportieren.

#### Scenario: Vergleich zweier Exportformate

- **WHEN** derselbe Governance-Zeitraum als CSV und JSON exportiert wird
- **THEN** enthalten beide Exporte mindestens `event_id`, `timestamp`, `instance_id`, `action`, `result`, `actor_pseudonym`, `target_ref`, `reason_code`, `request_id`, `trace_id`
- **AND** es entsteht kein inhaltlicher Informationsverlust

### Requirement: Governance-Reason-Codes sind auditierbar

Das System SHALL für Governance-Denials standardisierte `reason_code`-Werte revisionssicher protokollieren.

#### Scenario: Denial wegen Self-Approval

- **WHEN** eine Freigabe wegen Self-Approval abgewiesen wird
- **THEN** wird ein Audit-Event mit `reason_code=DENY_SELF_APPROVAL` gespeichert
- **AND** das Event ist exportierbar

### Requirement: Unveränderbare Auditspur für Betroffenenanfragen

Das System SHALL jede Betroffenenanfrage und jeden Bearbeitungsschritt revisionssicher als Audit-Event erfassen.

#### Scenario: Bearbeitung einer Löschanfrage

- **WHEN** eine Löschanfrage erstellt, geprüft, blockiert oder abgeschlossen wird
- **THEN** wird pro Statuswechsel ein Audit-Event mit Zeitpunkt, Aktion und Ergebnis erzeugt
- **AND** die Event-Historie bleibt unveränderbar

### Requirement: Pseudonymisierte Nachweise nach Löschung

Das System SHALL Audit-Nachweise nach finaler Account-Löschung pseudonymisiert erhalten.

#### Scenario: Auditprüfung nach abgeschlossener Löschung

- **WHEN** ein gelöschter Account in Auditdaten referenziert ist
- **THEN** enthalten Nachweise nur pseudonymisierte Referenzen
- **AND** Rückschlüsse auf Klartext-PII sind ohne gesonderte Berechtigung nicht möglich

### Requirement: Auditspur für Session-Recovery und Forced Reauth
Das System SHALL Forced-Reauth- und Silent-Session-Recovery-Vorgänge revisionsfähig protokollieren.

#### Scenario: Forced Reauth wird auditiert

- **WHEN** ein Benutzer per Systementscheidung zum Re-Login gezwungen wird
- **THEN** erzeugt das System ein Audit-Event `forced_reauth`
- **AND** das Event enthält Ergebnis, pseudonymisierte Actor-Referenz und keinen Klartext von Tokens oder Session-IDs

#### Scenario: Silent Reauth-Erfolg wird auditiert

- **WHEN** ein stiller Reauth-Versuch erfolgreich eine neue App-Session herstellt
- **THEN** erzeugt das System ein Audit-Event `silent_reauth_success`
- **AND** das Event bleibt frei von Tokenwerten, Session-IDs und Klartext-PII

#### Scenario: Silent Reauth-Fehlschlag wird auditiert

- **WHEN** ein stiller Reauth-Versuch fehlschlägt
- **THEN** erzeugt das System ein Audit-Event `silent_reauth_failed`
- **AND** das Ereignis ist von einem normalen Logout oder Login-Fehler unterscheidbar

