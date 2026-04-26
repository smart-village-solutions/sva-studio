## ADDED Requirements

### Requirement: Plugin-Packages besitzen genau einen kanonischen Namespace

Das Monorepo SHALL fuer jedes Plugin-Package genau eine technische Plugin-Identitaet mit genau einem owning namespace definieren, aus der registrierte Host-Identifier fuer dieses Plugin abgeleitet werden.

#### Scenario: Plugin-Package verwendet einen eindeutigen Namespace

- **WHEN** ein Workspace-Package als Plugin fuer den Host registriert wird
- **THEN** besitzt es genau einen kanonischen Plugin-Namespace
- **AND** dieser Namespace wird fuer weitere registrierte Host-Beitraege desselben Plugins wiederverwendet
- **AND** das Plugin fuehrt keine zweite konkurrierende Namespace-Identitaet fuer dieselben Host-Beitraege ein

#### Scenario: Doppelter Plugin-Namespace wird abgewiesen

- **WHEN** zwei Plugin-Packages denselben kanonischen Namespace beanspruchen
- **THEN** wird die Host- oder Registry-Initialisierung deterministisch mit einem Konfliktfehler abgebrochen
- **AND** kein teilweise inkonsistenter Registry-Zustand wird publiziert

### Requirement: Reservierte Core-Namespaces bleiben hostexklusiv

Das Monorepo MUST reservierte Core-Namespaces fuer hosteigene oder explizit definierte Core-Vertraege schuetzen.

#### Scenario: Plugin beansprucht reservierten Core-Namespace

- **WHEN** ein Plugin-Package einen reservierten Core-Namespace wie `iam`, `content` oder `admin` fuer seine technische Plugin-Identitaet nutzen will
- **THEN** wird die Registrierung abgewiesen
- **AND** der Namespace bleibt dem Host oder einem explizit definierten Core-Vertrag vorbehalten
