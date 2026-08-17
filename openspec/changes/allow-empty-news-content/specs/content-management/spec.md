## ADDED Requirements

### Requirement: News Content Is Optional

Das System MUST Nachrichten ohne redaktionellen Inhalt speichern können. `contentBlocks` MUST fehlen, `null`, leer oder ohne sichtbaren Body-Text sein dürfen. Wenn Inhaltsblöcke übermittelt werden, MUST das System deren Struktur, Medien-URLs und Längengrenzen weiterhin validieren.

#### Scenario: Nachricht ohne Inhaltsblöcke wird gespeichert

- **WENN** ein berechtigter Benutzer eine ansonsten gültige Nachricht ohne `contentBlocks` speichert
- **DANN** akzeptiert die serverseitige News-Route die Nachricht
- **UND** sendet keinen synthetischen Inhalt an den Mainserver

#### Scenario: Nachricht mit leerem Inhalt wird gespeichert

- **WENN** ein berechtigter Benutzer eine ansonsten gültige Nachricht mit `contentBlocks: []` oder einem Inhaltsblock ohne sichtbaren Body-Text speichert
- **DANN** akzeptiert die serverseitige News-Route die Nachricht
- **UND** erhält die ausdrücklich übermittelte Inhaltsstruktur

#### Scenario: Übermittelter Nachrichteninhalt bleibt geschützt

- **WENN** eine Nachricht fehlerhaft strukturierte Inhaltsblöcke, unsichere Medien-URLs oder einen Body oberhalb der Längengrenze enthält
- **DANN** lehnt die serverseitige News-Route die Nachricht vor dem GraphQL-Aufruf ab
