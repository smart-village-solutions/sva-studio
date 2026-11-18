## MODIFIED Requirements

### Requirement: Bild-Fokuspunkt und Zuschnitt

Das System SHALL den Bildfokus als normalisiertes Metadatum speichern und unverändert über den bestätigten Medien-/Content-Übergabevertrag an Zielanwendungen liefern. Die Zielanwendung SHALL über dessen Auswertung entscheiden können. Explizite Bildoperationen SHALL davon getrennt bleiben; allein eine Fokusänderung SHALL weder Bildpixel noch ausgelieferte Dateien ändern oder eine neue Medien-ID erfordern.

#### Scenario: Redaktion ändert Fokus am bestehenden Bild

- **WHEN** eine mit `media.update` berechtigte Person Texte und Fokus eines bestehenden Bildes ändert und speichert
- **THEN** werden diese Angaben gemeinsam am bestehenden Medium gespeichert
- **AND** sind die normalisierten Koordinaten nach unabhängigem Neuladen unverändert verfügbar
- **AND** bleiben Medien-ID, Originaldatei und bestehende Referenzen erhalten
- **AND** wird keine Varianten-Neuberechnung allein durch die Fokusänderung ausgelöst

#### Scenario: Fokus wird auf der tatsächlichen Bildfläche bedient

- **WHEN** eine Person den Fokus per Klick, Ziehen, Touch oder Tastatur verändert
- **THEN** beziehen sich die validierten Koordinaten auf die orientierte Bildfläche
- **AND** erzeugen freie Ränder der eingepassten Vorschau keine falschen Koordinaten
- **AND** bleiben Fokus, Position und Rückmeldung auch bei Größenwechsel und Zoom nachvollziehbar

#### Scenario: Fokus wird entfernt oder auf die Mitte gesetzt

- **WHEN** die Person den Fokus ausdrücklich entfernt oder die Bildmitte auswählt
- **THEN** unterscheidet der Speichervertrag entfernten Fokus von `{ x: 0.5, y: 0.5 }`
- **AND** wird dieser Unterschied beim Readback erhalten
- **AND** führt eine neutrale Vorschau eines Bildes ohne Fokus nicht selbst zu einer Speicherung

#### Scenario: Zielanwendung erhält Fokusmetadaten

- **WHEN** ein gespeichertes Bild über den tatsächlich verwendeten Medien-/Content-Vertrag an eine Zielanwendung übergeben wird
- **THEN** sind die zugehörigen Fokusmetadaten unverändert verfügbar und werden nicht in Adaptern still verworfen
- **AND** darf die Zielanwendung sie ignorieren oder layoutabhängig auswerten
- **AND** bleiben eigenständige Inhaltsangaben erhalten
- **AND** sind Studio-Vorschauen als unverbindliche Beispiele erkennbar

#### Scenario: Redaktion führt eine tatsächliche Bildoperation aus

- **WHEN** ein Bild zugeschnitten, gedreht oder gespiegelt wird
- **THEN** entsteht das dauerhaft gespeicherte Ergebnis als eigenständige Kopie nach ausdrücklichem Abschluss
- **AND** bleiben das Original und seine bestehenden Verwendungen unverändert
- **AND** bezieht sich der separat gespeicherte Fokus auf das tatsächlich exportierte Ergebnis
- **AND** wird der Fokusmarker nicht in die exportierten Pixel eingebrannt

## ADDED Requirements

### Requirement: Redaktionelle Bilddetailansicht

Das System SHALL vorhandene Bilder mit vollständiger unverzerrter Bildbühne und darunterliegenden Angaben, Beispielansichten und verständlichen Verwendungen darstellen. Es SHALL das Figma-Konzept als konzeptionelle Grundlage im bestehenden Studio-Designsystem umsetzen; technische Informationen SHALL nachgeordnet und handlungsrelevante Sperren sichtbar sein.

#### Scenario: Bestehendes Bild öffnen

- **WHEN** eine berechtigte Person die Bilddetails öffnet
- **THEN** sieht sie zuerst Bildname, Sichtbarkeit und vollständiges Bild
- **AND** kann sie mit passendem Recht Texte und Fokus direkt gemeinsam speichern
- **AND** startet nur die getrennte Aktion „Kopie erstellen und bearbeiten“ den Kopie-Ablauf
- **AND** zeigen bestätigte Verwendungen verständliche Inhaltsbezüge mit erlaubten Navigationszielen

#### Scenario: Geringe Fenstergröße

- **WHEN** Bilddetails oder Kopie-Workflow bei geringer Höhe, schmaler Breite oder Browserzoom bedient werden
- **THEN** bleiben die Hauptaktionen erreichbar und fokussierte Elemente werden nicht verdeckt
- **AND** folgt die Reihenfolge weiterhin Bild vor Angaben
- **AND** bleiben Studio-Rahmen und Fokusbedienung per Tastatur nutzbar

### Requirement: Dreistufiger Kopie-Entwurf

