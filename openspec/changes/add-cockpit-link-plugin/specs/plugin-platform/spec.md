## ADDED Requirements

### Requirement: Externe Plugin-Navigation

Das System SHALL einem aktivierten Plugin erlauben, einen externen HTTPS-Link als Navigationsbeitrag zu deklarieren, und SHALL Navigationsbeiträge ohne eindeutiges Ziel oder mit unsicherem externem Ziel zurückweisen.

#### Scenario: Cockpit-Link aus aktiviertem Plugin

- **GIVEN** das Cockpit-Plugin ist im Studio-Katalog aktiviert und das optionale Cockpit-Modul ist der Instanz zugewiesen
- **WHEN** ein Benutzer die bestehenden Cockpit-, Experimental- und Branding-Bedingungen erfüllt
- **THEN** erscheint in der Sidebar der vom Plugin deklarierte Cockpit-Link zum bisherigen HTTPS-Ziel
- **AND** der Link öffnet sich wie bisher in einem neuen Tab

#### Scenario: Plugin deaktiviert oder Zugriff fehlt

- **GIVEN** das Cockpit-Modul ist der Instanz nicht zugewiesen oder eine der bestehenden Sichtbarkeitsbedingungen fehlt
- **WHEN** die Sidebar erstellt wird
- **THEN** erscheint kein Cockpit-Link

#### Scenario: Ungültiges externes Ziel

- **WHEN** ein Plugin einen Navigationsbeitrag mit einem Nicht-HTTPS-Ziel oder mehreren Zielen registriert
- **THEN** lehnt die Plugin-Registry diesen Beitrag ab
