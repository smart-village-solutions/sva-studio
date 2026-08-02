## MODIFIED Requirements

### Requirement: Inhaltsübersicht als tabellarische Admin-Ansicht

Das System MUST eine Seite `Inhalte` bereitstellen, die vorhandene Inhalte in einer tabellarischen Admin-Ansicht darstellt.

Die Seite MUST für sichtbare Inhaltstypen eine einzige führende serverseitige Listenquelle verwenden und darf für den produktiven Listenpfad keine browserseitigen Vollscans über mehrere Fachlisten ausführen.

#### Scenario: Inhaltsliste wird geladen

- **WENN** ein berechtigter Benutzer die Seite `Inhalte` öffnet
- **DANN** zeigt das System eine semantische Tabelle mit den Spalten Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Status und Historie
- **UND** jede Tabellenzeile repräsentiert genau einen Inhalt
- **UND** der Inhaltstyp ist pro Zeile erkennbar
- **UND** das System zeigt einen Ladezustand, bis mindestens vollständige oder partielle Inhaltsdaten verfügbar sind

#### Scenario: Mainserver-gestützte Inhaltstypen erscheinen über die führende Listenquelle

- **WENN** für die aktive Instanz lesbare News-, Event-, POI-, Generic-Item-, FAQ- oder Survey-Inhalte nur im Mainserver existieren
- **DANN** erscheinen sie dennoch in der Seite `Inhalte`
- **UND** die Seite liest sie über dieselbe führende serverseitige Listenquelle wie andere sichtbare Inhalte
- **UND** der Browser führt dafür keinen lokalen Vollscan über mehrere Mainserver-Fachlisten aus

#### Scenario: Inhaltsliste nutzt serverseitige Pagination

- **WENN** die Seite `Inhalte` mit `page`, `pageSize`, `sortBy`, `sortDirection`, `q`, `type`, `status` oder `visibleType` angefragt wird
- **DANN** wendet das System diese Parameter serverseitig auf die führende Listenquelle an
- **UND** der Browser erhält nur die angeforderte Ergebnis-Seite
- **UND** die Seite lädt nicht den vollständigen Mainserver-Bestand vor der Anzeige

#### Scenario: Partieller Snapshot wird sofort angezeigt

- **WENN** für einen Mainserver-Inhaltstyp mindestens eine Seite erfolgreich lokal persistiert wurde
- **UND** weitere Seiten noch im Hintergrund geladen werden
- **DANN** zeigt die Inhaltsübersicht die bereits persistierten und autorisierten Zeilen sofort an
- **UND** kennzeichnet sie als partiellen Snapshot im Aufbau
- **UND** behauptet keine endgültige Trefferzahl, Seitenzahl oder Vollständigkeit

#### Scenario: Partielle Pagination bleibt vorläufig

- **WENN** mindestens ein angefragter Mainserver-Inhaltstyp nur partiell materialisiert ist
- **DANN** entspricht `pagination.total` aus Kompatibilitätsgründen ausschließlich der aktuell autorisiert verfügbaren lokalen Treffermenge
- **UND** liefern additive Metadaten `availableCount`, `isTotalFinal = false` sowie den typbezogenen Snapshot-Zustand
- **UND** fehlt `totalCount`, bis der angefragte Bestand vollständig reconciled wurde
- **UND** bietet die Oberfläche keine Navigation auf noch nicht materialisierte Seiten an
- **UND** kennzeichnet sie Sortierung und Filterung als vorläufig auf die lokal verfügbare Menge begrenzt

#### Scenario: Gemischte Inhaltstypen besitzen unterschiedliche Vollständigkeit

- **WENN** eine Listenanfrage vollständige und partielle Mainserver-Inhaltstypen kombiniert
- **DANN** ist die Gesamtantwort partiell, sobald mindestens ein angefragter Typ partiell ist
- **UND** bleiben Vollständigkeit und Fehlerzustand pro Inhaltstyp separat in den Metadaten erhalten
- **UND** bewertet ein expliziter Typfilter nur den angefragten Typ

#### Scenario: Vorhandener Snapshot wird während einer Aktualisierung weiterverwendet

- **WENN** beim Öffnen der Inhaltsübersicht bereits ein lesbarer lokaler Snapshot existiert
- **DANN** zeigt das System diesen ohne Warten auf den Mainserver sofort an
- **UND** startet die Revalidierung im Hintergrund
- **UND** kennzeichnet einen veralteten oder laufend aktualisierten Stand, ohne die Tabelle durch einen Vollseiten-Ladezustand zu ersetzen

#### Scenario: Hintergrund-Refresh liefert weitere lokale Seiten

- **WENN** während einer geöffneten Inhaltsübersicht neue oder aktualisierte Projektionszeilen lokal persistiert werden
- **DANN** revalidiert der Browser die führende Listenquelle mit begrenzter Frequenz und Backoff
- **UND** zeigt die Tabelle die neuen lokalen Ergebnisse zeitnah an
- **UND** bleiben Fokus, Zeilenauswahl, Filter, Sortierung und aktuelle Seite erhalten, soweit die angefragten Daten dies zulassen

#### Scenario: Manueller Refresh beendet die priorisierte Phase

- **WENN** ein Redakteur `Aktualisieren` auslöst
- **UND** die neuesten Seiten der angefragten Inhaltstypen erfolgreich persistiert wurden
- **DANN** meldet die Oberfläche den erfolgreichen Hot-Refresh
- **UND** zeigt die neuen lokalen Zeilen
- **UND** darf die vollständige Reconciliation weiterer Seiten im Hintergrund fortgesetzt werden

#### Scenario: Spätere Seite schlägt nach partiellem Erfolg fehl

- **WENN** bereits persistierte Seiten eines Mainserver-Inhaltstyps lesbar sind
- **UND** eine spätere Seite nicht geladen oder verarbeitet werden kann
- **DANN** bleiben die bereits persistierten Zeilen sichtbar
- **UND** zeigt die Seite einen regulären Hinweis auf den partiellen, nicht vollständig aktualisierten Stand
- **UND** verbleibt nicht in einem unendlichen Ladezustand

#### Scenario: Downstream-Fehler ohne lesbaren Snapshot

- **WENN** eine für die Inhaltsübersicht benötigte Mainserver-Quelle fehlschlägt oder ausläuft
- **UND** für den betroffenen Typ weder ein vollständiger noch ein partieller Snapshot existiert
- **DANN** beendet die Seite den Ladezustand deterministisch
- **UND** zeigt sie einen regulären Fehlerzustand statt eines dauerhaften "Inhalte werden geladen ..."
