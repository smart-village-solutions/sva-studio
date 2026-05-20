## MODIFIED Requirements
### Requirement: Waste-Management umfasst kontrollierte Data-Tools

Das System SHALL CSV-Import, Seed und Reset als kontrollierte Data-Tools im Waste-Management-Modul bereitstellen.

#### Scenario: CSV-Import meldet echten Laufzeitfortschritt für laufende Spezialimporte
- **WHEN** ein Benutzer den Waste-Spezialimport für Tourzuordnungen nach Fraktionen startet
- **THEN** veröffentlicht das System während des laufenden Commit-Pfads einen echten Fortschritt mit verarbeiteten und insgesamt zu verarbeitenden gültigen Zeilen
- **AND** der Fortschritt enthält fachliche Phasen wie Vorbereitung, Importlauf und Abschluss
- **AND** fehlerhafte Zeilen aus der Vorvalidierung erhöhen nicht die Laufzeit-Gesamtmenge des Commit-Pfads

#### Scenario: Laufender Import zeigt Prozentwert und Zeilenbezug
- **WHEN** ein laufender Waste-Import im Datentools-Bereich angezeigt wird
- **THEN** sieht der Benutzer einen Fortschrittsbalken mit Prozentwert
- **AND** die Anzeige nennt mindestens die aktuelle Phase sowie `verarbeitete Zeilen / Gesamtzeilen`
- **AND** die Darstellung bleibt auf den aktuell laufenden Import fokussiert und überlädt nicht die Historienansicht

#### Scenario: Fortschrittsmeldungen bleiben technisch kontrolliert
- **WHEN** der Waste-Import viele gültige CSV-Zeilen verarbeitet
- **THEN** persistiert das System Fortschrittsmeldungen blockweise statt zwingend für jede einzelne Zeile
- **AND** die gewählte Strategie hält Jobdetail und UI fachlich aussagekräftig, ohne die Event-Persistenz unverhältnismäßig zu vergrößern
