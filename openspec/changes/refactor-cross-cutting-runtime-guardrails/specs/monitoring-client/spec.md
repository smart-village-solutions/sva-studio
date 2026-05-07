## ADDED Requirements

### Requirement: Produktions-Boot wartet auf OTEL-Readiness vor Request-Annahme

Die Produktions-Runtime MUST OpenTelemetry und den produktiven Server-Logger abschliessen, bevor die Anwendung Requests annimmt oder Handler mountet.

#### Scenario: Produktion startet mit korrekter OTEL-Konfiguration

- **WHEN** die Produktions-Runtime bootet
- **THEN** initialisiert sie OTEL und den verpflichtenden Exportpfad vor dem ersten Request-Handling
- **AND** fruehe Boot- und Handler-Logs gehen nicht nur an lokale Fallback-Kanaele verloren

#### Scenario: OTEL ist in Produktion nicht bereit

- **WHEN** die Produktions-Runtime OTEL oder den verpflichtenden Exportpfad nicht initialisieren kann
- **THEN** bricht der Start vor der Request-Annahme fail-closed ab
- **AND** die Anwendung laeuft nicht in einen stillen teilbeobachtbaren Zustand
