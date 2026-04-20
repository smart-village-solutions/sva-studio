## ADDED Requirements

### Requirement: Plugin-Content-Typen sind namespace-pflichtig

Das Content-Management MUST plugin-beigestellte `contentType`-Identifier in einem fully-qualified Format `<namespace>.<contentTypeName>` behandeln.

#### Scenario: Plugin registriert namespaceten Content-Typ

- **WHEN** ein Plugin mit Namespace `news` einen Content-Typ registriert
- **THEN** verwendet der `contentType` das Format `news.<contentTypeName>`
- **AND** der Identifier ist global kollisionsfrei pruefbar

#### Scenario: Plugin registriert unqualifizierten Content-Typ

- **WHEN** ein Plugin einen `contentType` wie `news` oder `article` ohne fully-qualified Format registriert
- **THEN** wird die Registrierung mit einem Validierungsfehler abgewiesen
- **AND** der Host akzeptiert keinen implizit aus dem Plugin abgeleiteten Fallback-Identifier

#### Scenario: Plugin registriert Content-Typ in fremdem Namespace

- **WHEN** ein Plugin mit Namespace `news` einen `contentType` wie `events.article` registrieren will
- **THEN** wird die Registrierung mit einem Ownership-Fehler abgewiesen
- **AND** nur ein expliziter Host-Bridge- oder Alias-Vertrag duerfte eine solche Ausnahme erlauben

#### Scenario: Core-Content-Typen bleiben von der Plugin-Namespace-Pflicht ausgenommen

- **WHEN** der Host oder ein Core-Vertrag einen bestehenden Content-Typ wie `generic` oder `legal` verwendet
- **THEN** darf dieser Identifier ohne plugin-spezifisches Namespace-Praefix bestehen bleiben
- **AND** daraus entsteht keine Pflicht, core-eigene Content-Typen nachtraeglich in das Plugin-Namensmodell zu migrieren
