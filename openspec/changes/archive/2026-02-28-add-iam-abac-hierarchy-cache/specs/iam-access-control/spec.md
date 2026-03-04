# IAM Access Control Specification Delta (ABAC + Cache)

## ADDED Requirements

### Requirement: ABAC-Erweiterung für kontextbasierte Entscheidungen

Das System SHALL neben RBAC kontextbasierte ABAC-Regeln auswerten und diese deterministisch in die Autorisierungsentscheidung einbeziehen.

#### Scenario: Kontextabhängige Freigabe

- **WHEN** eine `authorize`-Anfrage mit gültigem Kontext (Instanz, Organisation, Geo, weitere Attribute) eingeht
- **THEN** werden passende ABAC-Regeln ausgewertet
- **AND** die finale Entscheidung enthält einen nachvollziehbaren Grund

### Requirement: Hierarchische Vererbung mit Restriktionen

Das System SHALL Berechtigungen entlang definierter Org-/Geo-Hierarchien vererben und untergeordnete Restriktionen berücksichtigen.

#### Scenario: Vererbte Berechtigung mit Einschränkung

- **WHEN** eine Berechtigung auf übergeordneter Ebene vergeben ist
- **AND** auf untergeordneter Ebene eine Einschränkung existiert
- **THEN** wird die effektive Berechtigung unter Berücksichtigung der Einschränkung berechnet
- **AND** die Entscheidung ist reproduzierbar

### Requirement: Cache-basierte Berechtigungs-Snapshots

Das System SHALL effektive Berechtigungen als Snapshots im Cache pro Benutzer- und Instanzkontext verwalten.

#### Scenario: Snapshot-Hit

- **WHEN** für den Benutzer-/Instanzkontext ein gültiger Snapshot vorliegt
- **THEN** wird die Autorisierungsentscheidung auf Basis dieses Snapshots getroffen
- **AND** die P95-Latenz von `POST /iam/authorize` bleibt unter 50 ms

#### Scenario: Snapshot-TTL und Stale-Grenze

- **WHEN** Snapshot-Caching für `authorize` aktiv ist
- **THEN** beträgt die Snapshot-TTL maximal 300 Sekunden
- **AND** die maximal tolerierte Dauer potenziell veralteter Entscheidungen beträgt 300 Sekunden

### Requirement: Event-basierte Invalidierung mit Fallback

Das System SHALL Cache-Einträge bei relevanten Änderungen invalidieren und bei Event-Problemen über Fallback-Mechanismen konsistent bleiben.

#### Scenario: Rollenänderung invalidiert Snapshot

- **WHEN** Rollen oder relevante Kontextzuordnungen eines Benutzers geändert werden
- **THEN** wird der zugehörige Cache-Eintrag invalidiert
- **AND** eine nachfolgende Anfrage berechnet Berechtigungen neu
- **AND** die End-to-End-Invalidierungslatenz liegt bei P95 <= 2 Sekunden und P99 <= 5 Sekunden

#### Scenario: Eventverlust wird abgefangen

- **WHEN** ein Invalidation-Event ausfällt
- **THEN** begrenzen TTL und Recompute-Mechanismus die Dauer potenziell veralteter Entscheidungen
- **AND** Konsistenztests erkennen unzulässige Dauerabweichungen

### Requirement: Messbare Performance- und Lastkriterien für ABAC-Authorize

Das System SHALL die ABAC-erweiterte Authorize-Strecke mit definiertem Lastprofil und SLOs verifizieren.

#### Scenario: Lastprofil erfüllt SLO

- **WHEN** `POST /iam/authorize` unter einem Lastprofil von mindestens 100 RPS und 500 gleichzeitigen Nutzern getestet wird
- **THEN** liegt die gemessene P95-Latenz unter 50 ms
- **AND** die Messergebnisse werden versioniert dokumentiert

### Requirement: Operative Pflichtfelder im Authorize-/Cache-Logging

Das System SHALL in Authorize- und Cache-bezogenen operativen Logs die Pflichtfelder für Korrelation und Mandantenkontext mitführen.

#### Scenario: Strukturierter Log-Eintrag im Authorize-/Cache-Pfad

- **WHEN** im Authorize-/Cache-Pfad ein operativer Log-Eintrag erzeugt wird
- **THEN** enthält der Eintrag mindestens `workspace_id` (= `instanceId`), `component`, `environment`, `level`
- **AND** der Eintrag referenziert `request_id` und `trace_id`

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
