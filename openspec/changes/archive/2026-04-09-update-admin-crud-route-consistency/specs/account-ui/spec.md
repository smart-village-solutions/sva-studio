## MODIFIED Requirements
### Requirement: Admin-CRUD-Ressourcen nutzen kanonische Seitenrouten
Die Account-UI SHALL CRUD-artige Admin-Ressourcen über kanonische Listen-, Erstellungs- und Detailrouten bereitstellen.

#### Scenario: Listenansicht einer Admin-Ressource
- **WHEN** ein berechtigter Nutzer eine CRUD-artige Admin-Ressource öffnet
- **THEN** die Liste ist unter `/admin/<resource>` erreichbar
- **AND** die Liste zeigt tabellarische Einträge, Filter und Listenaktionen
- **AND** Create- und Edit-Flows werden nicht als Modal über lokalen Seitenspeicher geöffnet

#### Scenario: Erstellungsansicht einer Admin-Ressource
- **WHEN** ein berechtigter Nutzer eine neue Ressource anlegen will
- **THEN** die UI navigiert auf `/admin/<resource>/new`
- **AND** die Erstellungsmaske wird als eigenständige Seite mit Rücklink zur Liste angezeigt

#### Scenario: Detailansicht einer Admin-Ressource
- **WHEN** ein berechtigter Nutzer einen bestehenden Eintrag öffnen oder bearbeiten will
- **THEN** die UI navigiert auf `/admin/<resource>/$id`
- **AND** Bearbeitung und ressourcenspezifische Sekundäraktionen erfolgen auf dieser Detailseite
