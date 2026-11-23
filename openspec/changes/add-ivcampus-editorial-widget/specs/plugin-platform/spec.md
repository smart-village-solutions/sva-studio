## ADDED Requirements

### Requirement: ivCampus-Pilot für Studio-Redaktionsaufgaben

Studio SHALL für die Staging-Sandbox ein optionales ivCampus-Modul mit
kopierbarer Widget-Adresse in den Moduleinstellungen bereitstellen. Das Widget
SHALL nur bei wirksamer Modulzuweisung und konfigurierter HTTPS-Origin
ausgeliefert werden. Nur die konfigurierte Origin darf das Widget einbetten.

#### Scenario: Widget im ivCampus-Teamraum verwenden

- **GIVEN** das Modul ist der Staging-Sandbox zugewiesen und die Campus-Origin ist konfiguriert
- **WHEN** der ivCampus-Host das Widget lädt und den Handshake abschließt
- **THEN** können Mitarbeitende die Studio-Formulare für eine neue Meldung oder Veranstaltung in einem eigenen Tab öffnen
- **AND** Studio prüft in diesem Tab die regulären Berechtigungen

#### Scenario: Widget außerhalb des Piloten anfragen

- **GIVEN** die Anfrage betrifft einen anderen Studio-Host, das Modul ist inaktiv oder die Campus-Origin fehlt
- **WHEN** der Widget-Pfad angefragt wird
- **THEN** liefert Studio keine Widget-Seite aus
