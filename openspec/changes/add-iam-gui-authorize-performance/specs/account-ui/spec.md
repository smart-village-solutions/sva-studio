## ADDED Requirements
### Requirement: GUI-gestuetzter Authorize-Performance-Lauf im Monitoring
Das System MUST im bestehenden Monitoring-Bereich unter `/monitoring` einen bedienbaren Bereich fuer einen sessiongebundenen Authorize-Performance-Lauf bereitstellen.

#### Scenario: Berechtigter Administrator findet den Lauf im Monitoring-Menue

- **WHEN** ein berechtigter Administrator den Monitoring-Bereich der Anwendung oeffnet
- **THEN** ist dort ein eigener IAM-bezogener Einstieg `Authorize Performance` erreichbar
- **AND** ist der Einstieg nicht nur als Unterfunktion des IAM-Cockpits versteckt
- **AND** bleibt das IAM-Cockpit unter `/admin/iam` von dieser Platzierung fachlich getrennt

#### Scenario: Berechtigter Administrator startet den Lauf

- **WHEN** ein berechtigter Administrator den Monitoring-Einstieg `Authorize Performance` nutzt
- **THEN** kann er einen serverseitigen Benchmark fuer `POST /iam/authorize` mit seiner aktuellen Session starten
- **AND** die UI bietet Eingaben fuer mindestens `action`, `resourceType`, optionale `resourceId` und optionales `organizationId`
- **AND** die UI zeigt waehrend des Laufs einen klaren Status statt stiller Hintergrundaktivitaet

#### Scenario: Ergebnis wird lesbar ausgewertet

- **WHEN** der Benchmark erfolgreich abgeschlossen wurde
- **THEN** zeigt die UI die Szenarien `cache-hit`, `cache-miss` und `recompute`
- **AND** zeigt pro Szenario mindestens `Samples`, `p50`, `p95`, `p99` und eine fachliche Bewertung
- **AND** macht die UI klar kenntlich, dass die Messung serverseitig und nicht als Browser-Timing erhoben wurde

#### Scenario: Lauf scheitert sicher und verstaendlich

- **WHEN** Session, Berechtigung, Invalidation oder Servermessung fehlschlagen
- **THEN** zeigt die UI einen verstaendlichen Fehlerzustand ohne Stacktrace- oder Geheimnisleck
- **AND** suggeriert keinen gueltigen Performance-Nachweis aus einem unvollstaendigen Lauf
