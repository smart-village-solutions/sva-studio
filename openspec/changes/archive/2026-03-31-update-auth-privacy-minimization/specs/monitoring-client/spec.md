## MODIFIED Requirements

### Requirement: PII-Redaction & Privacy-by-Default
Das System SHALL personenbezogene und sicherheitsrelevante Daten automatisch reduzieren oder maskieren, um DSGVO-Konformitaet und tokenfreies operatives Logging zu gewaehrleisten.

#### Scenario: Automatische Redaction sensibler Felder
- **WHEN** ein Log-Eintrag Felder wie `password`, `token`, `authorization`, `id_token_hint` oder `refresh_token` enthaelt
- **THEN** werden diese Felder automatisch vor dem Export redacted
- **AND** erscheinen nicht in Loki/Grafana

#### Scenario: Tokenhaltige URL wird maskiert
- **WHEN** ein Log-Eintrag eine URL oder Redirect-Zieladresse mit sensitiven Query-Parametern wie `id_token_hint`, `access_token`, `refresh_token` oder `code` enthaelt
- **THEN** werden diese Query-Parameter vor Console-, Dev-UI- und OTEL-Ausgabe maskiert
- **AND** der Log-Eintrag enthaelt keine decodierbaren Token-Claims

#### Scenario: JWT-aehnliche Strings werden maskiert
- **WHEN** ein Log-Eintrag JWT-aehnliche Strings oder Inline-Bearer-Tokens in Freitextfeldern enthaelt
- **THEN** werden diese Werte heuristisch erkannt und redacted
- **AND** lokale Development-Kanaele und zentrale OTEL-Exporte verhalten sich konsistent
