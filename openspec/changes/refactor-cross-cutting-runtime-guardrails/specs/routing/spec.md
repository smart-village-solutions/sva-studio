## ADDED Requirements

### Requirement: Fail-Fast bei Plugin-Routen-Kollisionen

Das Routing-System MUST kollidierende Plugin-Routen vor dem Aufbau des Route-Baums deterministisch erkennen und die Materialisierung abbrechen.

#### Scenario: Zwei Plugins beanspruchen denselben kanonischen Pfad

- **GIVEN** zwei Plugin-Beiträge registrieren denselben kanonischen Routenpfad
- **WHEN** der Host den Route-Baum materialisiert
- **THEN** bricht die Registrierungsphase mit einem Konfliktfehler ab
- **AND** es wird kein teilweise inkonsistenter Route-Baum veröffentlicht

#### Scenario: Route-Konflikt bleibt auf dieselbe Aktivierungsmenge begrenzt

- **GIVEN** ein Plugin ist für die aktuelle Instanz oder Umgebung deaktiviert
- **WHEN** der Host aktive Plugin-Beiträge validiert
- **THEN** prüft der Konflikt-Detektor nur die effektiv aktive Beitragsmenge
- **AND** deaktivierte Beiträge überschreiben keine aktiven Routen stillschweigend

### Requirement: Typisierter Plugin-Route-Vertrag

Das Routing-System SHALL Plugin-Routen über einen deklarativen, typisierten Vertrag für Search-Params, Path-Params und Component-Bindings integrieren.

#### Scenario: Plugin liefert typisierte Search-Params

- **GIVEN** ein Plugin deklariert Search-Params und Path-Params für eine Route
- **WHEN** der Host die Route materialisiert
- **THEN** bleiben diese Typinformationen im Hostvertrag erhalten
- **AND** die Route-Component wird nicht über einen untypisierten `unknown`-Cast eingebunden

#### Scenario: Plugin versucht host-owned Parsing zu ersetzen

- **GIVEN** ein Plugin versucht eine Route mit eigenem Guard-, Parse- oder Materialisierungsverhalten ausserhalb des Vertrags zu liefern
- **WHEN** der Host die Definition validiert
- **THEN** wird der Beitrag abgewiesen
- **AND** Search-Param-Parsing, Guard-Auswertung und Route-Ownership bleiben hostkontrolliert
