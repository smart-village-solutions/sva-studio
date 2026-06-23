## MODIFIED Requirements
### Requirement: Inhaltsübersicht als tabellarische Admin-Ansicht

Das System MUST eine Seite `Inhalte` bereitstellen, die vorhandene Inhalte in einer tabellarischen Admin-Ansicht darstellt.

Die Seite MUST fuer sichtbare Inhaltstypen eine einzige fuehrende serverseitige Listenquelle verwenden und darf fuer den produktiven Listenpfad keine browserseitigen Vollscans ueber mehrere Fachlisten ausfuehren.

#### Scenario: Inhaltsliste wird geladen

- **WENN** ein berechtigter Benutzer die Seite `Inhalte` oeffnet
- **DANN** zeigt das System eine semantische Tabelle mit den Spalten Titel, Veroeffentlichungsdatum, Erstellungsdatum, Aenderungsdatum, Autor, Payload, Status und Historie
- **UND** jede Tabellenzeile repraesentiert genau einen Inhalt
- **UND** der Inhaltstyp ist pro Zeile erkennbar
- **UND** das System zeigt einen Ladezustand, bis die Inhaltsdaten verfuegbar sind

#### Scenario: Mainserver-gestuetzte Inhaltstypen erscheinen ueber die fuehrende Listenquelle

- **WENN** fuer die aktive Instanz lesbare News-, Event- oder POI-Inhalte nur im Mainserver existieren
- **DANN** erscheinen sie dennoch in der Seite `Inhalte`
- **UND** die Seite liest sie ueber dieselbe fuehrende serverseitige Listenquelle wie andere sichtbare Inhalte
- **UND** der Browser fuehrt dafuer keinen lokalen Vollscan ueber mehrere Mainserver-Fachlisten aus

#### Scenario: Inhaltsliste nutzt serverseitige Pagination

- **WENN** die Seite `Inhalte` mit `page`, `pageSize`, `sortBy`, `sortDirection`, `q`, `type`, `status` oder `visibleType` angefragt wird
- **DANN** wendet das System diese Parameter serverseitig auf die fuehrende Listenquelle an
- **UND** der Browser erhaelt nur die angeforderte Ergebnis-Seite
- **UND** die Seite laedt nicht den vollstaendigen Mainserver-Bestand vor der Anzeige

#### Scenario: Downstream-Fehler fuehren nicht zu endlosem Ladezustand

- **WENN** eine fuer die Inhaltsuebersicht benoetigte Mainserver-Quelle fehlschlaegt oder auslaeuft
- **DANN** beendet die Seite den Ladezustand deterministisch
- **UND** sie zeigt einen regulären Fehlerzustand statt eines dauerhaften "Inhalte werden geladen ..."

