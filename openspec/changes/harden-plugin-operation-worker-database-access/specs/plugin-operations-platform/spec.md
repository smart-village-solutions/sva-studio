## ADDED Requirements

### Requirement: Interne Job-Runner verwenden getrennte Datenbank-Principals

Das System SHALL Datenbankmigration, App-Enqueue und Jobverarbeitung mit getrennten, minimal berechtigten Principals ausführen.

#### Scenario: App reiht einen generischen Job ein

- **WHEN** ein Host-Endpunkt einen generischen Studio-Job startet
- **THEN** darf der App-Principal den Job ohne allgemeine Datenbank- oder Schema-DDL-Rechte einreihen
- **AND** erfolgt das Einreihen über einen migrationsverwalteten, eingabevalidierenden `SECURITY DEFINER`-Wrapper mit festem `search_path`
- **AND** bleiben direkte Graphile-Funktionen und Queue-Tabellen für den App-Principal gesperrt
- **AND** führt der Request-Pfad keine Graphile-Worker-Migration aus

#### Scenario: Worker verarbeitet einen generischen Job

- **WHEN** der interne Runner einen eingereihten Job verarbeitet
- **THEN** verwendet er einen dedizierten Worker-Principal mit eigenem Datenbank-Pool
- **AND** erlauben ausschließlich schema-lokale RLS-Policies Claim, Lock und Abschluss auf den internen Graphile-Tabellen
- **AND** besitzt der Worker-Principal kein globales `BYPASSRLS`
- **AND** fällt er in produktionsnahen Profilen bei fehlender Worker-Konfiguration nicht auf den App-Principal zurück

#### Scenario: Queue-Schema ist nicht vorbereitet

- **WHEN** das erforderliche Graphile-Worker-Schema oder seine minimalen Grants fehlen
- **THEN** verhindert der kontrollierte Rollout den App-Deploy fail-closed
- **AND** versucht die laufende App keine selbstständige Schemaheilung

#### Scenario: Aktivierter Worker ist nicht lauffähig

- **WHEN** eine Runtime mit aktivierter Worker-Lane den Worker nicht starten kann oder der laufende Worker abbricht
- **THEN** meldet der Readiness-Endpunkt den Dienst `jobWorker` mit stabilem Reason-Code als nicht bereit
- **AND** protokolliert die Runtime den Start- oder Laufzeitfehler als Fehlerereignis
- **AND** bleibt eine ausdrücklich deaktivierte Worker-Lane readiness-neutral
