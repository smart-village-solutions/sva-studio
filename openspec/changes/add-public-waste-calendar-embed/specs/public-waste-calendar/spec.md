## ADDED Requirements

### Requirement: Direkte Einbettung ohne iframe
Das System SHALL die bestehende öffentliche Kalender-UI über einen div-Container und einen JavaScript-Moduleinstieg ohne iframe bereitstellen. Jede Instanz SHALL eine eigene Regionsbindung und API-Adresse erhalten; die Host-URL SHALL unverändert bleiben.

#### Scenario: Integration in externe Webseite
- **WHEN** eine externe Webseite den Moduleinstieg mit konfiguriertem Container lädt
- **THEN** rendert die bestehende UI im offenen Shadow DOM des Containers
- **AND** Styles und ARIA-IDs bleiben auf diese Instanz begrenzt
- **AND** API-Fetches und Exportlinks verwenden die Kalender-Origin
- **AND** API-Fetches senden keine Credentials an diese Origin

#### Scenario: Barrierefreie eingebettete Bedienung
- **WHEN** eine Person den eingebetteten Kalender per Tastatur bedient
- **THEN** funktionieren Auswahl, Kalendernavigation und Dialogfokus einschließlich Fokusrückgabe innerhalb der bestehenden UI
- **AND** Statusmeldungen und ARIA-Beziehungen bleiben zugänglich

### Requirement: Öffentliche Cross-Origin-Antworten
Das System SHALL bekannte öffentliche Kalender-API-Endpunkte und Browser-Assets für externe Webseiten per CORS ohne Credential-Freigabe erreichbar machen. Bestätigungs- und Abmeldeseiten SHALL keine CORS-Freigabe erhalten.

#### Scenario: Öffentliche API und PDF
- **WHEN** die externe Webseite Kalenderdaten, PDF oder eine Erinnerungsanmeldung anfragt
- **THEN** erhält sie die vorhandene Antwort mit CORS-Freigabe und für PDF lesbarem Content-Disposition-Header
- **AND** bestehende serverseitige Validierung und Rate Limits bleiben wirksam

#### Scenario: Preflight
- **WHEN** ein OPTIONS-Request an einen bekannten öffentlichen API-Endpunkt gestellt wird
- **THEN** werden nur dessen unterstützte Methode und Content-Type freigegeben
