## MODIFIED Requirements
### Requirement: Mehrfach-Zugehörigkeit von Accounts zu Organisationen

Das System SHALL Accounts mehreren Organisationen derselben Instanz zuordnen können.

#### Scenario: Account wird mehreren Organisationen zugeordnet

- **WHEN** ein Administrator einem Account mehrere Organisationen innerhalb derselben `instanceId` zuweist
- **THEN** werden alle gültigen Zuordnungen gespeichert
- **AND** der Account bleibt in jeder dieser Organisationen referenzierbar

#### Scenario: Instanzfremde Account-Zuordnung wird abgewiesen

- **WHEN** ein Account einer Organisation einer anderen `instanceId` zugeordnet werden soll
- **THEN** wird die Operation abgewiesen
- **AND** keine Zuordnung wird gespeichert

#### Scenario: Membership-Attribute werden nachtraeglich aktualisiert

- **WHEN** ein Administrator für eine bestehende Organisationsmitgliedschaft `visibility` oder `isDefaultContext` ändert
- **THEN** werden nur die Membership-Attribute aktualisiert
- **AND** die fachliche Zuordnung des Accounts zur Organisation bleibt erhalten
- **AND** der Account besitzt danach hoechstens eine als Default markierte Organisationsmitgliedschaft innerhalb derselben Instanz

#### Scenario: User-zentrierte Read-Modelle koennen Organisationsmitgliedschaften aufloesen

- **WHEN** ein Administrator Benutzerdetails für einen Account lädt
- **THEN** liefert das Read-Model die Organisationsmitgliedschaften des Accounts inklusive Organisationsmetadaten und Membership-Attributen
- **AND** die Antwort eignet sich sowohl für die User-Detailseite als auch für konsistente Folge-Mutationen im selben Bedienfluss
