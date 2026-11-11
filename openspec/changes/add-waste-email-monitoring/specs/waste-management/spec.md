## ADDED Requirements

### Requirement: Plugin-eigene E-Mail-Auswertung im Monitoring

Das Abfallkalender-Plugin SHALL im Studio unter Monitoring eine rein lesende, paginierte Übersicht der E-Mail-Abos und ihrer gespeicherten Versandstände anbieten.

#### Scenario: Gesonderter Zugriff

- **WHEN** ein Benutzer das Recht `waste-management.email-reminder-monitoring.read` für die aktive Instanz besitzt
- **THEN** sind Navigation, Plugin-Ansicht und Lese-API zugänglich
- **AND** allgemeine Monitoring- oder Waste-Leserechte allein erlauben diesen Zugriff nicht
- **AND** die Abfrage verwendet ausschließlich die authentifizierte Instanz

#### Scenario: Maskierte Empfänger und Versanddiagnose

- **WHEN** ein berechtigter Benutzer die Übersicht öffnet und ein Abo auswählt
- **THEN** erhält er eine stabile Abo-Kennung, die maskierte E-Mail-Adresse, Status, Ort, abonnierte Fraktionen/Slots sowie Anmelde-, Aktivierungs- und Abmeldezeitpunkte
- **AND** die Versanddetails zeigen Bestätigung/Erinnerung, Status, verfügbare Planungs-/Verarbeitungszeiten, Versuchszähler, Fraktion, Abholtermin und eine bereinigte Fehlerkategorie
- **AND** die API überträgt keine vollständigen Empfängeradressen, Straßen/Hausnummern, Token, Hashes, Mail-Payloads oder freien Provider-Fehlertexte
- **AND** der erste und letzte Buchstabe jedes Adressteils bleiben sichtbar, während die übrigen Zeichen maskiert werden; Teile mit höchstens zwei Zeichen werden vollständig maskiert
- **AND** die Ansicht erläutert, dass Provider-Übergabe und Postfachempfang unterschiedliche Zustände sind
