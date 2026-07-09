## MODIFIED Requirements
### Requirement: User-Bearbeitungsseite

Das System MUST eine User-Bearbeitungsseite unter `/admin/users/:userId` bereitstellen, die eine detaillierte Bearbeitung eines Benutzer-Accounts in einer Tab-Ansicht ermoeglicht und direkte, gruppenbasierte sowie vererbte Berechtigungsursachen nachvollziehbar darstellt.

#### Scenario: Verwaltung zeigt nachvollziehbare Berechtigungsherkunft

- **WENN** ein Administrator den Benutzer-Detailbereich mit Rollen- und Rechteinformationen oeffnet
- **DANN** zeigt die UI direkte Rollen, Gruppenherkuenfte und effektive Berechtigungen in lesbarer Form an
- **UND** markiert sie sichtbar, ob ein Eintrag instanzweit, datensatzbezogen oder organisationskontextbezogen ausgewertet wird
- **UND** bleibt erkennbar, ob ein Eintrag direkt zugewiesen, ueber eine Gruppe wirksam oder ueber Organisations- bzw. Geo-Hierarchien vererbt ist
- **UND** bleiben blockierte oder fachlich unwirksame Eintraege als solche erkennbar statt still ausgeblendet zu werden

#### Scenario: Benutzerbearbeitung loescht fachlich unveraenderte Assignment-Metadaten nicht

- **WENN** ein Administrator einen Benutzer speichert, ohne eine bestehende Rollen- oder Gruppenzuordnung fachlich zu aendern
- **DANN** bleiben vorhandene Metadaten wie Herkunft und Gueltigkeitsfenster erhalten
- **UND** erstellt die UI keinen Bedienfluss, der diese Metadaten implizit zuruecksetzt, nur weil derselbe Benutzer erneut gespeichert wurde

#### Scenario: User-Detailseite zeigt Organisationsmitgliedschaften im eigenen Tab

- **WENN** ein Administrator `/admin/users/:userId` oeffnet
- **DANN** enthaelt die Tab-Navigation einen Tab `Organisationen`
- **UND** zeigt dieser Tab alle bestehenden Organisationsmitgliedschaften des Benutzers mit Organisationsname, Membership-Sichtbarkeit, Default-Kontext-Markierung und Erstellzeitpunkt
- **UND** sind die angezeigten Organisationsdaten aus demselben IAM-Read-Model abgeleitet wie die Organisationsverwaltung

#### Scenario: Administrator weist aus der User-Detailseite weitere Organisationen zu

- **WENN** ein Administrator im Tab `Organisationen` eine weitere Organisation zuweist
- **DANN** erfolgt die Auswahl ueber eine suchbare Liste noch nicht zugewiesener Organisationen derselben Instanz
- **UND** kann der Administrator beim Zuweisen `visibility` und `isDefaultContext` festlegen
- **UND** wird die neue Organisationsmitgliedschaft ohne Seitenwechsel in der Membership-Liste sichtbar

#### Scenario: Administrator pflegt Membership-Attribute direkt im User-Kontext

- **WENN** ein Administrator im Tab `Organisationen` eine bestehende Organisationsmitgliedschaft bearbeitet
- **DANN** kann er `visibility` und `isDefaultContext` direkt fuer diese Membership aktualisieren
- **UND** wird eine Default-Kontext-Aenderung fachlich konsistent gespeichert, ohne parallele Default-Markierungen fuer denselben Account zu hinterlassen

#### Scenario: Administrator entfernt Organisationsmitgliedschaften direkt im User-Kontext

- **WENN** ein Administrator im Tab `Organisationen` eine bestehende Organisationsmitgliedschaft entfernt
- **DANN** wird die Membership aus dem Benutzerkontext geloescht
- **UND** aktualisiert die UI die Liste ohne Seitenwechsel
- **UND** bleibt ein fachlich gueltiger Default-Kontext fuer den Account erhalten oder wird regelkonform neu bestimmt
