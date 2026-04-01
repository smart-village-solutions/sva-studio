## MODIFIED Requirements
### Requirement: Browser diagnostics use safe structured logging in development
Das System MUST für produktiven Browser-App-Code bevorzugt eine browser-taugliche Logger-API statt rohem `console.*` verwenden, wenn operative IAM-Diagnostik erzeugt wird.

#### Scenario: IAM browser api errors use the browser logger
- **WHEN** produktiver Browser-App-Code einen IAM-API-Fehler im Development diagnostisch protokolliert
- **THEN** nutzt dieser Code den Browser-Logger
- **AND** der Logeintrag enthält `request_id`, `status` und `code`
- **AND** nur explizit erlaubte sichere Diagnosedetails werden geloggt

#### Scenario: Development-only browser capture may still hook console
- **WHEN** die Browser-Development-Log-Capture globale Browser-Events oder Third-Party-Console-Ausgaben mitschneidet
- **THEN** darf dieser Infrastrukturpfad weiterhin `console.*` hooken
- **AND** die dabei gespeicherten Einträge nutzen dieselben Redaction-Regeln wie der Browser-Logger
