## MODIFIED Requirements

### Requirement: Instanzgebundene Hierarchieauswertung

Das System SHALL Hierarchie- und Vererbungsentscheidungen strikt innerhalb der aktiven `instanceId` auswerten und die Organisationshierarchie als autoritative Eingangsgröße für effektive Permission-Vererbung bereitstellen.

#### Scenario: Hierarchiezugriff über Instanzgrenze

- **WHEN** eine Hierarchieauswertung Daten außerhalb der aktiven `instanceId` referenziert
- **THEN** werden diese Daten nicht in die effektive Berechnung einbezogen
- **AND** die Autorisierungsentscheidung bleibt instanzisoliert

#### Scenario: Organisationshierarchie speist Permission-Vererbung

- **WHEN** `POST /iam/authorize` oder `GET /iam/me/permissions` effektive Rechte im aktiven Organisationskontext berechnen
- **THEN** nutzt die Berechnungsstrecke die persistierte Organisationshierarchie derselben `instanceId`
- **AND** Parent-/Child-Beziehungen werden als autoritativer Vererbungsinput ausgewertet
