## MODIFIED Requirements

### Requirement: Einstieg zum Anlegen neuer Inhalte

Das System MUST in der Tabellenansicht einen klaren Einstieg zum Anlegen neuer Inhalte bereitstellen.

#### Scenario: Neuer Inhalt wird gestartet

- **WENN** ein berechtigter Benutzer die Tabellenansicht ohne konkreten Typfilter öffnet
- **DANN** ist ein sichtbarer Button `Neuer Inhalt` vorhanden
- **UND** der Button führt zur Auswahl eines anlegbaren Inhaltstyps

#### Scenario: Gefilterter Inhaltstyp wird direkt angelegt

- **WENN** die Tabellenansicht auf einen registrierten Inhaltstyp mit Erstellungsrecht gefiltert ist, auch durch die Seitenleiste
- **DANN** benennt der Button den anzulegenden Inhaltstyp
- **UND** führt unmittelbar zu dessen registrierter Erstellungsroute, ohne erneut den Inhaltstyp abzufragen

#### Scenario: Gefilterter Inhaltstyp ohne Erstellungsrecht

- **WENN** der gefilterte Inhaltstyp nicht angelegt werden darf, aber andere Inhaltstypen angelegt werden dürfen
- **DANN** bleibt der allgemeine Einstieg `Neuer Inhalt` zur Typauswahl verfügbar
- **UND** der Seitenleisten-Button `Inhalt erstellen` führt unabhängig vom Typfilter immer zur Typauswahl

#### Scenario: Survey ist als neuer Inhalt waehlbar

- **WENN** ein berechtigter Benutzer den Flow `Neuer Inhalt` oeffnet
- **DANN** kann er `Survey` oder `Umfrage` als weiteren Inhaltstyp auswaehlen
- **UND** das System fuehrt danach in die Survey-Erstellungsansicht des Standard-Content-Plugins

#### Scenario: Survey-Editor verwendet einen gemeinsamen Rahmen mit modusgerechter Inhaltsanordnung

- **WENN** ein berechtigter Benutzer eine neue Survey anlegt oder eine bestehende Survey bearbeitet
- **DANN** verwendet die Content-Verwaltung fuer beide Faelle denselben Survey-Editor-Rahmen
- **UND** zeigt Create die Eingaben als Onepager ohne Editor-Tabs
- **UND** behält Edit die bestehenden Tabs innerhalb desselben Studio-Arbeitsrahmens

### Requirement: FAQ-Editor folgt dem Standard-Content-Workspace

