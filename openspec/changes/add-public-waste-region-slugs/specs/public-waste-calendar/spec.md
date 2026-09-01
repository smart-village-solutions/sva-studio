## ADDED Requirements

### Requirement: Öffentliche Regionslinks verwenden lesbare Pfade

Das System SHALL für jede öffentlich auswählbare Region einen normalisierten Pfad-Slug aus dem Regionsnamen bereitstellen und diesen eindeutig auf die interne Regions-ID auflösen. Interne UUIDs SHALL für redaktionell veröffentlichte oder eingebettete Links nicht erforderlich sein.

#### Scenario: Lesbarer Regionspfad bindet den Kalender

- **WHEN** die öffentliche Web-App über einen eindeutig bekannten Regionspfad geöffnet wird
- **THEN** löst sie den Slug auf die interne Regions-ID auf
- **AND** beginnt die Standortauswahl direkt beim Ort innerhalb dieser Region
- **AND** behalten Kalender, PDF, iCal und Erinnerungen diese interne Regionsbindung bei

#### Scenario: Ungültiger oder doppeldeutiger Slug bleibt fail-closed

- **WHEN** der Regionspfad formal ungültig, unbekannt oder nicht eindeutig ist
- **THEN** zeigt die App einen verständlichen Fehlerzustand
- **AND** startet sie keine ungefilterte Standortauswahl

#### Scenario: Technischer UUID-Link bleibt kompatibel

- **WHEN** eine bestehende Einbindung weiterhin genau eine gültige `regionId` als Suchparameter verwendet
- **THEN** bleibt die bisherige regionsgebundene Auswahl funktionsfähig
