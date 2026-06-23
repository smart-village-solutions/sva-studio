## ADDED Requirements

### Requirement: Standardisiertes Detail-Editor-Muster für umfangreiche Redaktionsobjekte

Das Studio SHALL für umfangreiche Redaktionsobjekte ein gemeinsames Detail-Editor-Muster bereitstellen, das mehrere gleichrangige Bearbeitungsbereiche innerhalb einer stabilen, aufgabenorientierten Oberfläche organisiert.

#### Scenario: Umfangreicher Facheditor nutzt Bereichsnavigation

- **WENN** eine Verwaltungs- oder Redaktionsansicht ein umfangreiches Fachobjekt mit mehreren Bearbeitungsbereichen rendert
- **DANN** stellt das Studio eine sichtbare Bereichsnavigation für diese Bearbeitungsbereiche bereit
- **UND** der Benutzer kann direkt zwischen den Bereichen wechseln, ohne konkurrierende Seitenlayouts oder versteckte Sektionen zu durchlaufen

#### Scenario: Bereichsstruktur bleibt für Create und Edit konsistent

- **WENN** derselbe Facheditor im Erstellungs- oder Bearbeitungsfall verwendet wird
- **DANN** bleibt die Bereichsstruktur konsistent
- **UND** das Studio darf den initialen Fokus je nach Modus unterschiedlich setzen, ohne zwei getrennte Editorarchitekturen zu erzeugen

### Requirement: Umfangreiche Formularflows priorisieren aufgabenorientierte Reihenfolge

Das Studio SHALL bei umfangreichen Formularflows die Reihenfolge der Bearbeitungsbereiche am mentalen Modell der Aufgabe statt an der Reihenfolge technischer Datenobjekte ausrichten.

#### Scenario: Redaktionsflow priorisiert Kernaufgaben zuerst

- **WENN** ein Redakteur einen umfangreichen Fachdatensatz erstmals erstellt
- **DANN** erscheinen die Kernaufgaben wie Identität, Ort und primäre Kontaktierbarkeit vor erweiterten oder seltenen Spezialdaten
- **UND** fortgeschrittene Bereiche verdrängen nicht den initialen Pflegefluss

#### Scenario: Erweiterte Daten bleiben außerhalb des Kernflows

- **WENN** ein Formular zusätzliche technische oder selten genutzte Daten enthält
- **DANN** gruppiert das Studio diese Daten in einem erkennbar sekundären Bereich wie `Erweiterte Daten`
- **UND** der Kernflow für Erstnutzer bleibt davon entlastet

### Requirement: Kartenbasierte Ortsbearbeitung ist als Studio-Standardlayout anschlussfähig

Das Studio SHALL für Fachobjekte mit geographischem Schwerpunkt ein anschlussfähiges Layoutmuster bereitstellen, das formularbasierte Ortsdaten und eine Kartenansicht in einer gemeinsamen, responsiven Sektion kombiniert.

#### Scenario: Ortsformular und Karte erscheinen gemeinsam

- **WENN** ein Facheditor räumliche Daten wie Adresse und Geo-Koordinaten pflegt
- **DANN** können Formularfelder und Kartenansicht gemeinsam in derselben Bearbeitungssektion erscheinen
- **UND** die Layoutstruktur bleibt auf Desktop und Mobilgeräten nutzbar

#### Scenario: Kartenbereich bleibt ein fachlicher Bestandteil der Sektion

- **WENN** ein Fachobjekt eine Karteninteraktion zur Datenpflege nutzt
- **DANN** erscheint die Karte als Teil der fachlichen Ortssektion und nicht als losgelöster technischer Spezialdialog
- **UND** Formular- und Karteninteraktion bleiben für Redakteure als zusammengehöriger Arbeitsschritt erkennbar

#### Scenario: Kartenbereich arbeitet mit Adresssuche zusammen

- **WENN** ein Facheditor eine adressbasierte Ortssuche anbietet
- **DANN** können Suchtreffer die Kartenposition und den Marker aktualisieren
- **UND** die Karte bleibt der führende visuelle Ort für Auswahl und Kontrolle der Geo-Position
