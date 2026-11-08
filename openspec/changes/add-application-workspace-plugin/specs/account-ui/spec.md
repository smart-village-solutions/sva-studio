## ADDED Requirements

### Requirement: Instanzgebundene Plugin-Einstellungen in der Modulübersicht

Die Tenant-Modulübersicht SHALL für aktive Plugins mit validiertem Einstellungsbeitrag einen Einstieg „Plugin-Einstellungen“ anbieten, wenn die aktuellen effektiven Rechte den Zugriff auf die Einstellungsroute erlauben. Ein Benutzer mit `application-workspace.settings.read` MUST den entsprechenden Moduleinstieg ohne zusätzliche pauschale Adminrolle erreichen können. Dies MUST die Root-only-Modulzuweisung nicht erweitern. Direkte Routen und Mutationen MUST unabhängig vom sichtbaren Einstieg serverseitig geschützt bleiben.

#### Scenario: Benutzer mit Einstellungsleserecht

- **GIVEN** das Plugin ist aktiv und der Benutzer besitzt `application-workspace.settings.read`
- **WHEN** er die Tenant-Modulübersicht öffnet
- **THEN** erreicht er darüber die Plugin-Einstellungsseite
- **AND** sind ohne zusätzliches Update-Recht keine ausführbaren Änderungsaktionen verfügbar
- **AND** erhält er dadurch keine Aktion zur Modulzuweisung oder zum Modulentzug

#### Scenario: Fehlendes Einstellungsrecht

- **WHEN** ein Benutzer ohne passendes Einstellungsleserecht die Modulübersicht oder die Einstellungsroute aufruft
- **THEN** steht ihm kein nutzbarer Einstellungseinstieg zur Verfügung
- **AND** verweigert der direkte Einstellungszugriff die Freigabe
- **AND** bleibt bei aktiver Modulzuweisung sein Zugriff auf die allgemeine Anwendungsübersicht bestehen

#### Scenario: Bearbeitungsarbeitsplatz

- **GIVEN** der Benutzer besitzt beide Einstellungsrechte
- **WHEN** er Kacheln oder deren Sprachtexte pflegt
- **THEN** stehen beschriftete Felder, feldbezogene Fehler, per Tastatur bedienbares Sortieren und bestätigtes Löschen bereit
- **AND** sind die unveränderliche Studio-Kachel sowie fehlende Übersetzungen und deren Fallback erkennbar

#### Scenario: Root-Modulverwaltung bleibt abgegrenzt

- **WHEN** ein Studio-Admin die Root-Sammelansicht der Module verwendet
- **THEN** bleibt deren bestehender Zuweisungs- und Entzugspfad unverändert
- **AND** entsteht dort kein zweiter tenantübergreifender Editor für Kachelkonfiguration
