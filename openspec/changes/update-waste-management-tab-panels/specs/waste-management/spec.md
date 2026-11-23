## ADDED Requirements

### Requirement: Waste-Management richtet alle Haupttabs am gemeinsamen Bedienmuster aus

Das System MUST alle neun Haupttabs Abfallarten, Touren, Abholpunkte, Stammdaten, Ausweichtermine, Tour-Einsätze, Ausgabe, Datentools und Einstellungen mit einem einheitlich aufgebauten Tabpanel anbieten. Der aktive Tab MUST das Panel auch programmatisch benennen. Der sichtbare Arbeitsinhalt beginnt unmittelbar nach der Tab-Leiste. Listen zeigen ihre Bedienleiste und die fachliche Tabelle. Formular- und Werkzeugtabs gliedern ihren Inhalt in aufklappbare Abschnitte mit zugehörigen Aktionen.

#### Scenario: Benutzer öffnet einen Listen-Tab

- **WHEN** ein Benutzer einen der sechs Listen-Tabs öffnet
- **THEN** beginnt der sichtbare Inhalt mit der Bedienleiste
- **AND** erhält das Tabpanel seinen zugänglichen Namen über die zugehörige Tab-Beschriftung
- **AND** stehen Listensteuerung, eigenständige Aktionen und Aktionen für eine Auswahl in ihrer jeweiligen Bediengruppe
- **AND** bleiben die vorhandenen Tabellendaten, Zellaktionen und fachlichen Rücksprungziele erreichbar

#### Scenario: Benutzer bedient die Abschnitte eines Formular- oder Werkzeugtabs

- **WHEN** ein Benutzer in Ausgabe, Datentools oder Einstellungen einen Abschnitt öffnet und zu- und wieder aufklappt
- **THEN** erreicht er die zugehörigen Felder, Hinweise und vorhandenen Aktionen gemeinsam
- **AND** bleiben Formularentwürfe und laufende Jobzustände beim Auf- und Zuklappen erhalten
- **AND** gelten die bestehenden Speicher- und Berechtigungsgrenzen der Formulare und Werkzeuge

### Requirement: Waste-Management verwendet einen gemeinsamen modalen Filterablauf

Das System MUST für die sechs Listen-Tabs einen mittigen, modalen Studio-Filterdialog mit abgedunkeltem Hintergrund verwenden. Kriterien und gegebenenfalls die dort angebotene Adresssortierung MUST beim Öffnen aus dem angewandten Zustand übernommen und als Entwurf geführt werden. Die Liste MUST die wirksamen Filterwerte sichtbar machen und deren einzelnes oder gemeinsames Entfernen anbieten.

#### Scenario: Benutzer übernimmt einen Filterentwurf

- **GIVEN** die Liste hat bereits angewandte Kriterien
- **WHEN** der Benutzer im Dialog Kriterien ändert und `Filter anwenden` aktiviert
- **THEN** übernimmt das System die wirksame Kombination gemeinsam in Liste und typisierten URL-Zustand
- **AND** beginnt die Liste bei verändertem Zustand auf Seite eins
- **AND** zeigen Liste, Trefferzahl und die Auswahl aller gefilterten Zeilen dieselbe fachliche Eingrenzung
- **AND** sind die angewandten Kriterien nach dem Schließen und nach einem Reload erkennbar

#### Scenario: Benutzer setzt Kriterien zurück oder bricht ab

- **WHEN** der Benutzer im offenen Dialog `Zurücksetzen` wählt
- **THEN** setzt das System nur die Filterkriterien des Entwurfs auf ihren Defaultwert
- **AND** bleiben Treffer, URL und angewandte Sortierung bis zum Anwenden bestehen
- **AND** wird bei Abbrechen, Schließen oder Escape der Entwurf verworfen
- **AND** gelten nach erneutem Öffnen die zuletzt angewandten Werte

#### Scenario: Filterdialog bleibt mit Tastatur und schmaler Ansicht bedienbar

