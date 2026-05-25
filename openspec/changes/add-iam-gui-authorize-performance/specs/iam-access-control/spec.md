## ADDED Requirements
### Requirement: Sessiongebundene serverseitige Authorize-Performance-Ausfuehrung
Das System SHALL einen geschuetzten serverseitigen Performance-Lauf fuer den echten `POST /iam/authorize`-Pfad bereitstellen, der den aktuellen Session-Benutzer als Messsubjekt nutzt.

#### Scenario: Session-Benutzer ist die Messidentitaet

- **WHEN** ein berechtigter Administrator einen GUI-gestuetzten Performance-Lauf startet
- **THEN** leitet der Server `instanceId` und `keycloakSubject` aus der aktuellen Session ab
- **AND** verwendet keine in der UI eingegebenen technischen Login-Credentials
- **AND** fuehrt die Messung im Kontext dieses Benutzers fail-closed aus

#### Scenario: Recompute invalidiert nur den aktuellen Benutzerkontext

- **WHEN** das Szenario `recompute` gemessen wird
- **THEN** invalidiert das System gezielt den Permission-Snapshot des aktuellen Session-Benutzers
- **AND** fuehrt danach einen neuen `authorize`-Request gegen denselben fachlichen Kontext aus
- **AND** invalidiert dabei nicht stillschweigend globale oder fremde Benutzer-Snapshots

#### Scenario: Ergebnis ist fuer GUI und Nachweisfuehrung anschlussfaehig

- **WHEN** der serverseitige Lauf abgeschlossen wurde
- **THEN** liefert das System strukturierte Ergebnisse fuer `cache-hit`, `cache-miss` und `recompute`
- **AND** enthaelt jedes Szenario mindestens `Samples`, `p50`, `p95`, `p99` und eine Bewertungsinformation
- **AND** kann das Ergebnis fuer versionierte Report-Artefakte unter `docs/reports/` wiederverwendet werden
