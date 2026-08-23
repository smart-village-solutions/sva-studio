## ADDED Requirements

### Requirement: Benutzerverwaltung kann technische Accounts bearbeiten und filtern

Die Account-UI SHALL die technische Account-Klassifikation in Erstellung und Detailbearbeitung anbieten. Die Benutzerliste SHALL technische Accounts standardmäßig ausblenden und eine explizite Filteroption „Auch technische Accounts anzeigen“ anbieten. Filterung und Pagination SHALL auf demselben serverseitigen Sichtbarkeitsvertrag beruhen.

#### Scenario: Accountliste startet ohne technische Accounts

- **WHEN** ein berechtigter Administrator die Accountliste ohne expliziten technischen Filter öffnet
- **THEN** sendet die UI `includeTechnicalAccounts = false` oder verlässt sich auf den gleichwertigen Serverstandard
- **AND** enthält die Liste keine Accounts mit `isTechnicalAccount = true`
- **AND** entsprechen Gesamtzahl und Seitenanzahl der sichtbaren Treffermenge

#### Scenario: Administrator blendet technische Accounts ein

- **WHEN** der Administrator „Auch technische Accounts anzeigen“ aktiviert
- **THEN** lädt die UI die Liste mit `includeTechnicalAccounts = true` neu
- **AND** setzt sie die aktuelle Seite auf 1 zurück
- **AND** kennzeichnet technische Accounts mit einem lokalisierten Badge
- **AND** bleiben Suche, Status- und Rollenfilter kombinierbar

#### Scenario: Administrator bearbeitet die technische Eigenschaft

- **WHEN** ein zur Account-Bearbeitung berechtigter Administrator die Account-Erstellung oder Account-Detailseite öffnet
- **THEN** bietet die UI das boolesche Feld „Ist ein technischer Account“ an
- **AND** erläutert sie, dass das Merkmal den Account von Kontolöschungsregeln ausnimmt
- **AND** behauptet sie keine automatische Sperrung von Login, Rollen oder anderen Accountfunktionen

#### Scenario: Technisches Flag verändert Accountaktionen nicht automatisch

- **WHEN** ein technischer Account in der eingeblendeten Liste oder im Detail angezeigt wird
- **THEN** richten sich vorhandene Aktionen weiterhin nach ihren bestehenden Permissions und Accountzuständen
- **AND** sperrt oder aktiviert die UI keine Aktion allein aufgrund von `isTechnicalAccount`

#### Scenario: Entfernen des Flags warnt vor erneuter Lifecycle-Teilnahme

- **GIVEN** ein Account ist aktuell als technisch klassifiziert
- **WHEN** ein Administrator das Flag im Accountdetail entfernt
- **THEN** weist die UI verständlich darauf hin, dass der Account ab dem nächsten Lauf wieder den unveränderten Inaktivitätsregeln unterliegt
- **AND** behauptet sie weder eine sofortige Reaktivierung noch eine automatische Änderung anderer Accountmerkmale
