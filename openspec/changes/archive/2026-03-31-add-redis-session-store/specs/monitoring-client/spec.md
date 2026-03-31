## ADDED Requirements

### Requirement: Redis-Session-Store ist operativ beobachtbar
Das System SHALL für den Redis-basierten Session-Store Gesundheits-, Fehler- und Lastsignale bereitstellen, damit Störungen im Session-Pfad schnell erkennbar werden.

#### Scenario: Redis-Konnektivität wird sichtbar
- **WHEN** der Session-Store Redis nicht erreichen kann
- **THEN** erzeugt das System ein maschinenlesbares Fehlersignal für die Konnektivität
- **AND** die Betriebsdiagnose kann den Fehler von allgemeinen Auth- oder OIDC-Fehlern unterscheiden

#### Scenario: Session-Operationen liefern Basis-Metriken
- **WHEN** Sessions erstellt, gelesen, aktualisiert oder gelöscht werden
- **THEN** erfasst das System mindestens Zähler für Operation und Ergebnis
- **AND** die Telemetrie erlaubt die Unterscheidung zwischen erfolgreichen und fehlgeschlagenen Session-Operationen

### Requirement: Latenz und Kapazität des Session-Stores sind messbar
Das System SHALL für den Redis-basierten Session-Store Latenz- und Kapazitätssignale bereitstellen, um Engpässe früh zu erkennen.

#### Scenario: Session-Latenz ist auswertbar
- **WHEN** der Session-Store unter Last steht
- **THEN** kann der Betrieb die Latenz von Session-Operationen mindestens für p50, p95 und p99 auswerten

#### Scenario: Aktive Sessions und Redis-Ressourcen sind sichtbar
- **WHEN** die Anzahl aktiver Sessions oder die Redis-Speichernutzung stark ansteigt
- **THEN** kann das System diese Entwicklung über geeignete Metriken oder Health-Signale sichtbar machen

### Requirement: Redis-Störungen lösen definierte Betriebsreaktionen aus
Das System SHALL für den Redis-basierten Session-Store definierte Alerting- und Restore-Reaktionen dokumentieren.

#### Scenario: Redis-Ausfall im Single-Node-Betrieb
- **WHEN** der einzelne Redis-Knoten im produktiven Session-Betrieb ausfällt
- **THEN** beschreibt der Betriebspfad Alarmierung, Restore und Wiederanlauf aus Backup
- **AND** der Ablauf ist auf das Betriebsmodell `Single Redis mit Backup/Restore` abgestimmt

#### Scenario: Auffällige Session-Erzeugungsrate
- **WHEN** die Erzeugungsrate neuer Sessions auffällig ansteigt
- **THEN** kann das System dies als eigenes Betriebs- oder Sicherheitsignal ausgeben
- **AND** die Reaktion ist von gewöhnlichen Redis-Latenzproblemen unterscheidbar
