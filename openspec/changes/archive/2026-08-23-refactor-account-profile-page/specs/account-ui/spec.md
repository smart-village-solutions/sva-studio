## ADDED Requirements

### Requirement: Interne Entflechtung bewahrt den Vertrag der Account-Profilseite

Das System SHALL die Account-Profilseite so strukturieren, dass framework-unabhängige Formularregeln, asynchroner Seitenzustand und zugängliche Präsentation getrennt weiterentwickelt werden können, ohne den bestehenden Profil-, IAM- oder Credential-Self-Service-Vertrag zu verändern.

#### Scenario: Seitenzustände bleiben vollständig

- **WENN** die Account-Profilseite lädt, eine Anfrage fehlschlägt oder ein Nutzer nicht angemeldet ist
- **DANN** bleiben die bestehenden Lade-, Fehler-, Diagnose-, Retry- und Anmeldepfade erhalten
- **UND** die Zustände behalten ihre zugänglichen Status- und Fokusmerkmale

#### Scenario: Editierbarkeit und Mutation bleiben unverändert

- **WENN** ein Tenant-Nutzer Profildaten bearbeitet oder ein Plattformprofil die Seite read-only verwendet
- **DANN** bleiben Formularfelder, Validierung, normalisierte Mutation und IAM-seitige Editierbarkeit unverändert
- **UND** Erfolg, Fehler, Fokusführung und Fehlerzuordnung bleiben zugänglich wahrnehmbar

#### Scenario: Credential-Rückkehrstatus bleibt orthogonal erhalten

- **WENN** `/account` mit einem bekannten, fehlenden oder ungültigen `accountAction`-Parameter aufgerufen wird
- **DANN** bleibt das Verhalten des bestehenden Changes `add-account-credential-self-service` unverändert
- **UND** das interne Refactoring definiert oder überschreibt keinen Credential-Self-Service-Vertrag