Das System MUST den FAQ-Editor mit dem etablierten Detail-Workspace der redaktionellen Content-Plugins darstellen. Für eine gespeicherte FAQ MUST der Workspace die Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie` in dieser Reihenfolge anbieten. Der Tab `Basis` MUST Frage und Sprachcode enthalten; der Tab `Inhalt` MUST ausschließlich die fachliche Nur-Text-Antwort enthalten; der Tab `Einstellungen` MUST Sichtbarkeit, Veröffentlichungszeitpunkt und Sortiergewicht enthalten. Der Tab `Historie` MUST die hostgeführte Inhaltshistorie lesbar darstellen. Medien, Kategorien, Orte, Kontakte und weitere nicht zum FAQ-Fachmodell gehörende Bereiche dürfen nicht ergänzt werden.

#### Scenario: Antwort wird im Inhalts-Tab bearbeitet

- **GIVEN** ein Benutzer öffnet eine bestehende FAQ zum Bearbeiten
- **WHEN** er den Tab `Inhalt` auswählt
- **THEN** kann er dort die Nur-Text-Antwort lesen und bearbeiten
- **AND** ist das Antwortfeld nicht im Tab `Basis` oder `Einstellungen` sichtbar

#### Scenario: Neue FAQ zeigt nur passende Fachbereiche

- **WHEN** ein Benutzer eine FAQ anlegt
- **THEN** zeigt das System Frage, Nur-Text-Antwort, Sprachcode, Sortiergewicht, Veröffentlichungszeitpunkt und Sichtbarkeit in dieser Reihenfolge auf einem Onepager ohne Editor-Tabs
- **AND** zeigt es keinen Historie-Tab, bevor eine Inhalts-ID existiert
- **AND** zeigt es keine Medien-, Kategorien-, Orts- oder Kontakt-Tabs

#### Scenario: Historie einer gespeicherten FAQ wird angezeigt

- **GIVEN** eine gespeicherte FAQ und ein Benutzer mit Leseberechtigung
- **WHEN** er den Tab `Historie` öffnet
- **THEN** lädt das System die hostgeführte Inhaltshistorie für die FAQ-ID
- **AND** zeigt Zeitpunkt, Aktion, Actor und Zusammenfassung je vorhandenem Eintrag
- **AND** zeigt es bei fehlenden Einträgen einen verständlichen Leerzustand

#### Scenario: Sprachfassungen werden als eigene FAQ gespeichert

- **GIVEN** eine gespeicherte FAQ mit Sprachcode `de`
- **WHEN** ein Benutzer dieselbe Frage und Antwort mit Sprachcode `en` anlegt
- **THEN** speichert das System einen weiteren eigenständigen FAQ-Datensatz
- **AND** meldet keinen Duplikatkonflikt allein wegen gleicher Frage

#### Scenario: Unvollständige FAQ wird abgewiesen

- **WHEN** eine Frage oder Antwort leer ist
- **THEN** weist das System die Speicherung mit einer feldbezogenen Validierungsmeldung ab
- **AND** verändert keinen bestehenden Datensatz

### Requirement: FAQ- und Kachel-Editoren bleiben fachlich reduziert und verwenden gemeinsame Studio-Flächen

Das System MUST FAQ und Kacheln weiterhin ausschließlich über ihre jeweiligen begrenzten Fachmodelle bearbeiten und MUST ihre Editorflächen zugleich auf den gemeinsamen Studio-Detail-Workspace vereinheitlichen. Die Layoutmigration darf keine fachlichen Felder, Persistenzpfade oder direkten Plugin-Abhängigkeiten ergänzen.

#### Scenario: FAQ wird im standardisierten Editor bearbeitet

- **WHEN** ein Benutzer eine FAQ erstellt oder bearbeitet
- **THEN** verwendet der Editor den gemeinsamen Studio-Detail-Workspace
- **AND** zeigt Create einen fachlich sortierten Onepager ohne Editor-Tabs und Edit die bestehenden Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie`
- **AND** bleiben ausschließlich Frage, Nur-Text-Antwort, Sprachcode, Sortiergewicht, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeitbar
- **AND** bleiben bestehende Mapper, Payload-Erhaltung und Mainserver-Verträge unverändert

#### Scenario: Kachel wird im standardisierten Editor bearbeitet