- **WHEN** der Benutzer den Dialog mit Tastatur oder auf einer schmalen Ansicht bedient
- **THEN** hat der Dialog einen zugänglichen Namen und führt den Fokus im Dialog
- **AND** bleiben Felder, Fehlermeldungen sowie Fußaktionen erreichbar
- **AND** kehrt der Fokus nach dem Schließen zum Filterauslöser zurück

### Requirement: Waste-Management bietet fachlich festgelegte Filter je Listen-Tab

Das System MUST in Abfallarten die Suche nach Name, Kürzel, Beschreibung und Gefäßgröße sowie den Statusfilter bereitstellen. In Touren MUST es Name, Abfallart, Status, relatives Gültigkeitsjahr und freie Datumsgrenzen für Beginn und Ende gemäß bestehender Fachlogik gemeinsam auswerten. Stammdaten MUST die Liste der gewählten Adressebene über die bestehende Suche und die zur Ebene passende Elternzuordnung eingrenzen.

Für Abholpunkte MUST das System Suche, Aktivitätsstatus, Region, Ort, Straße, Hausnummer und konkrete Tour auf den vollständigen Listenbestand anwenden. Tourenjahr und Tourstatus MUST die angezeigten Tourzuordnungen und die Auswahl konkreter Touren im bestehenden Sinn beschränken. Diese beiden Kriterien allein MUST die Abholpunktzeilen nicht zusätzlich einschränken. Ausweichtermine MUST über Suche, Typ, Tour und einen Zeitraum anhand des ursprünglichen Termins eingrenzbar sein. Der Filterumfang der Tour-Einsätze MUST aus dem Tour-Kriterium bestehen.

#### Scenario: Benutzer grenzt Abholpunkte anhand konkreter Adressdaten ein

- **WHEN** der Benutzer Straße oder Hausnummer im Filterdialog auswählt und anwendet
- **THEN** gleicht das System stabile IDs der gespeicherten Adresse ab
- **AND** wirken die Kriterien vor Pagination gleichermaßen auf Liste, Gesamtzahl und alle gefilterten IDs
- **AND** bezeichnet eine Auswahl `Alle Straßen` oder `Alle Hausnummern` im Filterdialog den neutralen Filterwert
- **AND** setzt ein Wechsel der übergeordneten Adresse nur nicht mehr passende untergeordnete Filter zurück

#### Scenario: Benutzer filtert Ausweichtermine nach Typ und Zeitraum

- **WHEN** der Benutzer einen Typ und eine oder beide Datumsgrenzen anwendet
- **THEN** prüft das System Typ und ursprünglichen Termin gemeinsam mit der Suche und einer gegebenenfalls aktiven Tour
- **AND** sind beide gesetzten Datumsgrenzen inklusive
- **AND** werden unzulässige Datumsbereiche zugänglich erklärt und nicht angewandt
- **AND** entspricht das Tour-Kriterium der bestehenden fachlichen Auswahl einschließlich explizit betroffener globaler Verschiebungen

#### Scenario: Benutzer öffnet Tour-Einsätze im Kontext einer Tour

- **WHEN** der Benutzer von einer konkreten Tour zu ihren Einsätzen wechselt oder den Deep-Link neu lädt
- **THEN** ist die vorhandene Tour-ID das angewandte Kriterium
- **AND** bietet der Filterdialog die Auswahl der Tour an
- **AND** bleibt `Zur Tour` zum bestehenden Ziel erreichbar, solange ein auflösbarer Tour-Kontext gesetzt ist

### Requirement: Waste-Management sortiert Datenspalten vor der Pagination

Das System MUST für Datenspalten der sechs Listen-Tabs die folgenden Sortierkriterien in beide Richtungen anbieten. Es MUST den vollständigen gefilterten Bestand deterministisch sortieren und erst anschließend paginieren. Benannte Sortierrichtung und aktives Kriterium MUST visuell und programmatisch erkennbar sein. Auswahl- und Aktionszellen behalten ihre Bedienfunktion. Bestehende Standardreihenfolgen gelten ohne explizite Auswahl.

