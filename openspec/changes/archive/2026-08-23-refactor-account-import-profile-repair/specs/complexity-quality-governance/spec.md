## ADDED Requirements

### Requirement: Account-Import-Hotspots werden ohne Vertragsänderung zerlegt

Das System SHALL die Profilreparatur und Berichtsbildung des Account-Imports in kleine überprüfbare Entscheidungs- und Seiteneffektbausteine zerlegen. Die Senkung MUST durch Fallow-Metriken belegt werden und darf nicht durch Suppressionen, geänderte Schwellen oder eine zusätzliche parallele Importabstraktion entstehen.

#### Scenario: Profilreparatur-Hotspots verschwinden aus dem Fallow-Bericht

- **GIVEN** `repairIdentityUserProfileIfPossible` und die Import-Berichtsbildung überschreiten die dokumentierten CRAP- oder Komplexitätsgrenzen
- **WHEN** die internen Entscheidungsgrenzen refaktoriert werden
- **THEN** liegen die Ziel-Funktionen unter den kanonischen Fallow-Schwellen oder sind durch kleinere Bausteine ersetzt
- **AND** der New-only-Audit führt keine neue Complexity, Dead Code oder Duplikation ein
- **AND** Characterization-Tests belegen unveränderte Fallback-, Mandanten-, Fehler- und Report-Semantik
