## MODIFIED Requirements

### Requirement: Coverage-Gates pro Paket und Global
Das System SHALL Coverage-Gates sowohl auf Paketebene als auch auf globaler Ebene erzwingen.

#### Scenario: Paket-Gate verletzt
- **WHEN** ein betroffenes Paket unter den definierten Floor fällt
- **THEN** schlägt der CI-Check fehl
- **AND** der Fehler benennt Paket, Metrik und Ist/Soll-Wert

#### Scenario: Globales Gate verletzt
- **WHEN** die globale Coverage unter den definierten Floor fällt
- **THEN** schlägt der CI-Check fehl
- **AND** die globale Abweichung wird im Report ausgewiesen

#### Scenario: Globale Floors sind nicht-trivial
- **WHEN** die Coverage-Policy geprüft wird
- **THEN** liegen die globalen Floor-Werte über 0%
- **AND** sie reflektieren ein realistisches Minimum basierend auf der aktuellen Baseline

### Requirement: Einheitliche Coverage-Messung
Das System SHALL für alle coverage-relevanten Projekte ausführbare Unit-Test-Targets bereitstellen, sodass Coverage-Messung auf realen Testläufen basiert.

#### Scenario: Coverage-relevantes Projekt ist testbar
- **WHEN** ein Projekt als coverage-relevant geführt wird
- **THEN** führt `test:unit` einen echten Test-Runner aus
- **AND** das Projekt verwendet kein No-Op-/Platzhalter-Kommando

#### Scenario: Core-Package ist coverage-relevant
- **WHEN** `@sva/core` Security- und IAM-Module enthält
- **THEN** verfügt es über echte Unit-Tests
- **AND** es ist nicht von Coverage-Gates ausgenommen

#### Scenario: Routing-Package ist coverage-relevant
- **WHEN** `@sva/routing` Auth-Route-Handler enthält
- **THEN** verfügt es über echte Unit-Tests
- **AND** es ist nicht von Coverage-Gates ausgenommen

## MODIFIED Requirements

### Requirement: Stufenweiser Rollout mit Baseline
Das System SHALL Coverage-Floors stufenweise einführen und an einer dokumentierten Baseline ausrichten.

#### Scenario: Baseline als Ausgangspunkt
- **WHEN** Coverage-Governance initial aktiviert wird
- **THEN** existiert eine Baseline pro Paket und Metrik
- **AND** Gate-Entscheidungen beziehen sich auf Baseline und aktuelle Floors

#### Scenario: Ratcheting
- **WHEN** ein Paket stabil über dem aktuellen Floor liegt
- **THEN** dürfen Floors für dieses Paket schrittweise angehoben werden
- **AND** Floors werden niemals automatisch abgesenkt

#### Scenario: Coverage-Gate-Code ist wartbar
- **WHEN** die Coverage-Gate-Implementierung geprüft wird
- **THEN** liegt die Cognitive Complexity jeder Funktion unter 15
- **AND** die Hauptlogik ist in klar benannte Subfunktionen aufgeteilt
