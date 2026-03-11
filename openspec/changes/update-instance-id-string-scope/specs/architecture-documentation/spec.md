## MODIFIED Requirements
### Requirement: Architekturentscheidungen sind nachvollziehbar dokumentiert

Die Architekturdokumentation SHALL zentrale fachliche und technische Leitentscheidungen so beschreiben, dass Implementierung und Betrieb konsistent ausgerichtet werden können.

#### Scenario: Instanz-Scope-Dokumentation aktualisiert

- **WHEN** sich das kanonische Format von `instanceId` ändert
- **THEN** beschreiben die relevanten arc42-Abschnitte `instanceId` als fachlichen String-Schlüssel
- **AND** veraltete UUID-spezifische Aussagen zum Instanzformat werden entfernt oder korrigiert
