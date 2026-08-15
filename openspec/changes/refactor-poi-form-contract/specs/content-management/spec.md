## ADDED Requirements

### Requirement: POI-Formtransformationen erhalten den bestehenden Datenvertrag

Das System SHALL beim verhaltensgleichen Refactoring der POI-Formtransformationen die bestehende Übersetzung zwischen Mainserver-Inhalten und Editorformular vollständig erhalten.

#### Scenario: Bestehender POI wird in Formularwerte gemappt

- **GIVEN** ein POI mit vollständigen, partiellen oder Legacy-Feldern
- **WHEN** der Inhalt in POI-Formularwerte übersetzt wird
- **THEN** bleiben Defaults, Kategorienpriorität, Aktivstatus, Listenreihenfolge und Wochentagsnormalisierung unverändert
- **AND** bleiben nichtendliche Numerik, Payload-Runtime-Shapes und bestehendes Clone- beziehungsweise Referenzverhalten charakterisiert

#### Scenario: Bearbeitete Formularwerte werden serialisiert

- **GIVEN** POI-Formularwerte mit vollständigen, leeren, partiellen oder ungültigen Runtime-Feldern
- **WHEN** daraus der Mainserver-Mutationsinput erzeugt wird
- **THEN** bleiben Trimming, explizite Leerungen, Deduplikation, Filter, Fallbacks und Listenreihenfolge unverändert
- **AND** werden falsche numerische Runtime-Werte weiterhin für die nachgelagerte Validierung erkennbar erhalten

#### Scenario: Refactoring verändert keine angrenzenden Verträge

- **GIVEN** die POI-Formtransformationen werden vereinfacht
- **WHEN** die Änderung abgeschlossen wird
- **THEN** bleiben öffentliche POI-Typen, Mainserver-Vertrag, Validierung und Editor-UI unverändert
- **AND** entsteht keine neue Cross-Plugin- oder Shared-Package-Ownership-Grenze
