## ADDED Requirements

### Requirement: Waste-Monitoring sucht aktive E-Mail-Abos exakt und datensparsam

Das System SHALL berechtigten Nutzern erlauben, ausschließlich aktive E-Mail-Abos der authentifizierten Instanz mit einer vollständig eingegebenen Empfängeradresse zu finden.

#### Scenario: Vollständige Adresse findet aktive Abos

- **WHEN** ein berechtigter Benutzer eine vollständige Adresse im Body der geschützten Suche eingibt
- **THEN** verwendet das System dieselbe Normalisierung und Hashbildung wie bei der Anmeldung
- **AND** verwendet das System denselben Filter für maskierte Treffer und gefilterte Trefferzahl
- **AND** bleibt die mandantenweite Gesamtzahl aktiver Abos unabhängig von der Suche

#### Scenario: Pending, beendete und fremde Abos bleiben außerhalb der Adresssuche

- **WHEN** ein berechtigter Benutzer nach einer Adresse mit Pending-, beendeten oder in anderen Instanzen gespeicherten Abos sucht
- **THEN** liefert die Adresssuche diese Abos nicht als Treffer
- **AND** kann ein Pending-Abo nach erfolgreicher Bestätigung als aktiver Treffer erscheinen

#### Scenario: Suchanfrage und Antwort schützen die Adresse

- **WHEN** die Suche aufgerufen wird
- **THEN** verwendet sie das bestehende Monitoring-Recht der aktiven Instanz und den Schutz für schreibende HTTP-Methoden
- **AND** weist sie unvollständige Adressen zurück
- **AND** enthält die Antwort nur maskierte Empfänger und `Cache-Control: no-store`
- **AND** erscheinen Klartextadresse und Adresshash weder in URL, Antwort, Logs, Telemetrie noch persistent im Browser
