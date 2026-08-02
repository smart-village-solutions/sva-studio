## ADDED Requirements

### Requirement: Event-Editor fokussiert redaktionell benötigte Felder

Das System MUST den Event-Editor auf die redaktionell benötigten Felder begrenzen. Die optionale POI-Verknüpfung, Barrierefreiheitsdaten, Schlagwörter und Tags MUST im Event-Editor ausgeblendet sein, ohne die zugehörigen Mainserver-Verträge zu entfernen.

#### Scenario: Event wird ohne unnötige Zusatzfelder bearbeitet

- **WENN** ein Redakteur ein Event erstellt oder bearbeitet
- **DANN** zeigt der Editor keine POI-Verknüpfung, Barrierefreiheitsdaten, Schlagwörter oder Tags
- **UND** der Editor lädt keine POI-Auswahlliste

#### Scenario: Bestehende ausgeblendete Event-Daten bleiben erhalten

- **GEGEBEN** ein bestehendes Event enthält eine POI-Verknüpfung, Barrierefreiheitsdaten, Schlagwörter oder Tags
- **WENN** ein Redakteur ein weiterhin sichtbares Feld ändert und das Event speichert
- **DANN** überträgt das System die bestehenden ausgeblendeten Werte unverändert an den Mainserver

### Requirement: Deutsche Inhaltsbegriffe sind redaktionell verständlich

Das System MUST in sichtbaren deutschen Produkttexten die Begriffe `Nachrichten`, `Veranstaltungen` und `Generische Inhalte` verwenden. Redaktionelle Haupttextfelder MUST als `Überschrift` und kurze einleitende Texte als `Einleitung` bezeichnet werden.

#### Scenario: Redaktion öffnet die Inhaltsverwaltung auf Deutsch

- **WENN** ein Redakteur Navigation, Listen oder Editoren für Nachrichten, Veranstaltungen oder generische Inhalte öffnet
- **DANN** verwendet das System die festgelegten deutschen Inhaltsbegriffe
- **UND** es zeigt für redaktionelle Felder weder `News`, `Events`, `Generic Items`, `Title`, `Headline`, `Titel`, `Teaser` noch `Intro` an

#### Scenario: Technische Verträge bleiben stabil

- **WENN** die sichtbaren deutschen Bezeichnungen geändert werden
- **DANN** bleiben API-Feldnamen, Routen, TypeScript-Symbole und englische Übersetzungen unverändert

## MODIFIED Requirements

### Requirement: Erweiterte POI-Daten bleiben aus dem Hauptflow herausgezogen

Das System MUST technische oder nicht benötigte POI-Zusatzdaten aus der redaktionellen Oberfläche ausblenden. Schlagwörter, Tags, Zertifikate, Accessibility-Daten und freie Payload-Bearbeitung MUST weiterhin im internen Formular- und Mainserver-Mapping erhalten bleiben, dürfen aber nicht redaktionell bearbeitbar sein.

#### Scenario: POI-Einstellungen zeigen nur die technische Kennung

- **WENN** ein Redakteur die Einstellungen eines POI öffnet
- **DANN** zeigt das System die externe ID als technische Metadaten
- **UND** es zeigt keine Schlagwörter, Tags, Zertifikate, Accessibility-Daten oder freie Payload-Bearbeitung

#### Scenario: Bestehende ausgeblendete POI-Daten bleiben erhalten

- **GEGEBEN** ein bestehender POI enthält Schlagwörter, Tags, Zertifikate, Accessibility-Daten oder Payload-Daten
- **WENN** ein Redakteur ein weiterhin sichtbares Feld ändert und den POI speichert
- **DANN** überträgt das System die bestehenden ausgeblendeten Werte unverändert an den Mainserver
