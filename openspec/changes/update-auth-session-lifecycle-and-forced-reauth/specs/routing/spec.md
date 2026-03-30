## ADDED Requirements

### Requirement: Kontrollierter Silent-SSO-Routing-Vertrag
Das System SHALL für den Auth-Router einen expliziten, kontrollierten Silent-SSO-Vertrag bereitstellen.

#### Scenario: Silent Login über bestehenden Auth-Pfad

- **WHEN** `/auth/login?silent=1` aufgerufen wird
- **THEN** verwendet der Auth-Handler denselben OIDC-Flow wie der aktive Login
- **AND** setzt bei der Authorize-Anfrage `prompt=none`
- **AND** verwendet weiter dieselben Schutzmechanismen für `state`, `nonce` und PKCE

#### Scenario: Silent Callback antwortet iframe-sicher

- **WHEN** ein stiller Login über `/auth/callback` erfolgreich oder fehlerhaft abgeschlossen wird
- **THEN** antwortet der Handler mit einer iframe-sicheren HTML-Response statt mit einem normalen App-Redirect
- **AND** die Response signalisiert Erfolg oder Fehler an den aufrufenden Browserkontext
- **AND** normale interaktive Login-Callbacks behalten ihr Redirect-Verhalten bei
