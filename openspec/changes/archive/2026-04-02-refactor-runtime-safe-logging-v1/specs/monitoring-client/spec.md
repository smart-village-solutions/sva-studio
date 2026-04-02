## MODIFIED Requirements
### Requirement: Development logging is available locally without production-only dependencies
Das System SHALL Development-Logging für Server- und Browser-Code lokal verfügbar machen, ohne dass Browser-Code servergebundene Logging-APIs importieren muss.

#### Scenario: Browser code uses a runtime-safe logger API
- **WHEN** produktiver Browser-App-Code ein operatives Development-Log erzeugt
- **THEN** verwendet er eine browser-taugliche Logger-API aus dem SDK
- **AND** der Logeintrag wird ohne server-only Importe erzeugt

#### Scenario: Browser and server logs redact sensitive values consistently
- **WHEN** Browser- oder Server-Code Logs mit sensiblen Strings oder Meta-Feldern erzeugt
- **THEN** werden E-Mails, Token, JWTs und bekannte Sensitive-Keys nach denselben Redaction-Regeln maskiert
