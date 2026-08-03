## ADDED Requirements

### Requirement: Formularweite Speichern-Aktion am Anfang und Ende von Inhaltseditoren

Das System SHALL in tab-basierten Inhaltseditoren die formularweite Speichern- beziehungsweise Anlegen-Aktion sowohl im Seitenkopf als auch direkt unterhalb der Editor-Tabs anbieten. Beide Aktionen SHALL denselben Submit-Pfad, dieselbe Beschriftung sowie dieselben Lade-, Disabled- und Berechtigungszustände verwenden.

#### Scenario: Redaktion speichert am Ende eines langen Editor-Tabs

- **GIVEN** eine berechtigte Person bearbeitet News, Events, FAQs, POIs, Umfragen, generische Inhalte oder einen Kern-Inhalt
- **WHEN** sie die Aktion unterhalb der Tabs auslöst
- **THEN** speichert das System das gesamte Formular über denselben Pfad wie die Aktion im Seitenkopf
- **AND** es wird kein tab-spezifischer Speichervorgang erzeugt

#### Scenario: Speichern bleibt im Historien-Tab erreichbar

- **GIVEN** ein Inhaltseditor besitzt einen schreibgeschützten Historien-Tab
- **WHEN** die Person diesen Tab öffnet
- **THEN** bleiben die formularweiten Speichern-Aktionen im Seitenkopf und unterhalb der Tabs sichtbar
- **AND** zuvor vorgenommene Änderungen aus anderen Tabs können weiterhin gespeichert werden

#### Scenario: Speichern ist nicht erlaubt oder läuft bereits

- **GIVEN** die formularweite Speichern-Aktion ist durch Berechtigungen, Validierungszustand oder einen laufenden Submit deaktiviert
- **WHEN** der Editor beide Aktionspositionen rendert
- **THEN** spiegeln beide Positionen denselben Disabled- und Ladezustand wider
