## ADDED Requirements

### Requirement: Modulare Runtime-Orchestrierung

Das System SHALL die kanonische `runtime-env`-Implementierung intern in dedizierte Module fuer Diagnose, Deploy-Orchestrierung, Smoke/Warmup, Remote-Verification und Command-Dispatch strukturieren, ohne den externen CLI-Vertrag zu aendern.

#### Scenario: Runtime-CLI bleibt Fassade

- **WHEN** `scripts/ops/runtime-env.ts` einen Runtime-Befehl entgegennimmt
- **THEN** validiert die Datei nur Command und Profil, verdrahtet die benoetigten Abhaengigkeiten und delegiert danach an modulare Orchestrierungslogik
- **AND** die CLI-Syntax, Exit-Codes und JSON-Ausgabe bleiben kompatibel

#### Scenario: Tests adressieren modulare Verantwortungen

- **WHEN** die Runtime-Orchestrierung getestet wird
- **THEN** existieren neben den Fassaden-Tests dedizierte Tests fuer Smoke/Warmup-, Doctor-, Deploy- oder Remote-Verification-Module
- **AND** diese Tests pruefen Retry-, Fehler- oder Report-Orchestrierung ohne den gesamten CLI-Einstieg auszufuehren
