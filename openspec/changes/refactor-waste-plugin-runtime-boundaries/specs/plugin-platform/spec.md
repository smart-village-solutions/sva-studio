## ADDED Requirements

### Requirement: Waste-Fachausführung bleibt vollständig in vorhandenen Fachpaketen

Das System SHALL Waste-spezifische Hintergrundoperationen, fachliche Persistenzadapter und Audit-Projektionen in den bestehenden Waste-Paketen halten. App und generische Instanz-/Auth-/Governance-Bausteine SHALL ausschließlich technische Host-Fähigkeiten und generische Verträge besitzen; das Plugin SHALL keine Host-Interna direkt importieren.

#### Scenario: Fachoperation wird ausgeführt

- **WHEN** ein Waste-Job Migration, Import, Export, Sync, Reminder oder Provisionierung ausführt
- **THEN** liegt die Fachimplementierung in `waste-management-runtime`
- **AND** der Host stellt nur validierte technische Ausführungsfähigkeiten bereit
- **AND** der ersetzte App-Fachpfad ist entfernt

#### Scenario: Generisches Instanzdetail wird gelesen

- **WHEN** ein generischer Instanzdetailrequest ausgeführt wird
- **THEN** benötigt dessen Typ und Ladepfad keine Waste-Fachtypen oder Waste-Einstellungen
- **AND** Waste-Verbraucher beziehen ihre Fachwerte über den koordiniert umgestellten Waste-Pfad

#### Scenario: Waste-Fachadapter verwendet vorhandene Plattformpersistenz

- **WHEN** Waste-Datenquellen, Provisionierungszustand oder technische Historie gelesen oder geschrieben werden
- **THEN** besitzt Waste die fachliche Interpretation und SQL-Adapter
- **AND** vorhandene Daten, RLS, Tenantbindung und Transaktionsgrenzen bleiben erhalten
- **AND** der Ownership-Wechsel erfordert keine neue Datenbank

### Requirement: Waste ist im vorhandenen Profil physisch optional

Das System SHALL die vorhandene Distribution ohne Waste ohne Waste-Plugin, Waste-Contracts und Waste-Runtime ausliefern und ausführen können. Der Nachweis SHALL Paket-/Chunk-Auflösung und reale Ausführung des finalen Artefakts einschließen.

#### Scenario: SSF-Artefakt ohne Waste startet

- **GIVEN** das vorhandene SSF-Profil wird gebaut und paketiert
- **WHEN** das finale Artefakt ohne die Waste-Pakete startet und generische Instanz-/Jobpfade ausführt
- **THEN** werden weder Waste-Module benötigt noch Waste-Handler oder Waste-SQL ausgeführt
- **AND** Boot-/Health- und generische Host-Probes bestehen

#### Scenario: Studio-Artefakt lädt installiertes Waste

- **GIVEN** das Studio-Profil enthält das Waste-Plugin
- **WHEN** der Host Server- und Jobbeiträge aus dem validierten Snapshot lädt
- **THEN** sind die realen installierten Entries ausführbar
- **AND** bestehende Fachverträge funktionieren ohne parallelen Waste-Fallback

### Requirement: Waste-Grenze besitzt automatisierte Abschlussnachweise ohne zusätzliche Infrastruktur

Das System SHALL die Waste-Ownership mit bestehenden Importprüfungen, Vitest-/Nx-Tests, PostgreSQL-Integration, Artefaktprüfung und automatisiertem Browser-Smoke nachweisen. Ein Agent SHALL die Evidenz A1–A9 für den exakten finalen HEAD auswerten; fehlende Evidenz SHALL die Abnahme blockieren.

#### Scenario: Agent nimmt den Refactor ab

- **WHEN** der Agent die A1–A9-Ergebnisse und den finalen Diff prüft
- **THEN** nennt er je Kriterium Commit, ausführbaren Nachweis und PASS/FAIL/BLOCKED
- **AND** er verlangt keine routinemäßige manuelle Klickliste vom Nutzer
- **AND** KI-Einschätzung ersetzt keine ausgeführten Sicherheits-, DB- oder Artefakttests

#### Scenario: Neue Host-Kante oder zusätzliche Schicht wird eingeführt

- **WHEN** der Refactor einen direkten Waste-Import auf Auth-/IAM-/App-Interna oder einen parallelen Ausführungspfad einführt
- **THEN** scheitert der gezielte blockierende Nachweis im vorhandenen Architekturtest
- **AND** eine leere JSON-Allowlist oder warn-only CLI begründet keine Freigabe
- **AND** neue Packages, Services, Registries, Datenbanken oder CI-Workflows sind keine zulässige Ersatzlösung
