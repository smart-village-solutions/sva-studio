## ADDED Requirements

### Requirement: Redaktionelle Hörbeiträge

Das System SHALL berechtigten Redaktionen erlauben, Touren, Stationen, Nachrichten und Orten MP3-Hörbeiträge zuzuordnen.

#### Scenario: Quelle und Metadaten bleiben beim Inhalt

- **WHEN** eine berechtigte Person eine MP3 hochlädt, ein nutzbares MP3-Asset auswählt oder eine gültige direkte MP3-URL ergänzt
- **THEN** sind nach Speichern und erneutem Öffnen die Quelle, der Titel beziehungsweise die Bildunterschrift und die Urheberangabe dem gewählten Inhalt zugeordnet
- **AND** gibt der mobile Zielbuild das Audio mit dem vorhandenen Audioplayer wieder und behält das Verhalten bestehender Bilder und Inhalte ohne Audio bei

#### Scenario: Ein Audio-Save erhält weitere Nachrichtenblöcke

- **WHEN** eine Redaktion Audio im ersten bearbeitbaren Nachrichtenblock ändert
- **THEN** bleiben alle weiteren vorhandenen Inhaltsblöcke einschließlich ihrer Texte und Medien beim erneuten Öffnen erhalten

#### Scenario: Die Herkunft des Stationsaudios ist erkennbar

- **GIVEN** eine Station verweist auf einen lesbaren POI mit Audio
- **WHEN** eine Redaktion die Station öffnet
- **THEN** zeigt der Editor eigenes Stationsaudio und geerbtes POI-Audio als unterschiedliche Quellen
- **AND** schreibt das Ändern des Stationsaudios ausschließlich an die Station
