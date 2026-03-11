## ADDED Requirements

### Requirement: Gruppenbasierte Bündelung von Berechtigungen

Das System SHALL ein instanzgebundenes Gruppenmodell bereitstellen, das Rollen und Berechtigungen für mehrere Accounts bündelt.

#### Scenario: Gruppe vermittelt Rollen an mehrere Accounts

- **WHEN** ein Administrator eine Gruppe mit Rollen oder Permissions verknüpft und mehrere Accounts zuordnet
- **THEN** fließen diese Zuordnungen in die effektive Berechtigungsberechnung der betroffenen Accounts ein
- **AND** der Ursprung über die Gruppe bleibt für Diagnose und Audit nachvollziehbar

### Requirement: Fein granulare Permission-Struktur für Rollen und Gruppen

Das System SHALL Berechtigungen in strukturierter Form für Rollen- und Gruppenpfade auswerten können.

#### Scenario: Ressourcenspezifische Erlaubnis mit Scope

- **WHEN** eine Berechtigung mit `action`, `resource_type`, optionalem `resource_id`, `scope` und `effect` gespeichert ist
- **THEN** kann dieselbe Struktur sowohl für direkte Rollen-Zuweisungen als auch für gruppenvermittelte Berechtigungen ausgewertet werden
- **AND** die Berechnung bleibt instanzisoliert

### Requirement: Snapshot-Key mit Kontext- und Versionssignalen

Das System SHALL Permission-Snapshots mit einem Schlüssel verwalten, der alle für die Entscheidung relevanten Kontexte und Versionssignale abbildet.

#### Scenario: Org- oder Gruppenkontext ändert sich

- **WHEN** sich aktiver Organisationskontext, Geo-Kontext oder relevante Versionssignale für Rollen, Gruppen oder Hierarchien ändern
- **THEN** referenziert der Snapshot-Key einen anderen Zustand
- **AND** ein veralteter Snapshot wird nicht als gültiger Volltreffer weiterverwendet

### Requirement: Ereignisbasierte Invalidierung für effektive Rechte

Das System SHALL effektive Berechtigungs-Snapshots bei allen relevanten Rechteänderungen invalidieren.

#### Scenario: Gruppen- oder Hierarchieänderung invalidiert Snapshot

- **WHEN** Rollen, Gruppen, Memberships, Delegationen oder Organisationshierarchien geändert werden
- **THEN** werden betroffene Snapshots invalidiert
- **AND** nachfolgende `authorize`- oder `me/permissions`-Anfragen berechnen die effektive Sicht auf Basis des neuen Zustands

### Requirement: Zeitlich begrenzte Vertretungsrechte in der Authorize-Berechnung

Das System SHALL temporäre Vertretungsrechte mit Start- und Enddatum in der effektiven Berechtigungsberechnung berücksichtigen.

#### Scenario: Delegation ist abgelaufen

- **WHEN** eine Delegation oder Vertretung ihr Enddatum überschritten hat
- **THEN** liefert sie keine effektiven Berechtigungen mehr
- **AND** ein weiterer Zugriff über diesen Pfad wird verweigert

### Requirement: Messbarer Performance-Nachweis für Cache-Hit und Cache-Miss

Das System SHALL für die produktionsnahe Authorize-Strecke getrennte Performance-Nachweise für Cache-Hit und Cache-Miss bereitstellen.

#### Scenario: Versionierter Benchmark für beide Pfade

- **WHEN** die Permission Engine verifiziert wird
- **THEN** werden Cache-Hit und Cache-Miss getrennt gemessen
- **AND** die Ergebnisse werden versioniert dokumentiert
- **AND** Abweichungen zum Zielwert sind für Review und Betrieb nachvollziehbar
