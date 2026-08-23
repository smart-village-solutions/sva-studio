## ADDED Requirements

### Requirement: Runner-Schema wird ausschließlich im kontrollierten Migrationsschritt gepflegt

Das System SHALL das interne Graphile-Worker-Schema ausschließlich mit dem privilegierten Studio-Migrations-One-shot aktualisieren und anschließend minimale Runtime-Rechte herstellen.

#### Scenario: Promote führt eine erforderliche Queue-Migration aus

- **WHEN** ein Studio-Release den Plugin-Operations-Runner oder seinen Datenbankvertrag ändert
- **THEN** klassifiziert der Rollout die Änderung als migrations- und bootstraprelevant
- **AND** führt der Migrations-One-shot die an die Image-Version gebundene Graphile-Migration vor dem App-Deploy aus
- **AND** entzieht der Migrations-One-shot neu angelegten Graphile-Objekten bereits vor dem Bootstrap allgemeine `PUBLIC`-Rechte
- **AND** prüft der Bootstrap anschließend den dedizierten Worker-Principal und die minimalen App-/Worker-Grants

#### Scenario: Produktiver App-Principal besitzt überbreite DDL-Rechte

- **WHEN** Bootstrap oder Postconditions allgemeine `CREATE`-Rechte des App-Principals auf der Studio-Datenbank erkennen
- **THEN** entzieht der kontrollierte Bootstrap diese überbreiten Rechte
- **AND** bleibt das Einreihen von Jobs über gezielte Queue-Rechte möglich

#### Scenario: Worker-Secret fehlt

- **WHEN** Dev, Staging oder Production ohne das erforderliche Worker-Datenbank-Secret ausgerollt werden soll
- **THEN** stoppt der geschützte Rollout vor dem App-Deploy
- **AND** werden weder Secret-Wert noch abgeleitete Zugangsdaten in Evidenz oder Logs ausgegeben