| Liste | Sortierbare Datenspalten und Bedeutung |
| --- | --- |
| Abfallarten | Name inklusive Gefäßgröße als zweites Kriterium, Kürzel, Farbe nach angezeigtem Farbwert, Beschreibung, Status. |
| Touren | Name, Abfallarten, Turnus, Gültigkeit nach Startdatum, Anzahl der Verschiebungen, Anzahl der Abholpunkte, Status. Bei mehreren Abfallarten dient die erste alphabetisch angezeigte Abfallart als Schlüssel. |
| Abholpunkte | Region, Ort, Straße, Hausnummer, Anzahl der in der Tourenspalte berücksichtigten Zuordnungen, Aktivitätsstatus. Die ordnenden Adressreihenfolgen mit und ohne Region bleiben verfügbar. |
| Stammdaten | Datenspalten der gewählten Ebene, einschließlich Name oder Hausnummer, Postleitzahl und angezeigter Elternspalten. Postleitzahlen werden mit führenden Nullen als Text behandelt. |
| Ausweichtermine | Ursprünglicher und verschobener Termin chronologisch, Typ, Bezug und Beschreibung nach angezeigtem Wert. |
| Tour-Einsätze | Datum chronologisch, Tour, erster angezeigter Abholpunkt und Hinweis. Bei mehreren Abholpunkten gilt die Reihenfolge der Darstellung. |

#### Scenario: Benutzer sortiert eine Zahlen- oder Datumsspalte

- **GIVEN** die gefilterte Liste enthält mehrere Seiten und Werte wie `2` und `10` oder Daten in unterschiedlichen Jahren
- **WHEN** der Benutzer eine Zahlen- oder Datumsspalte sortiert
- **THEN** werden Mengen numerisch und Date-only-Werte chronologisch über alle Treffer verglichen
- **AND** fängt die Anzeige bei Seite eins an und zeigt die aktive Richtung an
- **AND** stehen optionale leere Werte in beiden Richtungen nach vorhandenen Werten
- **AND** stabilisiert ein eindeutiger Schlüssel fachliche Gleichstände

#### Scenario: Benutzer sortiert eine Sammelspalte

- **WHEN** der Benutzer die Liste nach einem dargestellten Sammelwert sortiert
- **THEN** benennt die Bedienung die fachliche Bedeutung der Sortierung
- **AND** verwenden Touren für Verschiebungen und Abholpunkte die jeweilige Anzahl
- **AND** verwenden Tour-Einsätze für Abholpunkte den ersten angezeigten Abholpunkt als Sortierschlüssel

### Requirement: Waste-Tabpanels erhalten die vorhandenen Aktions- und Berechtigungsverträge

Das System MUST beim Wechsel auf die neuen Tabpanels alle vorhandenen Haupt-, Zeilen-, Auswahl-, Kontext- und Folgeaktionen mit ihrem bisherigen Geltungsbereich, ihren Rechten, Bestätigungen und Zielverhalten erhalten. Die Bestandsfälle umfassen die neun Tabs und den Modulrahmen einschließlich der Status-, Lade-, Leer-, Fehler- und Berechtigungszustände. Eine vorhandene Auswahl aller gefilterten Treffer bleibt auch bei leerer Auswahl erreichbar.

#### Scenario: Benutzer führt eine Sammelaktion aus

- **GIVEN** der Benutzer hat berechtigte Datensätze über Seiten und Filtergrenzen hinweg ausgewählt
- **WHEN** er zur Liste zurückkehrt oder einen anderen Filter anwendet
- **THEN** bleiben die markierten Datensätze über ihre IDs gebunden
- **AND** zeigen die Auswahlaktionen vor der Ausführung ihren tatsächlichen Umfang einschließlich bestehender Hinweise zu ausgeblendeten Einträgen und Grenzen
- **AND** läuft die Mutation erst nach der bestehenden Bestätigung mit den vorgesehenen IDs

#### Scenario: Benutzer verwendet ein tabbezogenes Werkzeug

- **WHEN** ein berechtigter Benutzer Jahresübernahme oder Fraktionsprüfung öffnet
- **THEN** ist das Werkzeug an der vorgesehenen festen Stelle der Tab-Bedienleiste erreichbar
- **AND** durchläuft die Jahresübernahme weiterhin Vorschau, Konfliktprüfung, bestätigte Anlage als Entwurf und die bestehende Ergebnisnavigation
- **AND** erhält die Fraktionsprüfung ihren eigenen Umfang, die vorhandenen fachlichen Ausnahmen sowie ihre Einzel- und Sammelaktionen aus dem Befund

