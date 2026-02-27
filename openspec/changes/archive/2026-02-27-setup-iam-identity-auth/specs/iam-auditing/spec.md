# Auditing Specification (Child A Scope)

## ADDED Requirements

### Requirement: Immutable Logging für Identity-Basisereignisse

Das System MUST sicherheitsrelevante Identity-Ereignisse aus Child A unveränderbar protokollieren.

#### Scenario: Login/Logout wird protokolliert

- **WHEN** ein Benutzer sich erfolgreich anmeldet oder abmeldet
- **THEN** wird ein unveränderbares Audit-Event mit Zeitpunkt, pseudonymisierter Actor-Referenz und Ergebnis erzeugt
- **AND** Klartext-PII wird nicht gespeichert

#### Scenario: Token-Validierungsfehler wird protokolliert

- **WHEN** Token-Validierung fehlschlägt (z. B. `invalid`, `expired`, `issuer_mismatch`, `audience_mismatch`)
- **THEN** wird ein `warn`-fähiges Sicherheitsereignis mit Fehlerklasse erzeugt
- **AND** Tokenwerte, Session-IDs und Klartext-PII werden nicht geloggt

### Requirement: Dual-Write für Child-A-Sicherheitsereignisse

Das System MUST Child-A-Sicherheitsereignisse sowohl in `iam.activity_logs` als auch über den SDK Logger in die OTEL-Pipeline emittieren.

#### Scenario: Duale Emission bei Login-Ereignis

- **WHEN** ein Login-Ereignis entsteht
- **THEN** wird ein Audit-Record in `iam.activity_logs` geschrieben
- **AND** ein strukturierter SDK-Logeintrag mit korrelierbaren IDs (`request_id`, `trace_id`) emittiert

## MODIFIED Requirements

(Keine)

## REMOVED Requirements

(Keine)
