## MODIFIED Requirements

### Requirement: Standardisierte Datentabelle für Verwaltungslisten

Das Studio SHALL eine wiederverwendbare Datentabelle für Verwaltungslisten bereitstellen, die Auswahl, Sortierung, Toolbar-Aktionen und mobile Darstellung konsistent abbildet. Die Tabelle MUST ihren Sortiermodus explizit als deaktiviert, clientseitig auf einem vollständigen Datenbestand oder extern kontrolliert deklarieren. Eine bereits paginierte Ergebnismenge darf sie nicht nochmals als vermeintlichen Gesamtbestand sortieren. Externe Sortierung MUST genau ein aktives Feld besitzen, fehlende Werte unabhängig von der Richtung zuletzt einordnen und Gleichstände abschließend mit der eindeutigen Zeilenidentität aufsteigend stabilisieren.

#### Scenario: Tabelle mit Bulk-Aktionen und Sortierung

- **WHEN** eine Studio-Verwaltungsseite tabellarische Daten anzeigt
- **THEN** enthält die Tabelle optional eine Auswahlspalte als erste Spalte
- **AND** sortierbare Spaltenköpfe zeigen ihren Sortierzustand zugänglich an
- **AND** eine Aktionsspalte wird als letzte Spalte gerendert
- **AND** eine Toolbar oberhalb der Tabelle kann Bulk-Aktionen, Filter und sekundäre Aktionen aufnehmen

#### Scenario: Clientseitige Sortierung erhält den vollständigen gefilterten Datenbestand

- **GIVEN** eine Tabelle verwendet clientseitige Sortierung
- **WHEN** die Tabelle einen Sortierwechsel verarbeitet
- **THEN** enthält ihre Datenquelle den vollständigen, durch Berechtigungen und aktuelle Filter definierten Datenbestand
- **AND** erfolgt eine Pagination erst nach dieser Sortierung

#### Scenario: Extern sortierte Tabelle erhält eine einzelne Seite

- **GIVEN** eine Tabelle erhält nur eine bereits paginierte Ergebnisseite
- **WHEN** ein Benutzer die Sortierung ändert
- **THEN** delegiert die Tabelle die Sortierung an den kontrollierten externen Listenvertrag
- **AND** verändert die Tabellenkomponente die Reihenfolge der empfangenen Seite nicht selbst
- **AND** beginnt die externe Pagination wieder auf Seite eins

#### Scenario: Externe Sortierung besitzt keinen unsichtbaren Defaultzustand

- **GIVEN** eine paginierte Tabelle verwendet externe Sortierung
- **WHEN** ein Benutzer den aktiven Sortierkopf wiederholt betätigt
- **THEN** wechselt die Richtung ausschließlich zwischen aufsteigend und absteigend
- **AND** bleibt jederzeit genau ein Sortierfeld sichtbar aktiv
- **AND** entspricht der angezeigte Zustand den an die externe Quelle gesendeten Parametern

#### Scenario: Fehlende und gleiche Sortierwerte bleiben deterministisch

- **GIVEN** eine externe Liste enthält fehlende oder gleiche Werte im aktiven Sortierfeld
- **WHEN** die vollständige gefilterte Menge aufsteigend oder absteigend sortiert wird
- **THEN** stehen fehlende Werte in beiden Richtungen am Ende
- **AND** ersetzt das System fehlende Werte nicht durch ein anderes Fachfeld
- **AND** ordnet es Gleichstände abschließend nach eindeutiger Zeilenidentität aufsteigend

#### Scenario: Mobile Darstellung einer Verwaltungs-Tabelle

- **WHEN** eine Studio-Verwaltungsseite auf kleinem Viewport geöffnet wird
- **THEN** wird die Tabelle als mobile Kartenansicht mit denselben Kerndaten und Aktionen nutzbar dargestellt
- **AND** Auswahl- und Aktionsmuster bleiben funktionsgleich erreichbar
- **AND** ein vorhandener Sortierzustand entspricht demselben globalen Datenvertrag wie in der Desktop-Darstellung
- **AND** kann ein Benutzer ein unterstütztes Sortierfeld und dessen Richtung über zugängliche mobile Bedienelemente ändern
- **AND** verwenden Desktop- und Mobilbedienung denselben kontrollierten Zustand

#### Scenario: Nicht global unterstützte Sortierung wird nicht angeboten

- **GIVEN** eine paginierte Datenquelle kann ein sichtbares Feld nicht auf dem vollständigen gefilterten Datenbestand sortieren
- **WHEN** die Tabelle diese Ergebnisse darstellt
- **THEN** bietet sie für dieses Feld keine Sortieraktion an
- **AND** simuliert sie keine Sortierung ausschließlich auf der aktuell sichtbaren Seite

#### Scenario: Jeder Tabellenaufrufer deklariert seine Sortierownership

- **WHEN** eine App-Route oder ein Plugin die gemeinsame Datentabelle verwendet
- **THEN** deklariert der Aufrufer explizit deaktivierte, clientseitige oder externe Sortierung
- **AND** ist clientseitige Sortierung nur für den vollständigen gefilterten Datenbestand zulässig
- **AND** sind widersprüchliche Kombinationen aus Modus, Spalten, State und Handler typsicher oder durch eine Laufzeitinvariante abgewiesen