#### Scenario: Leser öffnet eine Liste oder einen Werkzeugtab

- **WHEN** eine Person mit Leserechten die Oberfläche oder einen Deep-Link öffnet
- **THEN** bleiben nur die bereits autorisierten Aktionen anwendbar
- **AND** bleiben die bestehenden serverseitigen Berechtigungs- und Tenant-Grenzen maßgeblich

## MODIFIED Requirements

### Requirement: Waste-Abholorte werden serverseitig global nach Adresse sortiert

Das System MUST die autorisierte Abholort-Stammdatenliste serverseitig zuerst nach allen aktiven Fachfiltern eingrenzen, danach den vollständigen gefilterten Bestand deterministisch sortieren und erst anschließend paginieren. Es MUST die Adressreihenfolgen `Ort → Straße → Hausnummer` und `Region → Ort → Straße → Hausnummer` sowie die Einzelkriterien Region, Ort, Straße, Hausnummer, Anzahl berücksichtigter Tourzuordnungen und Aktivitätsstatus anbieten. Die standardmäßige Adressreihenfolge ist `Ort → Straße → Hausnummer` aufsteigend. Fehlende Werte MUST unabhängig von der Richtung hinter vorhandenen Werten stehen, und die eindeutige Abholort-ID MUST Gleichstände aufsteigend stabilisieren. Bestehende Adresssortierparameter MUST ihre bisherige Bedeutung behalten.

#### Scenario: Standardsortierung gilt über mehrere Seiten

- **GIVEN** der gefilterte Abholortbestand umfasst mehr Treffer als auf eine Seite passen
- **WHEN** ein berechtigter Benutzer die Abholort-Stammdatenliste ohne abweichende Sortierparameter öffnet
- **THEN** filtert das System den vollständigen autorisierten Bestand
- **AND** sortiert ihn aufsteigend nach Ort, Straße, Hausnummer und abschließend ID
- **AND** schneidet erst danach die angeforderte Seite zu
- **AND** ein Seitenwechsel erhält dieselbe globale Reihenfolge

#### Scenario: Region wird als erstes Kriterium berücksichtigt

- **WHEN** ein Benutzer die Adressreihenfolge mit Region als erstem Kriterium wählt oder einen bestehenden Link mit diesem Sortiermodus öffnet
- **THEN** sortiert das System den vollständigen gefilterten Bestand nach Region, Ort, Straße und Hausnummer
- **AND** gilt die gewählte Richtung gemeinsam für alle vier fachlichen Kriterien
- **AND** bleibt die ID als letzter Gleichstandsauflöser aufsteigend

#### Scenario: Fehlende Werte bleiben in beiden Richtungen zuletzt

- **GIVEN** mindestens ein Abholort besitzt für ein aktives Sortierkriterium keinen Wert
- **WHEN** ein Benutzer aufsteigend oder absteigend sortiert
- **THEN** stehen Abholorte mit vorhandenem Wert vor Abholorten ohne Wert
- **AND** werden zwei Abholorte mit gleichen vorhandenen beziehungsweise fehlenden Fachwerten über ihre ID stabil geordnet

#### Scenario: Hausnummern werden fachlich numerisch geordnet

- **GIVEN** zwei ansonsten gleiche Abholorte besitzen die Hausnummern `2` und `10`
- **WHEN** die Liste aufsteigend nach der Adressfolge oder der Einzelspalte Hausnummer sortiert wird
- **THEN** steht Hausnummer `2` vor Hausnummer `10`
- **AND** verwendet die produktive Serverprojektion dieselbe dokumentierte Vergleichssemantik wie die Repository-Integrationstests

#### Scenario: Benutzer sortiert nach einer Einzelspalte

