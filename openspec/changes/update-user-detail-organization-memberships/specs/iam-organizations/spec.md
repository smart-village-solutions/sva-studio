## MODIFIED Requirements
### Requirement: Mehrfach-Zugehoerigkeit von Accounts zu Organisationen

Das System SHALL Accounts mehreren Organisationen derselben Instanz zuordnen koennen.

#### Scenario: Account wird mehreren Organisationen zugeordnet

- **WENN** ein Administrator einem Account mehrere Organisationen innerhalb derselben `instanceId` zuweist
- **THEN** werden alle gueltigen Zuordnungen gespeichert
- **AND** der Account bleibt in jeder dieser Organisationen referenzierbar

#### Scenario: Instanzfremde Account-Zuordnung wird abgewiesen

- **WENN** ein Account einer Organisation einer anderen `instanceId` zugeordnet werden soll
- **THEN** wird die Operation abgewiesen
- **AND** keine Zuordnung wird gespeichert

#### Scenario: Membership-Attribute werden nachtraeglich aktualisiert

- **WENN** ein Administrator fuer eine bestehende Organisationsmitgliedschaft `visibility` oder `isDefaultContext` aendert
- **THEN** werden nur die Membership-Attribute aktualisiert
- **AND** die fachliche Zuordnung des Accounts zur Organisation bleibt erhalten
- **AND** der Account besitzt danach hoechstens eine als Default markierte Organisationsmitgliedschaft innerhalb derselben Instanz

#### Scenario: User-zentrierte Read-Modelle koennen Organisationsmitgliedschaften aufloesen

- **WENN** ein Administrator Benutzerdetails fuer einen Account laedt
- **THEN** liefert das Read-Model die Organisationsmitgliedschaften des Accounts inklusive Organisationsmetadaten und Membership-Attributen
- **AND** die Antwort eignet sich sowohl fuer die User-Detailseite als auch fuer konsistente Folge-Mutationen im selben Bedienfluss