Das System SHALL den bestehenden Bildeditor in die aufeinanderfolgenden Schritte „Bild gestalten“, „Fokuspunkt setzen“ und „Ergebnis prüfen“ einbetten. Es SHALL den aktiven Entwurf beim Zurückgehen erhalten und erst beim ausdrücklichen Speicherabschluss eine dauerhafte Kopie erzeugen. Bestehende kontextspezifische Content-/Settings-Speicherverträge SHALL erhalten bleiben.

#### Scenario: Kopie bearbeiten und prüfen

- **WHEN** eine Person den Kopie-Ablauf öffnet und die Schritte durchläuft
- **THEN** entsteht zunächst kein dauerhaftes neues Medium
- **AND** erhält Zurückgehen Bildoperationen, Metadaten und den zum Ergebnis passenden Fokus
- **AND** werden nach erneut veränderten Bildoperationen überholte Fokuskoordinaten kontrolliert zurückgesetzt und erneut überprüfbar
- **AND** sind Studio-Hauptaktionen außerhalb der inneren Scrollfläche erreichbar

#### Scenario: Speichern, Fehler und Wiederholung

- **WHEN** die Person eine Kopie ausdrücklich speichert
- **THEN** verwendet der Abschluss den bestehenden Upload-/Claim-/Recovery-Pfad
- **AND** öffnet bestätigter Erfolg die neue Medienidentität
- **AND** erzeugen Wiederholung und parallele Bestätigung keine zweite Kopie
- **AND** gibt ein Fehler keine scheinbar fertige Kopie frei
- **AND** bleiben Originaldatei, Originalmetadaten und ursprüngliche Referenzen unverändert

#### Scenario: Inhaltsentwurf und Abbruch

- **WHEN** ein bearbeitetes Bild in einem Inhaltsformular übernommen oder ein ungespeicherter Kopie-Entwurf verworfen wird
- **THEN** bleibt die Übernahme bis zum Content-Speichern lokal
- **AND** schützt die bestehende Verlustbestätigung ungespeicherte Änderungen
- **AND** legt Abbrechen vor dem Speichern keine dauerhafte Kopie an
- **AND** werden technische Teilübertragungen über den vorhandenen Bereinigungspfad behandelt

### Requirement: Sichere automatische Aufnahme vorhandener Bilddateien

Das System SHALL geeignete vorhandene Speicherdateien beim bewussten autorisierten Öffnen über eine explizite Mutation des bestehenden Medienpfads automatisch aufnehmen können. Es SHALL dabei serverseitig Sichtbarkeit, tatsächlichen Dateiinhalt, Quellidentität, Scanpflicht, Instanzbindung und Kontingent prüfen. Die Aufnahme SHALL unter Wiederholung und Konkurrenz genau eine verwaltete Medienidentität und eine erfolgreiche Quotenbuchung erzeugen.

#### Scenario: Bewusstes Öffnen mit Erstellrechten

- **WHEN** eine Person mit den nötigen Lese- und Erstellrechten eine geeignete vorhandene Datei aus der aktiven eigenen S3-Schnittstelle bewusst öffnet
- **THEN** startet eine explizite serverseitige Aufnahme ohne manuellen Browser-Upload
- **AND** wird die vom Nutzer freigegebene öffentliche Auslieferbarkeit ausschließlich aus der serverseitig aufgelösten eigenen Schnittstelle übernommen; ENV-Fallback und sonstige Quellen sind ausgeschlossen
- **AND** zeigt derselbe Detailrahmen den Vorbereitungszustand
- **AND** werden Aktionen für ein fertiges Medium erst nach bestätigter Aufnahme freigegeben
- **AND** bleiben vorhandene URLs, Einbettungen und Originaldatei unverändert

#### Scenario: Lesemodus und Prefetch

- **WHEN** eine Person ohne Erstellrechte eine zulässige Vorschau öffnet oder ein GET-/Listen-/Prefetch-Aufruf erfolgt
- **THEN** löst dies keine Aufnahme und keine Quotenbuchung aus
- **AND** bleibt fehlendes Erstellrecht ein verständlicher Lesemodus

#### Scenario: Datei ist ungeeignet oder nicht sicher prüfbar

- **WHEN** Sichtbarkeit unklar, Inhalt ungültig, Quote erschöpft, Quelle fremd oder eine erforderliche Prüfung nicht erfolgreich ist
- **THEN** wird keine fertige Medienidentität freigegeben
- **AND** zeigt die Oberfläche einen konkreten blockierten oder fehlgeschlagenen Zustand mit zulässiger nächster Handlung
- **AND** umgehen interne Grundlagen, Quarantänedateien und generierte Varianten nicht den Ausschluss aus der Aufnahme

#### Scenario: Quelle ändert sich oder Aufnahme wird wiederholt

- **WHEN** eine Quelle zwischen Prüfung und Finalisierung ausgetauscht oder die Aufnahme parallel beziehungsweise erneut angefordert wird
- **THEN** wird kein geändertes Quellobjekt unter einem veralteten Prüfergebnis freigegeben
- **AND** verwenden Wiederholungen dieselbe Aufnahmeidentität und erzeugen weder doppelte Assets noch doppelte Quotenbuchungen
- **AND** können Teilfehler über den vorhandenen Recovery-Pfad fortgesetzt oder bereinigt werden
- **AND** verwerfen Navigation und Instanzwechsel überholte UI-Antworten
