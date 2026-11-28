## ADDED Requirements

### Requirement: Host schließt nicht mehr ausführbare Studio-Jobs ab

Der Host SHALL verwaiste Jobs unabhängig von UI-Anfragen anhand des persistenten Studio- und Queue-Zustands erkennen. Für belegbar nicht mehr ausführbare Jobs SHALL er einen endgültigen Status und genau ein zugehöriges Ereignis in der vorhandenen Jobhistorie speichern. Die Entscheidung SHALL gegen parallele Übernahme, laufende Ausführung und wiederholte Prüfung abgesichert sein.

#### Scenario: Die Queue hat alle Versuche verbraucht

- **GIVEN** ein laufend geführter Studio-Job hat einen abgelaufenen Heartbeat und keinen aktiven Worker
- **AND** der zugehörige Queue-Eintrag ist ungesperrt und hat sein Versuchslimit erreicht
- **WHEN** der Host denselben Zustand unter der abgesicherten Abschlussprüfung bestätigt
- **THEN** schreibt er einen endgültigen Jobstatus samt verständlichem Grund und genau einem Historienereignis
- **AND** der Job verschwindet aus der aktiven Ansicht

#### Scenario: Nach einer begonnenen Ausführung bleibt der Ausgang offen

- **GIVEN** der Job wurde begonnen und der Worker ist vor der Abschlussmeldung ausgefallen
- **AND** eine Abbruchanfrage wurde gespeichert
- **WHEN** der Host feststellt, dass der Job nicht mehr ausführbar ist
- **THEN** bleiben die Abbruchanfrage und der offene Ausgang der begonnenen Ausführung sichtbar
- **AND** der Host startet den Job nicht eigenständig neu

#### Scenario: Queue und Studio-Datensatz liefern keine sichere Grundlage

- **WHEN** ein Worker noch wirksam beansprucht oder die Queue-Beobachtung vorübergehend nicht verfügbar ist
- **THEN** lässt der Host den Jobstatus unverändert
- **AND** die Betriebsdiagnose unterscheidet unbekannten Queue-Zustand von einer gesunden Kontrolle

### Requirement: Betrieb kann verwaiste Jobs erkennen

Der Host SHALL ein aggregiertes Betriebssignal zu bestätigten verwaisten Jobs und zur Verfügbarkeit der Kontrolle bereitstellen. Anhaltende verwaiste Jobs oder eine ausbleibende Kontrolle SHALL über die bestehende Alarmierung sichtbar werden. Telemetrie-Labels SHALL keine Tenant-, Job- oder Nutzerdaten enthalten.

#### Scenario: Die Kontrolle ist ausgefallen

- **WHEN** die Statuskontrolle für das vereinbarte Beobachtungsfenster keine auswertbaren Signale liefert
- **THEN** erhält der Betrieb einen Alarm über den Beobachtungsausfall
- **AND** fehlende Messwerte werden nicht als Abwesenheit verwaister Jobs gewertet