- **WHEN** ein Benutzer eine der sechs einzeln sortierbaren Spalten auswählt
- **THEN** ersetzt das Einzelkriterium den bisherigen fachlichen Sortiermodus
- **AND** sortiert der Server den gefilterten Bestand nach dem gewählten Kriterium und der ID, bevor er eine Seite zuschneidet
- **AND** stehen Touranzahl und Aktivitätsstatus auch über Seitengrenzen hinweg in der angeforderten Reihenfolge

#### Scenario: Benutzer sortiert nach berücksichtigten Tourzuordnungen

- **GIVEN** Tourenjahr oder Tourstatus begrenzen die in der Tourenspalte sichtbaren Zuordnungen
- **WHEN** der Benutzer nach der Spalte `Touren` sortiert
- **THEN** zählt der Server für jeden gefilterten Abholort die nach derselben Fachlogik berücksichtigten Zuordnungen
- **AND** ist der Sortierwert für einen Abholort ohne passende Zuordnung `0`

#### Scenario: Direkter Request enthält unerlaubte Sortierwerte

- **WHEN** ein direkter API-Request ein unbekanntes Sortierfeld, einen unbekannten Sortiermodus, eine unbekannte Richtung oder widersprüchliche Mehrfachwerte enthält
- **THEN** antwortet das System mit `400 invalid_request`
- **AND** übernimmt es keinen Requestwert als freien SQL-Ausdruck

### Requirement: Abholortlisten-Zustand bleibt über Darstellungen und Pagination konsistent

Das System MUST den aktiven Adress- oder Einzelspaltenmodus, Sortierrichtung, Filter, Seite und Seitengröße als kontrollierten, typisierten Listenzustand führen. Desktop- und schmale Darstellung MUST denselben Sortierzustand bedienen und die empfangene Serverreihenfolge unverändert darstellen. Filter-, Sortier- und Seitengrößenwechsel MUST die Seite auf eins zurücksetzen, ohne ID-basierte Auswahlen anderen Abholorten zuzuordnen.

#### Scenario: Benutzer ändert die Sortierung auf einer späteren Seite

- **GIVEN** ein Benutzer befindet sich auf einer Seite größer als eins
- **WHEN** er Sortiermodus oder Sortierrichtung ändert
- **THEN** navigiert das System atomar auf Seite eins
- **AND** fordert es die neu sortierte erste Seite beim Server an
- **AND** sortiert die Tabellenkomponente diese Seite nicht nochmals lokal

#### Scenario: Filter und Seitengröße setzen die Seite zurück

- **WHEN** ein Benutzer Suche, Status, Region, Ort, Straße, Hausnummer, Tour oder Seitengröße ändert
- **THEN** wird die Seite auf eins gesetzt
- **AND** Gesamtzahl und Seiteninhalt beruhen auf demselben serverseitigen Filtervertrag

#### Scenario: Desktop und schmale Ansicht teilen den Zustand

- **WHEN** ein Benutzer Sortiermodus oder Richtung über eine der beiden Darstellungen ändert
- **THEN** zeigen beide Darstellungen denselben aktiven Modus und dieselbe Richtung an
- **AND** sind Kriterien, Richtung und Bedienung für Maus, Tastatur und Screenreader verständlich

#### Scenario: Auswahl bleibt an IDs gebunden

- **GIVEN** ein Benutzer hat Abholorte auf einer oder mehreren Seiten ausgewählt
- **WHEN** er Seite, Sortierung oder Filter ändert
- **THEN** bleibt jede Auswahl ausschließlich ihrer Abholort-ID zugeordnet
- **AND** eine neu sichtbare Zeile übernimmt keinen Auswahlzustand über ihren Zeilenindex
- **AND** Auswahlen außerhalb des aktuellen Filters bleiben erhalten

#### Scenario: Alle gefilterten Abholorte werden seitenübergreifend ausgewählt

- **WHEN** ein Benutzer `Alle gefilterten auswählen` aktiviert
- **THEN** löst das System alle Abholort-IDs über denselben serverseitigen Filtervertrag wie die Liste auf
- **AND** begrenzt es die Auswahl nicht auf die sichtbare Seite
- **AND** beeinflussen Sortiermodus und Pagination nicht die ermittelte ID-Menge
