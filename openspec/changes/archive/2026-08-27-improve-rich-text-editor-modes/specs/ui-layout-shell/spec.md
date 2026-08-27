## ADDED Requirements

### Requirement: Gemeinsamer Rich-Text-Editor bietet WYSIWYG und HTML-Quelltext

Das Studio MUST für HTML-basierte Rich-Text-Felder einen gemeinsamen Editor bereitstellen, der zwischen visueller Bearbeitung und editierbarem HTML-Quelltext wechseln kann, ohne einen parallelen fachlichen Wert oder eine zweite Editor-Engine einzuführen.

#### Scenario: Redaktion wechselt verlustfrei in die HTML-Ansicht

- **GIVEN** ein Rich-Text-Feld enthält gültiges, vom Editor unterstütztes HTML
- **WHEN** der Benutzer von WYSIWYG zu HTML wechselt, den Quelltext bearbeitet und zurückwechselt
- **THEN** verwenden beide Ansichten denselben kontrollierten HTML-Wert
- **AND** bleiben unterstützte Inhalte und Formatierungen erhalten
- **AND** bleiben numerische Startwerte nummerierter Listen erhalten

#### Scenario: Nicht unterstütztes HTML wird beim visuellen Wechsel normalisiert

- **GIVEN** der Benutzer trägt in der HTML-Ansicht nicht unterstützte Tags oder Attribute ein
- **WHEN** er zurück in die WYSIWYG-Ansicht wechselt
- **THEN** normalisiert der Editor den Wert deterministisch nach seinem konfigurierten Schema
- **AND** übermittelt er den tatsächlich dargestellten normalisierten HTML-Wert über denselben Änderungsvertrag

#### Scenario: Moduswechsel ist barrierefrei bedienbar

- **WHEN** ein Benutzer den Editor mit Tastatur oder assistiver Technologie bedient
- **THEN** sind WYSIWYG- und HTML-Modus eindeutig benannt und als aktueller Modus erkennbar
- **AND** besitzen Editor beziehungsweise Quelltextfeld dieselben Beschriftungs-, Beschreibungs- und Fehlerbeziehungen

### Requirement: Gemeinsamer Rich-Text-Editor führt Formatierung auf echter Auswahl aus

Das Studio MUST Link- und Blockformatierungsbefehle des gemeinsamen Rich-Text-Editors über die TipTap-Command-API auf der aktuellen Editor-Auswahl ausführen.

#### Scenario: Markierter Text erhält einen Link

- **GIVEN** ein Benutzer hat Text im WYSIWYG-Modus markiert
- **WHEN** er eine gültige Link-URL übernimmt
- **THEN** wird genau die aktuelle Markierung als Link formatiert
- **AND** bleibt der übrige Inhalt unverändert

#### Scenario: Absatz wird als Überschrift formatiert

- **GIVEN** die aktuelle Auswahl liegt in einem Absatz
- **WHEN** der Benutzer eine unterstützte Überschriftenebene wählt
- **THEN** formatiert TipTap den betroffenen Block als diese Überschrift
- **AND** übermittelt der Editor den aktualisierten HTML-Wert

#### Scenario: Gemischte Formatierung wird entfernt

- **GIVEN** markierter Text enthält unterschiedliche Inline-Formatierungen
- **WHEN** der Benutzer die Aktion „Formatierung entfernen“ ausführt
- **THEN** entfernt TipTap die Markierungen aus der aktuellen Auswahl
- **AND** bleibt der Textinhalt erhalten
