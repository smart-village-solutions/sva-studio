## ADDED Requirements

### Requirement: Strukturierte Permission-Persistenz für Autorisierung

Das System SHALL fachliche Berechtigungen in strukturierter Form persistieren, sodass die Autorisierungsberechnung nicht ausschließlich auf flachen `permission_key`-Strings basiert.

#### Scenario: Strukturierte Rollen-Permission wird gespeichert

- **WHEN** eine Rollen-Permission im IAM erfasst oder aus Seeds bereitgestellt wird
- **THEN** liegen mindestens `action`, `resource_type`, optional `resource_id`, `scope` und `effect` in maschinenlesbarer Form vor
- **AND** die Berechtigung bleibt auf die aktive `instanceId` begrenzt

#### Scenario: Bestehende Permission-Key-Daten bleiben während der Migration auswertbar

- **WHEN** noch nicht alle bestehenden Rollen-Permissions in die strukturierte Form migriert wurden
- **THEN** existiert ein definierter Migrations- oder Kompatibilitätspfad
- **AND** bestehende Autorisierungsentscheidungen brechen nicht ungesteuert weg

### Requirement: Effektive Berechtigungsauflösung über Organisationshierarchie

Das System SHALL effektive Berechtigungen entlang der Organisationshierarchie innerhalb der aktiven `instanceId` vererben.

#### Scenario: Parent-Berechtigung wirkt auf Child-Organisation

- **WHEN** ein Benutzer im aktiven Org-Kontext einer untergeordneten Organisation handelt
- **AND** eine passende `allow`-Berechtigung auf einer übergeordneten Organisation vorliegt
- **THEN** wird diese Berechtigung auf die untergeordnete Organisation vererbt
- **AND** `POST /iam/authorize` liefert eine reproduzierbare Freigabe

#### Scenario: Instanzfremde Hierarchie bleibt wirkungslos

- **WHEN** eine Hierarchieauswertung Parent- oder Child-Daten außerhalb der aktiven `instanceId` referenzieren würde
- **THEN** werden diese Daten nicht in die effektive Berechnung einbezogen
- **AND** die Entscheidung bleibt instanzisoliert

### Requirement: Restriktionen überschreiben vererbte Freigaben

Das System SHALL lokale Restriktionen auf untergeordneten Ebenen höher priorisieren als vererbte Freigaben aus Parent-Ebenen.

#### Scenario: Child-Restriktion blockiert Parent-Allow

- **WHEN** eine vererbte `allow`-Berechtigung aus einer Parent-Organisation vorliegt
- **AND** auf der untergeordneten Organisation eine passende Restriktion oder `deny`-Regel existiert
- **THEN** wird die effektive Berechtigung verweigert
- **AND** die Antwort enthält einen nachvollziehbaren Denial-Reason

### Requirement: Konsistente Auswertung von Org- und Geo-Scopes

Das System SHALL Organisations- und Geo-Scopes gemeinsam in die finale Berechtigungsentscheidung einbeziehen, sofern beide für die angefragte Ressource relevant sind.

#### Scenario: Org-Scope erlaubt, Geo-Scope verweigert

- **WHEN** eine Rollen-Permission im aktiven Organisationskontext grundsätzlich passt
- **AND** der angefragte Geo-Kontext nicht im effektiven Scope enthalten ist
- **THEN** wird die Anfrage verweigert
- **AND** die Verweigerung ist deterministisch reproduzierbar

### Requirement: Erweiterte Snapshot-Berechnung für Scope-Kontexte

Das System SHALL Permission-Snapshots so berechnen, dass aktiver Org-Kontext, Organisationshierarchie und Geo-Scopes im Hit-Pfad ohne zusätzliche Datenbankzugriffe ausgewertet werden können.

#### Scenario: Snapshot enthält effektive Scope-Daten

- **WHEN** ein Snapshot für einen Benutzer-/Instanzkontext erzeugt wird
- **THEN** enthält der Snapshot die effektiven Berechtigungen inklusive relevanter Org- und Geo-Reichweite
- **AND** `POST /iam/authorize` kann im Cache-Hit-Pfad reine In-Memory-Checks ausführen

### Requirement: Erweiterte Invalidation bei Strukturänderungen

Das System SHALL Permission-Snapshots auch bei Änderungen an Hierarchie- und Scope-Strukturen invalidieren.

#### Scenario: Hierarchieänderung invalidiert effektive Berechtigungen

- **WHEN** Parent-/Child-Beziehungen, Memberships oder relevante Geo-Zuordnungen geändert werden
- **THEN** werden betroffene Snapshots invalidiert
- **AND** nachfolgende Authorize-Anfragen berechnen effektive Rechte auf Basis des neuen Zustands
