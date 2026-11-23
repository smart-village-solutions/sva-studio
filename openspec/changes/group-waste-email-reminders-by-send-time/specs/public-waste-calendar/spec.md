## RENAMED Requirements

- FROM: `### Requirement: Erinnerungsversand berücksichtigt Fraktion und Slot als eigenständige Versandereignisse`
- TO: `### Requirement: Erinnerungsversand bündelt Abholungen eines Abos bei übereinstimmendem Versandzeitpunkt`

## MODIFIED Requirements

### Requirement: Erinnerungsversand bündelt Abholungen eines Abos bei übereinstimmendem Versandzeitpunkt

Das System SHALL E-Mail-Erinnerungen pro Abo, wirksamem Abholdatum und ursprünglich berechnetem Versandzeitpunkt bündeln. Die Berechnung dieses Zeitpunkts berücksichtigt weiterhin die jeweils gewählten Fraktionen und Slots.

#### Scenario: Ein Tag und ein Versandzeitpunkt erzeugen eine Nachricht

- **WHEN** mehrere Abholungen desselben Abos am selben wirksamen Abholdatum denselben berechneten Versandzeitpunkt haben
- **THEN** entsteht eine Erinnerung mit allen zu diesem Zeitpunkt gehörenden Fraktionen und Hinweisen
- **AND** enthält die Nachricht einen Abmeldelink für das Abo

#### Scenario: Unterschiedlicher Versandzeitpunkt oder unterschiedliches Abholdatum

- **WHEN** Abholungen unterschiedliche Versandzeitpunkte oder unterschiedliche wirksame Abholdaten haben
- **THEN** entstehen getrennte Erinnerungen für die jeweiligen Gruppen
- **AND** eine Verschiebung wird anhand des wirksamen Abholdatums berücksichtigt

#### Scenario: Bereits bekannte Mitglieder werden beim Übergang berücksichtigt

- **WHEN** eine Erinnerung erneut materialisiert oder ein Einzelauftrag auf das Gruppenformat umgestellt wird
- **THEN** behält der Abgleich die fachliche Identität jedes Mitglieds
- **AND** bestellt er bereits versandte oder mit ungeklärtem Ausgang übergebene Mitglieder nicht automatisch erneut
- **AND** wird ein sicher wartender Altauftrag atomar mit der Nachfolgegruppe abgestimmt

#### Scenario: Die Fachplanung ändert sich nach begonnener Übergabe

- **WHEN** nach Beginn der Übergabe weitere Abholungen für dieselbe Gruppe bekannt werden
- **THEN** bleibt der Inhalt des bereits beanspruchten Versandauftrags unverändert
- **AND** entsteht dadurch keine automatische zweite Nachricht für dieselbe Gruppe

#### Scenario: Ein Versandversuch wird wiederholt

- **WHEN** ein Auftrag wegen eines vor der Übergabe erkannten Transportausfalls erneut versucht wird
- **THEN** berücksichtigt die Neuplanung zwischenzeitliche Kalender- und Transportänderungen und erhält Retry-Frist sowie Versuchszähler
- **AND** prüft der Dispatcher vor der Übergabe den aktuellen Abozustand
- **AND** verhindert ein inzwischen widerrufenes Abo einen neuen Übergabeversuch
- **AND** ist ein ungeklärter Ausgang im Monitoring erkennbar und führt nicht allein wegen eines abgelaufenen Claims zu einer erneuten Übergabe
