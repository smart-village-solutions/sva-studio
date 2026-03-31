## MODIFIED Requirements

### Requirement: OpenTelemetry SDK Integration
Die Applikation SHALL OpenTelemetry SDK fuer Metriken und Logs nutzen, um Vendor-Neutralitaet zu gewaehren. In Development bleibt die Applikation jedoch ohne aktiven OTEL-Transport lauffaehig, solange lokale Diagnosekanaele verfuegbar sind.

#### Scenario: Development ohne OTEL-Readiness
- **WHEN** die Entwicklungsumgebung startet und OTEL nicht erfolgreich initialisiert werden kann
- **THEN** bleiben Console-Logging und die lokale Dev-Konsole verfuegbar
- **AND** die Anwendung bleibt benutzbar
- **AND** OTEL wird nicht als aktiver Logger-Transport registriert

#### Scenario: Production ohne OTEL-Readiness
- **WHEN** die Produktionsumgebung startet und OTEL nicht erfolgreich initialisiert werden kann
- **THEN** gilt dies als Fehlerzustand
- **AND** die Anwendung behandelt den Start fail-closed

## ADDED Requirements

### Requirement: Feste Logging-Runtime-Modi
Das System SHALL zwei feste Logging-Runtime-Modi fuer Development und Production bereitstellen.

#### Scenario: Development Runtime
- **WHEN** `NODE_ENV` nicht `production` ist
- **THEN** sind Console-Logging und lokale Dev-Konsole aktiv
- **AND** OTEL ist ein optionaler Zusatzkanal nur bei erfolgreicher Initialisierung

#### Scenario: Production Runtime
- **WHEN** `NODE_ENV=production` ist
- **THEN** sind Console-Logging und lokale Dev-Konsole deaktiviert
- **AND** OTEL ist der verpflichtende Exportpfad fuer Server-Logs

### Requirement: Lokale Dev-Konsole
Die React-Anwendung SHALL in Development eine lokale Debug-Konsole bereitstellen, die Browser-Logs und redaktierte Server-Logs anzeigt.

#### Scenario: Browser- und Server-Logs in Development
- **WHEN** ein Entwickler die App lokal in Development nutzt
- **THEN** sieht er im Seitenfuss eine Debug-Konsole
- **AND** die Konsole zeigt Browser-Logs und redaktierte Server-Logs
- **AND** die Konsole kann nach Level und Quelle filtern
