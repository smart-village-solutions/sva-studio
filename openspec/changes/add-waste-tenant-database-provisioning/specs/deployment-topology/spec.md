## ADDED Requirements

### Requirement: Das Swarm-Referenzprofil betreibt tenantbezogene Waste-Datenbanken als inventarisierte Persistenz

Das System SHALL dynamisch provisionierte tenantbezogene Waste-Datenbanken im PostgreSQL-Betriebsvertrag inventarisieren, sichern, überwachen und wiederherstellen können.

#### Scenario: Provisionierung verwendet vorhandene Laufzeitkomponenten

- **WHEN** die automatische Waste-Datenbankprovisionierung ausgerollt wird
- **THEN** führt die vorhandene Plugin-Operations-/Worker-Infrastruktur den Provisionierungsjob aus
- **AND** es entsteht kein neuer dauerhaft laufender Service, Container, Port oder separater Stack
- **AND** das vorhandene Deployment wird einmalig um das geschützte Provisionierer-Secret, die PostgreSQL-Rolle, erforderliche Migrationen und Backup-Discovery ergänzt

#### Scenario: Ein weiterer Tenant aktiviert Waste-Management

- **GIVEN** die Provisionierungsfunktion wurde vollständig ausgerollt
- **WHEN** `waste-management` einer weiteren Instanz zugewiesen wird
- **THEN** provisioniert das System deren Datenbank und tenantbezogene Secrets automatisch
- **AND** dafür ist keine Änderung am Swarm-Deployment und kein manuelles Anlegen eines Tenant-Secrets erforderlich

#### Scenario: Waste-Datenbank wird im vorhandenen PostgreSQL-Cluster provisioniert

- **WHEN** `waste-management` für eine Instanz provisioniert wird
- **THEN** legt der geschützte Provisionierer eine eigene Datenbank im dafür vorgesehenen PostgreSQL-Cluster an
- **AND** die normale Studio-App-Runtime erhält keine clusterweiten `CREATEDB`- oder `CREATEROLE`-Rechte
- **AND** tenantbezogene Runtime-Credentials werden als Secrets und nicht als allgemeine Stack-Config behandelt

#### Scenario: Backup inventarisiert dynamische Waste-Datenbanken

- **WHEN** der reguläre Sicherungslauf den PostgreSQL-Bestand verarbeitet
- **THEN** entdeckt er jede aktive oder erhaltene tenantbezogene Waste-Datenbank über einen kanonischen Inventarpfad
- **AND** ordnet die Sicherung eindeutig der Studio-Instanz und Datenbank zu
- **AND** gibt weder in Artefaktnamen noch in Logs Credentials aus

#### Scenario: Tenantbezogene Waste-Datenbank wird wiederhergestellt

- **WHEN** ein Operator eine Waste-Sicherung wiederherstellt oder eine Restore-Probe ausführt
- **THEN** prüft der Betriebsprozess Zielinstanz und Zieldatenbank vor schreibenden Operationen
- **AND** dokumentiert er Restore-Ergebnis, Schema-Version und redigierte Verifikation
- **AND** ein Restore darf nicht still in die Datenbank eines anderen Tenants schreiben

#### Scenario: Standard-Rollout bleibt unverändert

- **WHEN** Provisionierer, Migrationen oder Betriebswerkzeuge für tenantbezogene Waste-Datenbanken ausgerollt werden
- **THEN** erfolgt der reguläre Rollout weiterhin über GitHub Actions von Dev über Staging nach Production mit demselben Image-Digest
- **AND** direkte Portainer-, Docker- oder rohe `quantum-cli`-Mutationen werden dadurch nicht zum konkurrierenden Standardpfad