- **WHEN** ein Benutzer eine Kachel erstellt oder bearbeitet
- **THEN** verwendet der Editor den gemeinsamen Studio-Detail-Workspace
- **AND** zeigt Create einen fachlich sortierten Onepager ohne Editor-Tabs und Edit die bestehenden Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie`
- **AND** gliedert der Inhaltsbereich Text, Bilder und Link in getrennte fachliche Detailkarten
- **AND** bleiben Medienauswahl, Alternativtext, Feldpfade, Mapper, `externalId` und unbekannte technische Payload-Daten unverändert erhalten

#### Scenario: Kachel-Bilder überstehen Bereichswechsel

- **GIVEN** ein Benutzer hat mehrere Kachel-Bilder ausgewählt, sortiert oder mit Alternativtext versehen
- **WHEN** er im Edit-Modus zwischen `Inhalt`, `Basis` und `Einstellungen` wechselt oder im Create-Modus Zusatzabschnitte öffnet und schließt
- **THEN** bleiben Bilder, Reihenfolge und Alternativtexte unverändert im Formular erhalten
- **AND** der Editor erzeugt keine doppelten Medienreferenzen

## ADDED Requirements

### Requirement: Redaktionelle Neuanlage verwendet typgerechte Onepager

Das System SHALL für Nachrichten, Veranstaltungen, POI, generische Inhalte, FAQ, Cockpit-Karten, Projekte und Umfragen die bestehenden Create-Routen als durchgehende Onepager ohne Editor-Tabs darstellen. Feldreihenfolge, Gruppierung und Zusatzabschnitte SHALL den acht typbezogenen Listen des Change-Designs entsprechen. Vorhandene Fachfelder, Pflichtigkeit, Berechtigungen und Mutationsverträge SHALL erhalten bleiben. Neue Orte und Veranstaltungen SHALL mit deaktivierter öffentlicher Sichtbarkeit starten; gespeicherte Werte bleiben unverändert. Die Kategorienverwaltung, Abfallwirtschaft und der generische Kern-Inhaltseditor sind von dieser Layoutmigration ausgeschlossen; vorhandene Kategorienauswahlen und News-Push-Zielgebiete bleiben innerhalb der acht Formulare verfügbar.

#### Scenario: Ein neuer redaktioneller Inhalt wird erfasst

- **GIVEN** ein berechtigter Benutzer öffnet eine der acht bestehenden Create-Routen
- **WHEN** der Editor geladen ist
- **THEN** sind alle bisher sichtbaren zulässigen Eingaben in einem Formular ohne Tabwechsel erreichbar
- **AND** folgen sie der typbezogenen Feldreihenfolge des Designs mit Inhalt vor abschließender Publikation
- **AND** sind technische Historie, Moderation und Ergebnisse nicht als leere Arbeitsbereiche vorhanden

#### Scenario: Bestehender Inhalt wird bearbeitet

- **WHEN** ein Benutzer einen gespeicherten Inhalt der acht Typen öffnet
- **THEN** verwendet der Editor weiterhin die bestehenden Edit-Tabs und deren Fachfunktionen
- **AND** bleiben die vorhandenen Navigationen nach erfolgreicher Anlage unverändert

#### Scenario: Vorhandene reduzierte Fachmodelle bleiben reduziert

- **WHEN** ein Event-, POI-, FAQ- oder News-Onepager gerendert wird
- **THEN** ergänzt er keine bisher ausgeblendeten Modell- oder Legacy-Felder
- **AND** zeigt Events insbesondere keine POI-Verknüpfung, Barrierefreiheitsdaten, Keywords oder Tags
- **AND** bleiben bestehende Erhaltungsregeln für verborgene Daten unverändert

### Requirement: Onepager erhalten Formularzustand und zugängliche Validierung

Das System SHALL vorhandene Feldabschnitte, Formularzustände und Submit-Pfade für Create und Edit wiederverwenden. Zusatzabschnitte SHALL ohne Zustandsverlust auf derselben Seite erreichbar sein; Validierungsfehler SHALL geschlossene betroffene Abschnitte vor dem Fehlerfokus öffnen. Neue Texte SHALL in de/en übersetzt sein und die Darstellung SHALL WCAG 2.1 AA erfüllen.

#### Scenario: Ein Zusatzabschnitt wird geschlossen und erneut geöffnet

- **GIVEN** Eingaben oder ausgewählte Medien in einem Zusatzabschnitt
- **WHEN** der Benutzer den Abschnitt schließt und wieder öffnet
- **THEN** bleiben Werte, Reihenfolge und Medienmetadaten erhalten
- **AND** löst das Umschalten weder Submit noch doppelte Medienreferenzen aus

#### Scenario: Fehler befindet sich in einem geschlossenen Abschnitt

- **GIVEN** ein vorhandener Validator beanstandet ein Feld in einem geschlossenen Zusatzabschnitt
- **WHEN** der Benutzer das Formular absendet
- **THEN** öffnet der Editor den betroffenen Abschnitt vor dem Fokus auf das fehlerhafte Feld
- **AND** sind Fehlermeldung und Feld per Tastatur und gegebenenfalls Fehlerzusammenfassung erreichbar
- **AND** bleiben alle Eingaben nach fehlgeschlagenem Speichern erhalten

#### Scenario: Derselbe Submit-Pfad bleibt erhalten

- **WHEN** der Benutzer die beim Scrollen erreichbare redaktionelle Create-Aktion auslöst
- **THEN** verwendet sie denselben bestehenden Submit-Pfad und dessen Lade-, Disabled- und Berechtigungszustände
- **AND** entstehen keine separaten Abschnitts-Submits oder neuen Persistenzpfade

#### Scenario: Komplexes Formular wird auf schmalem Bildschirm bedient

- **WHEN** ein Benutzer Events, POI, generische Inhalte oder Umfragen auf schmalem Bildschirm öffnet
- **THEN** bleiben Feld-, DOM- und Fokusreihenfolge fachlich identisch zur breiten Darstellung
- **AND** führt die kompakte Sprungnavigation zu sichtbaren Abschnitten ohne Tab- oder Routenwechsel


### Requirement: Redaktionelle Onepager geben aufgabenbezogene Orientierung

Das System SHALL für Nachrichten, Veranstaltungen, POI, FAQ, Cockpit-Karten, Projekte und Umfragen eine kurze typbezogene Einstiegshilfe sowie verständliche Abschnittsnamen und direkt zugeordnete Feldhilfen anbieten. Bestehende Pflichtangaben und optionale Ergänzungen SHALL eindeutig und zugänglich erkennbar sein, ohne Pflichtigkeit oder Validierungen zu verändern; die explizit freigegebenen verborgenen Create-Defaults für Orte und Veranstaltungen gelten. Generische Inhalte bleiben ein technischer Sonderfall ohne redaktionellen Einsteigerflow; die gemeinsamen technischen und Accessibility-Anforderungen gelten weiterhin.

#### Scenario: Ungeschulter Redakteur beginnt einen Inhalt

- **WHEN** ein Redakteur eine der sieben redaktionellen Create-Ansichten öffnet
- **THEN** erklärt eine kurze Einführung Zweck und Einstieg
- **AND** erkennt er Pflichtangaben und optionale Ergänzungen
- **AND** erläutern Hilfen erklärungsbedürftige Felder wie Teaser, Sprachcode, Sortiergewicht und Veröffentlichungsangaben anhand ihrer belegten Bedeutung
- **AND** ersetzen Platzhalter weder Labels noch zugeordnete Hilfen

#### Scenario: Häufig benötigte Ergänzung ist noch leer

- **WHEN** ein Redakteur eine Veranstaltung oder einen Ort erstellt
- **THEN** sind Veranstalter und Eintrittspreise beziehungsweise Öffnungszeiten und Kontakt über direkt sichtbare fachliche Einstiege erreichbar
- **AND** zeigen geschlossene Abschnitte eine aktuelle Zustandszusammenfassung
- **AND** erzeugt das Öffnen allein keine neuen Einträge oder geänderten Defaultwerte
- **AND** bleiben seltene technische Angaben als solche getrennt und standardmäßig geschlossen

### Requirement: Create erklärt die tatsächliche Speicher- und Veröffentlichungswirkung

Das System SHALL unmittelbar bei den abschließenden Aktionen am Formularende die aus bestehenden Einstellungen und Verträgen ableitbare Speicher-, Status- beziehungsweise Veröffentlichungswirkung verständlich erklären. Die Erklärung SHALL auf Änderungen der maßgeblichen Eingaben reagieren. Die redaktionelle Create-Aktion SHALL beim Scrollen erreichbar sein und dieselbe Wirkung durch ihre zustandsabhängige Bezeichnung erkennen lassen. Sie SHALL keine neue Status-, Terminierungs- oder Versandlogik einführen und keine unbelegte Wirkung behaupten.

#### Scenario: Nachrichten-Einstellungen ändern sich

- **WHEN** ein Redakteur zwischen bestehendem Entwurfsmodus, sofortiger oder geplanter Veröffentlichung wechselt
- **THEN** beschreibt die Erklärung die gewählte Wirkung gemäß bestehendem Vertrag
- **AND** nennt sie bei aktiviertem Push die zusätzliche Benachrichtigung und das gewählte Zielgebiet
- **AND** kündigt sie bei deaktiviertem Push keinen Versand an
- **AND** bleiben vorhandene Push-Bestätigungen und Berechtigungen unverändert
- **AND** erklärt ein lokaler Hinweis fachlich erforderliche Rücksetzungen wie den Wegfall von Push bei geplanter Veröffentlichung

#### Scenario: Inhaltstyp besitzt andere Sichtbarkeits- oder Statusregeln

- **WHEN** ein Redakteur einen anderen Inhaltstyp erstellt
- **THEN** beschreibt die Erklärung dessen tatsächlichen bestehenden Vertrag
- **AND** leitet sie aus einem Datumsfeld allein keine Terminierung und aus einem Projektstatus keine unbelegte Veröffentlichung ab
- **AND** verwenden oberer und unterer Submit denselben Formularzustand und eindeutige Aktionsbezeichnungen

### Requirement: Create unterstützt sichere Korrektur und bewusstes Unterbrechen

Das System SHALL Korrekturhinweise an geänderten Darstellungsstellen verständlich formulieren, Eingabenerhalt und bestehende Speicher-/Retry-Zustände bewahren. Die acht Create-Editoren SHALL ihren offenen Änderungszustand über eine schmale React-Anbindung in `@sva/studio-ui-react` an den vorhandenen Host-Rahmen melden. Der Host SHALL für tatsächliche Seitenwechsel den vorhandenen Router-Blocker und Bestätigungsdialog sowie für Schließen/Neuladen den nativen Browsermechanismus soweit unterstützt verwenden. Neue Router-/Guard-Registries, Plugin-SDK-/Manifest-Verträge, Autosave und ein neuer Entwurfsdienst sind ausgeschlossen.

#### Scenario: Speichern schlägt vollständig oder teilweise fehl

- **WHEN** eine Validierung, Anlage oder nachgelagerte Medienzuordnung fehlschlägt
- **THEN** bleiben die Eingaben erhalten und Korrekturhinweise benennen die erforderliche Handlung
- **AND** unterscheiden Rückmeldungen zwischen nicht angelegtem Inhalt und angelegtem Inhalt mit noch ausstehender Medienzuordnung
- **AND** bleibt der vorhandene Retry-Vertrag ohne erneute Anlage erhalten

#### Scenario: Ungespeicherte Änderungen werden verworfen

- **GIVEN** ein Redakteur hat ungespeicherte Create-Eingaben geändert
- **WHEN** er abbricht oder eine unterstützte interne Navigation auslöst
- **THEN** kann er das Verwerfen bestätigen oder zum unveränderten Formularzustand zurückkehren
- **AND** erzeugen unveränderte Formulare, erfolgreiche Speicherung und bestätigtes Verwerfen keine zusätzliche Warnung

#### Scenario: Bestehender Entwurf wird später weiterbearbeitet

- **WHEN** ein Redakteur einen Inhalt über einen bereits vorhandenen Entwurfsmodus erfolgreich anlegt
- **THEN** erklärt die Rückmeldung den bestehenden Weg zum späteren Weiterbearbeiten
- **AND** bleibt die bestehende Navigation erhalten und ein Wechsel in den Edit-Workspace verständlich
- **AND** erhalten Typen ohne vorhandenen Entwurfsmodus keinen neuen Entwurfsstatus


### Requirement: Onepager respektieren Plugin- und Studio-UI-Grenzen

Das System SHALL fachliche Feldkomposition, Hilfetexte und Wirkungsableitung in den zuständigen Plugins halten und gemeinsame Darstellung ausschließlich über öffentliche Bausteine von `@sva/studio-ui-react` komponieren. Hostgeführte Routen, Autorisierung und Speicherverträge SHALL unverändert bleiben. Die Migration SHALL weder App-interne Imports, Abhängigkeiten zwischen Fachplugins noch neue Boundary-Ausnahmen oder parallele Basis-Control-Systeme einführen.

#### Scenario: Fachliche Onepager-Komposition nutzt gemeinsame UI

- **WHEN** ein Plugin seine Create-Ansicht zusammensetzt
- **THEN** nutzt es öffentliche Studio-UI-Bausteine für Layout, Felder, Dialoge, Fehler und Aktionen
- **AND** bleiben Feldfolge, Fachtexte und Statusbedeutungen im zuständigen Plugin
- **AND** enthält die gemeinsame UI keine Imports oder Status-Fallunterscheidungen für diese Fachplugins

#### Scenario: Verlassenswarnung und Save-Aktionen werden integriert

- **WHEN** die Create-Ansicht Warnung, Primäraktionen oder Save-Feedback integriert
- **THEN** verwendet sie bestehende öffentliche SDK-/UI-Verträge und hostgeführte Navigations-/Speicherpfade
- **AND** führt sie keine Imports von Host-Interna, eigene Save-Timer oder parallele Dialog-/Aktionssysteme ein
- **AND** bleibt die neue gemeinsame Anbindung auf einen aktuellen Checker pro Create-Editor ohne Formularwerte im Host begrenzt


### Requirement: Onepager stellen Ausnahmefälle ohne eigene Fehler-Infrastruktur dar

Das System SHALL an den durch den Onepager veränderten Darstellungsstellen bestehende Fehler- und Retry-Verträge erhalten und neue Rückmeldungen verständlich, zugänglich und in de/en darstellen. Die folgenden Szenarien gelten für diese berührten Pfade; sie begründen keine allgemeine Sanierung unveränderter Host- oder Plugin-Fehlerbehandlung. Es SHALL erforderliche Datenladefehler von leeren Ergebnissen unterscheiden und optionale Anreicherungsfehler auf den betroffenen Bereich begrenzen. Die Darstellung SHALL vorhandene Wiederherstellungsaktionen verwenden und keine eigenen Auth-, Logging-, Reconcile- oder Retry-Pfade einführen.

#### Scenario: Servervalidierung oder Referenzkonflikt verhindert das Anlegen

- **WHEN** der bestehende Vertrag einen Feldfehler oder fachlichen Referenzkonflikt meldet
- **THEN** zeigt der Editor die konkrete Korrektur am zuordenbaren Feld beziehungsweise im Formularbereich
- **AND** bleiben Eingaben erhalten und betroffene geschlossene Abschnitte werden vor dem Fehlerfokus geöffnet
- **AND** erfolgt keine automatische Ersetzung oder Entfernung der Referenz

#### Scenario: Laden oder optionale Anreicherung schlägt fehl

- **WHEN** benötigte Auswahldaten oder optionale Anreicherungen nicht geladen werden können
- **THEN** zeigt der betroffene Bereich einen Fehler statt eines scheinbar leeren Ergebnisses
- **AND** bleiben unabhängige Formulareingaben bedienbar
- **AND** werden nur bestehende lokale Wiederholungs- oder manuelle Eingabemöglichkeiten angeboten

#### Scenario: Speicherergebnis ist nach Netzabbruch unbestätigt

- **WHEN** ein Netzabbruch oder Timeout keine eindeutige Bestätigung des Speicherergebnisses zulässt
- **THEN** beschreibt die Rückmeldung die Unsicherheit ohne falsche Erfolgs- oder Misserfolgsbehauptung
- **AND** wird keine erneute Anlage auf Verdacht ausgelöst
- **AND** stehen ausschließlich die vom bestehenden Hostvertrag sicher unterstützten Folgeaktionen zur Verfügung

#### Scenario: Sitzung, Berechtigung oder unerwarteter Fehler verhindert die Fortsetzung

- **WHEN** der vorhandene Hostvertrag einen Auth-, Berechtigungs- oder unerwarteten Fehler meldet
- **THEN** beschreibt die UI einen verständlichen nächsten Schritt gemäß bestehendem Vertrag
- **AND** zeigt sie keine Roh-Exceptions, Stacktraces oder sensiblen Daten
- **AND** verspricht sie keine Wiederherstellung ungespeicherter Eingaben nach Login oder Reload ohne bestehenden Nachweis
- **AND** sind Fehlerrückmeldungen am relevanten Bereich zugänglich wahrnehmbar und nicht ausschließlich flüchtige Toasts

#### Scenario: Submit läuft bereits

- **WHEN** das Anlegen über den bestehenden Submit-Auslöser läuft
- **THEN** ist erneutes Absenden über den bestehenden Zustand gesperrt
- **AND** folgen Erfolg und Navigation ausschließlich dem bestätigten Ergebnis


#### Scenario: News wurde angelegt, aber die Weiterleitung schlägt fehl

- **WHEN** der bestehende News-Save-Pfad eine bestätigte Anlage mit fehlgeschlagener Navigation meldet
- **THEN** bleibt die bestehende Rückmeldung mit Öffnen-Aktion für die gespeicherte ID erhalten
- **AND** wird keine erneute Anlage angeboten und ein angebundener Verlassensschutz behandelt den Save als bestätigt

#### Scenario: Sprungnavigation wird bei geänderten Eingaben verwendet

- **WHEN** ein Redakteur einen Abschnittssprung innerhalb des Formulars aktiviert
- **THEN** löst der Sprung keine Verlassenswarnung aus
- **AND** liegt das native Sprungziel auf einer sichtbaren Überschrift beziehungsweise einem Klapptrigger und ermöglicht eine nachvollziehbare Tastaturfortsetzung


#### Scenario: Weitere Eingaben entstehen während Save oder Medien-Retry

- **GIVEN** der bestehende Save-Pfad hat den Änderungsstand vor dem Request lokal erfasst
- **WHEN** während des Requests weitere Formular- oder Medienänderungen entstehen
- **THEN** bestätigt ein erfolgreicher Request ausschließlich den ursprünglichen Stand
- **AND** bleiben neuere Eingaben unverändert und durch die Verlassenswarnung geschützt
- **AND** setzt ein Medien-Referenz-Retry keine späteren Fachänderungen als gespeichert zurück

#### Scenario: Bestätigte Anlage wird nicht erneut erzeugt

- **WHEN** ein Create-Request die angelegte ID bestätigt, aber die Weiterleitung fehlschlägt oder abgebrochen wird
- **THEN** bleibt eine zweite Create-Mutation gesperrt
- **AND** bietet der bestehende Statusbereich einen Link zur vorhandenen Edit-Route des gespeicherten Inhalts
- **AND** durchläuft dieser Link bei weiteren offenen Änderungen dieselbe Verlassenswarnung

#### Scenario: Redaktioneller Einstieg mit erreichbarer Speicherwirkung

- **WHEN** ein Redakteur einen der sieben redaktionellen Inhaltstypen neu anlegt
- **THEN** stehen Titel und Kernaufgabe vor optionalen Ergänzungen
- **AND** bleibt die bestehende Speicheraktion mit ihrer tatsächlichen Wirkung beim Scrollen erreichbar
- **AND** erscheint eine feste verantwortliche Identität als Text, während mehrere Identitäten auswählbar bleiben
- **AND** werden Zusatzbereiche bei einem zugeordneten Validierungsfehler geöffnet, ohne Eingaben zu verlieren

#### Scenario: Abhängige Optionen ohne Wertverlust

- **WHEN** eine neue Nachricht nicht sofort veröffentlicht wird
- **THEN** bleiben Push-Controls verborgen und der bestehende Rücksetzvertrag gilt
- **AND** erscheint die Zielgebietsauswahl erst bei aktiviertem Push
- **WHEN** bei einer neuen Umfrage die Ergebnisanzeige ausgeschaltet wird
- **THEN** bleibt die Ergebnisfreigabe verborgen, ihr eingegebener Wert aber erhalten
- **AND** bleiben Anonymität sowie Datenschutz- und Transparenzhinweise direkt zugänglich
