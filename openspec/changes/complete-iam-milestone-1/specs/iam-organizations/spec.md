## ADDED Requirements

### Requirement: Mehrstufige kommunale Organisationsstrukturen

Das System SHALL mehrstufige Organisationsstrukturen für den kommunalen Standardfall modellieren können, ohne auf eine feste Maximaltiefe begrenzt zu sein.

#### Scenario: Landkreis, Region, Gemeinde und Ortsteil in einer Instanz

- **WHEN** eine Instanz eine Hierarchie aus Landkreis, Region, Gemeinde und Ortsteil enthält
- **THEN** können diese Ebenen als Parent-/Child-Beziehungen in derselben Instanz modelliert werden
- **AND** nachgelagerte Hierarchie- und Filteroperationen bleiben reproduzierbar

### Requirement: Beitrittsprinzip per Einladung oder Bewerbung

Das System SHALL Organisationsbeitritte kontrolliert über Einladung oder Bewerbung steuern.

#### Scenario: Externer Benutzer bewirbt sich auf Mitgliedschaft

- **WHEN** ein externer Benutzer einer Organisation beitreten möchte
- **THEN** kann der Beitritt als Bewerbung oder Einladung erfasst werden
- **AND** die Mitgliedschaft wird erst nach definierter Freigabe wirksam

### Requirement: Konfigurierbare Privacy-Optionen für Organisationskontext

Das System SHALL für organisationsbezogene Sichtbarkeit zwischen Namensnennung und Anonymität unterscheiden können.

#### Scenario: Mitgliedschaft ist nur anonym sichtbar

- **WHEN** für eine Membership oder einen relevanten Darstellungskontext Anonymität konfiguriert ist
- **THEN** zeigen nachgelagerte Ansichten und Exporte nur die zulässige pseudonymisierte oder anonyme Repräsentation
- **AND** unberechtigte Klartextnennung bleibt ausgeschlossen

### Requirement: Delegierbare Administration im Organisationskontext

Das System SHALL delegierbare Administration innerhalb definierter Organisationsscopes unterstützen.

#### Scenario: Organisationsadministrator verwaltet nur eigenen Scope

- **WHEN** eine administrative Rolle für einen begrenzten Organisationsscope delegiert wurde
- **THEN** kann diese Identität nur Accounts, Memberships oder Inhalte innerhalb des freigegebenen Scopes verwalten
- **AND** Zugriffe außerhalb dieses Scopes werden abgewiesen
