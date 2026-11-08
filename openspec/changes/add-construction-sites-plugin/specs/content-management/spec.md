## ADDED Requirements

### Requirement: Baustellen besitzen eine fachliche Übersicht

Das System MUST autorisierten Redakteuren eine Baustellenübersicht für den exakten Mainserver-Typ `ConstructionSite` mit Titel, primärem Standort, Beginn, Ende, zeitlicher Einordnung und letzter Änderung bereitstellen. Suche, Kategorienfilter, Zeitraumüberlappung und Pagination MUST auf dem gesamten autorisierten fachlichen Bestand wirken. Ausgeblendete lesbare Baustellen MUST bearbeitbar auffindbar bleiben.

#### Scenario: Fachliche Filter wirken über Seitengrenzen

- **GIVEN** passende Baustellen liegen hinter einer Upstream-Seite ohne passende Datensätze
- **WHEN** ein berechtigter Redakteur nach Titel, Kategorie oder Zeitraum filtert
- **THEN** liefert die Übersicht passende Datensätze entsprechend dem bestehenden Pagination-Vertrag
- **AND** beendet eine herausgefilterte Seite den Scan nicht vorzeitig
- **AND** enthält die fachliche Liste keine anderen GenericItem-Typen

#### Scenario: Zeitliche Einordnung verändert keinen Inhalt

- **GIVEN** eine Baustelle besitzt einen gültigen primären Zeitraum
- **WHEN** die Übersicht sie an einem Kalendertag vor, innerhalb oder nach dem Zeitraum anzeigt
- **THEN** kennzeichnet sie den Eintrag als geplant, laufend oder beendet, wobei Beginn und Ende eingeschlossen sind
- **AND** verändert sie weder Sichtbarkeit noch Status oder gespeicherte Daten

#### Scenario: Unvollständiger Altzeitraum bleibt erkennbar

- **GIVEN** der primäre Zeitraum fehlt, ist ungültig oder endet vor seinem Beginn
- **WHEN** die Übersicht geladen wird
- **THEN** zeigt sie „Zeitraum unvollständig“ statt einer erfundenen zeitlichen Einordnung

### Requirement: Baustellen werden mit einem kompatiblen Fachformular angelegt und bearbeitet

Das System MUST Titel, weitere Informationen, Beginn/Ende, Richtung, Grund, mehrere Freitext-Einschränkungen, Standort, Kategorien und Dateien über ein Fachformular erfassen. Die Erstellung MUST ein Onepager sein; die Bearbeitung MUST dieselben Feldkomponenten und eine funktionale Host-Historie verwenden. Typangabe und Payload MUST kein frei zu bearbeitendes technisches Hauptformular bilden.

#### Scenario: Neue Baustelle wird vollständig wieder geladen

- **WHEN** eine berechtigte Person eine Baustelle mit gültigen Pflichtangaben und optionalen Ergänzungen anlegt
- **THEN** speichert das System sie als `ConstructionSite` über den vorhandenen Mainserver-Vertrag
- **AND** öffnet die gespeicherte Bearbeitungsansicht mit den unabhängig wieder geladenen Werten
- **AND** erfasst die vorhandene Historie den Vorgang

#### Scenario: Wiederholbare Angaben bleiben fachlich bearbeitbar

- **GIVEN** eine Baustelle enthält mehrere Einschränkungen, Kategorien, Dateien oder weitere bestehende Inhaltsblöcke/Standorte/Zeiträume
- **WHEN** der Editor geöffnet wird
- **THEN** sind vorhandene Angaben zugänglich und die für die geprüfte App maßgeblichen ersten Einträge erkennbar
- **AND** löscht oder sortiert das bloße Laden keine zusätzlichen Angaben

### Requirement: Baustellen validieren Pflichtangaben und bewahren bewusste Eingaben

Das System MUST Titel und den primären Beginn/Ende-Zeitraum client- und serverseitig validieren. Ende MUST größer oder gleich Beginn sein. Koordinaten MUST entweder beide leer oder endlich und innerhalb der gültigen Breiten-/Längengrade sein. Weitere Fachangaben MUST optional bleiben. Defaults MUST ausschließlich für die Neuanlage gelten.

#### Scenario: Änderung des Beginns überschreibt kein gewähltes Ende

- **GIVEN** eine Person hat ein Enddatum gewählt
- **WHEN** sie den Beginn auf einen späteren Tag als das Ende ändert
- **THEN** bleibt das Enddatum erhalten
- **AND** blockiert eine zugängliche Fehlermeldung das Speichern bis zur Korrektur

#### Scenario: Bestandsdaten erhalten keine erfundenen Defaults

- **GIVEN** einer bestehenden Baustelle fehlt ein Pflichtdatum
- **WHEN** sie bearbeitet wird
- **THEN** wird das fehlende Datum nicht durch heute ersetzt
- **AND** kann die Person die fehlende Angabe gezielt korrigieren

#### Scenario: Null ist eine gültige Koordinate

- **WHEN** gültige Koordinaten einschließlich eines Werts von null eingegeben werden
- **THEN** bleiben sie gültige Zahlen
- **AND** wird eine einzelne fehlende Koordinate weder stillschweigend ergänzt noch als null gespeichert

### Requirement: Baustellen verwenden die vorhandene zugängliche Studio-Bedienung

Das System MUST vorhandene UI-, Datums-, Karten-, Medien-, Verlassenswarnungs- und Speicherfeedback-Verträge verwenden, neue Texte über de-/en-Übersetzungen ausgeben und WCAG 2.1 AA erfüllen. Fehlerzusammenfassung, Feldfehler und Fokus MUST zusammenwirken. Sichtbarkeit und zeitliche Einordnung MUST getrennt erklärt werden.

#### Scenario: Ein Fehler in einem geschlossenen Zusatzbereich ist erreichbar

- **WHEN** das Formular einen Fehler in einem geschlossenen optionalen Abschnitt erkennt
- **THEN** öffnet es den Abschnitt vor dem Fokuswechsel
- **AND** verweist die Fehlerzusammenfassung auf das beschriftete Eingabefeld
- **AND** ist die Korrektur per Tastatur möglich

#### Scenario: Standort ohne Kartenbedienung erfassen

- **WHEN** eine Person ausschließlich die Tastatur verwendet
- **THEN** kann sie Standortbezeichnung und Koordinaten ohne Kartenklick erfassen

#### Scenario: Medienwirkung wird ohne unbelegte App-Zusage erklärt

- **GIVEN** eine Baustelle besitzt mehrere Medieneinträge
- **WHEN** die Person deren Reihenfolge bearbeitet
- **THEN** erklärt das Formular die Verwendung des ersten Medieneintrags als Bild im geprüften App-Verbraucher
- **AND** verspricht es keine Darstellung aller Dateitypen in jeder App-Variante
