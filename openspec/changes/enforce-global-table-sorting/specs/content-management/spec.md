## ADDED Requirements

### Requirement: Inhaltslisten-Sortierung gilt für den vollständigen verfügbaren Trefferbestand

Das System MUST die Sortierung der paginierten Inhaltsübersicht serverseitig auf den vollständigen, durch Berechtigungen und aktuelle Filter definierten verfügbaren Trefferbestand anwenden und erst danach die angeforderte Seite bilden. Es MUST dafür ausschließlich die sichtbaren Felder `title`, `createdAt`, `updatedAt` und `publishedAt` unterstützen und standardmäßig `updatedAt desc` verwenden.

#### Scenario: Inhaltsübersicht erhält eine serverseitig sortierte Seite

- **GIVEN** die aktuellen Inhaltsfilter ergeben mehr Treffer als auf eine Seite passen
- **WHEN** ein Benutzer ein unterstütztes Sortierfeld auswählt
- **THEN** wendet die führende serverseitige Listenquelle Filterung und Sortierung vor der Pagination an
- **AND** liefert sie nur die angeforderte Ergebnisseite an den Browser
- **AND** sortiert die gemeinsame Tabellenkomponente diese Seite nicht nochmals lokal

#### Scenario: Zuletzt bearbeitete Inhalte stehen standardmäßig zuerst

- **GIVEN** die Inhaltsübersicht wird ohne gültigen expliziten Sortierwert geöffnet
- **WHEN** das System die erste Seite lädt
- **THEN** sortiert die führende Listenquelle den vollständigen gefilterten Bestand nach `updatedAt desc`
- **AND** zeigt der Tabellenkopf diesen Default aktiv an

#### Scenario: Erstellung und Veröffentlichung werden vollständig serverseitig sortiert

- **GIVEN** die aktuellen Inhaltsfilter ergeben mehr Treffer als auf eine Seite passen
- **WHEN** ein Benutzer `createdAt` oder `publishedAt` auswählt
- **THEN** führen sowohl der native Inhalts- als auch der Projektionspfad das gewählte Feld und die Richtung aus
- **AND** stehen Inhalte ohne `publishedAt` unabhängig von der Richtung am Ende
- **AND** stabilisiert `ID asc` gleiche Zeitwerte

#### Scenario: Übersetzte Typ- und Statuswerte täuschen keine alphabetische Sortierung vor

- **WHEN** die Inhaltsübersicht lokalisierte Inhaltstypen und Statuswerte anzeigt
- **THEN** bieten die Spalten Inhaltstyp und Status keine Sortieraktion an
- **AND** sortiert das System sie nicht nach ihren abweichenden technischen Werten

#### Scenario: Ungültige Sortierparameter werden nicht still umgedeutet

- **GIVEN** ein direkter API-Request enthält ein unbekanntes Sortierfeld oder eine unbekannte Richtung
- **WHEN** der Inhaltsendpunkt den Request validiert
- **THEN** antwortet er mit `400 invalid_request`
- **AND** wechselt er nicht still auf `updatedAt desc`

#### Scenario: Partieller Snapshot begrenzt den verfügbaren Trefferbestand

- **GIVEN** die Inhaltsprojektion ist für mindestens einen angefragten Typ noch partiell
- **WHEN** die Inhaltsübersicht gefiltert und sortiert wird
- **THEN** gilt der vollständige Sortierumfang für alle aktuell autorisiert verfügbaren Projektionszeilen
- **AND** bleibt die bestehende Kennzeichnung erhalten, dass Filterung, Sortierung und Gesamtzahl bis zur vollständigen Reconciliation vorläufig sind
