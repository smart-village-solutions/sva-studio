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

#### Scenario: Versandstatus der Bestätigungsmail bleibt bei späteren Erinnerungen sichtbar

- **WHEN** ein berechtigter Benutzer ein Abo mit gespeichertem Double-Opt-in-Auftrag betrachtet
- **THEN** zeigt die Übersicht den Status dieses Auftrags unabhängig vom Zeitpunkt späterer Erinnerungen
- **AND** bezeichnet die Ansicht den gespeicherten Status `sent` als „Vom Versanddienst angenommen“
- **AND** leitet die Ansicht aus der Annahme keine Zustellung im Postfach ab

#### Scenario: Kennzahl für aktive E-Mail-Abos

- **WHEN** ein berechtigter Benutzer die Übersicht öffnet, filtert oder durch ihre Seiten blättert
- **THEN** zeigt eine Kennzahl oberhalb der Tabelle die Zahl der aktiven Abos des Mandanten
- **AND** stehen ausstehende, abgelaufene und beendete Abos nicht in dieser Kennzahl
- **AND** verwendet die Seitennavigation weiterhin die Anzahl der zur Auswahl passenden Abos
