## ADDED Requirements

### Requirement: Vollständiger gemeinsamer Bildeditor

Das System SHALL in Mediathek und gemeinsamem Medienpicker denselben vollständigen Editor für Zuschnitt, Seitenverhältnisse, Rotation, Spiegelung, Bildanpassungen, Filter, Text, Annotationen, Undo/Redo und Zurücksetzen anbieten, ergänzt um Fokuspunkt und Vorschau bestehender Standardvarianten.

#### Scenario: Bearbeitung und Variantenvorschau

- **WHEN** ein Redakteur ein vorhandenes oder neues lokales Bild bearbeitet
- **THEN** kann er den gesamten vereinbarten Werkzeugumfang verwenden
- **AND** beziehen sich Fokuspunkt und Variantenvorschau auf die fertig bearbeitete Ausgabe
- **AND** wird ein Editorzuschnitt bei der Variantenerzeugung nicht doppelt angewendet
- **AND** sind die aktivierten Funktionen übersetzt
- **AND** gilt für die spezialisierte Filerobot-Werkzeug-/Canvas-Oberfläche die dokumentierte Accessibility-Abweichung aus ADR-069

#### Scenario: Werkzeuge ohne Fachwissen finden

- **WHEN** ein ungeschulter Redakteur den Bildeditor öffnet
- **THEN** sind Zuschneiden, Drehen und Bildanpassung direkt auffindbar und weitere Werkzeuge beschriftet erreichbar
- **AND** sind vollständiges Zurücksetzen und Rückgängigmachen eines Schritts unterscheidbar
- **AND** erläutert die Oberfläche den wichtigen Bildbereich und benennt Vorschauen nach ihrer Form
- **AND** weist sie auf mögliche abgeschnittene Texte oder Markierungen hin, ohne die Darstellung aller Ausgabekanäle zu garantieren

#### Scenario: Redaktion entscheidet eigenverantwortlich

- **WHEN** ein Redakteur Text, Markierungen, Filter oder Bildanpassungen verwendet
- **THEN** bleiben diese Werkzeuge im vereinbarten Umfang frei nutzbar
- **AND** sind Hinweise zu Informationswert, Bildqualität und Bildrechten nicht blockierend und benötigen keine zusätzliche Pflichtbestätigung
- **AND** entstehen keine neue OCR-/Moderationsprüfung, Pflichtfelder oder Freigabestufen
- **AND** bleiben bestehende Rechte, Zielverträge und fachliche Validierungen verbindlich

#### Scenario: Accessibility-Abweichung begrenzen und sichtbar machen

- **WHEN** die Editorintegration abgenommen wird
- **THEN** werden die bekannten Einschränkungen der Filerobot-Werkzeugnavigation und Canvas-Objektbedienung nach ADR-069 als akzeptierte Abweichung dokumentiert, nicht als bestandene Barrierefreiheitsprüfung
- **AND** wird die Einschränkung am Einstieg und bei Umsetzung im bestehenden Accessibility Statement ohne zusätzliche Pflichtbestätigung benannt
- **AND** behalten Studio-eigene Dialograhmen, Metadatenformulare, Status, Variantenprüfung und Abschlussaktionen ihre vollständigen bisherigen Accessibility-Anforderungen einschließlich der Theme-, Textvergrößerungs-, Reflow- und Kontrastprüfungen
- **AND** bleiben normale Auswahl, Upload und Verwendung eines unverändert übernommenen Bildes ohne Öffnen des Spezialeditors verfügbar
- **AND** entsteht kein eigener Accessibility-Fork oder paralleler Objekteditor
- **AND** erläutert ein nicht blockierender Hinweis die textliche Zugänglichkeit relevanter Bildinformationen im Inhaltskontext

### Requirement: Nicht destruktive und weiterbearbeitbare Medienkopien

Das System SHALL jede gespeicherte Bildbearbeitung als neues Asset mit gerenderter Ausgabe, dauerhaft zugeordneter unveränderter Bearbeitungsgrundlage und versioniertem Editorzustand speichern, ohne vorhandene Medien oder ihre Verwendungen zu ersetzen.

#### Scenario: Kopie speichern und erneut bearbeiten

- **WHEN** ein Redakteur eine Bildbearbeitung speichert und später erneut öffnet
- **THEN** bleiben Texte, Annotationen und Einstellungen einzeln veränderbar
- **AND** verwendet die Auslieferung das fertig gerenderte Bild und seine Varianten
- **AND** bleiben Original sowie bereits vorhandene Kopien und Verwendungen unverändert
- **AND** werden inkompatible Zustände ausdrücklich gemeldet statt still verworfen

#### Scenario: Metadaten für die Kopie übernehmen

- **WHEN** eine bearbeitete Kopie vorbereitet wird
- **THEN** übernimmt sie Copyright, Lizenz, Tags, Beschreibung und Alternativtext
- **AND** erhält sie einen bearbeitbaren lokalisierten Titelvorschlag mit Zusatz „Bearbeitet“
- **AND** zeigt das System Beschreibung und Alternativtext zur Prüfung an
- **AND** häuft der automatische Titelvorschlag bei wiederholter Bearbeitung den Zusatz nicht an
- **AND** helfen Vorschau und Erstellungszeitpunkt beim Unterscheiden der Kopien

#### Scenario: Erforderliche Bearbeitungsgrundlage löschen

- **WHEN** eine Datei als Grundlage einer weiterbearbeitbaren Kopie benötigt wird
- **THEN** verhindert der Löschpfad ihre Entfernung auch bei konkurrierendem Kopienspeichern
- **AND** entfernt das Löschen einer Kopie keine noch benötigte gemeinsame Grundlage
- **AND** erklärt die Oberfläche die Bearbeitungsabhängigkeit auch ohne Inhaltsverwendungen und verlinkt berechtigt lesbare betroffene Kopien

### Requirement: Bearbeitungsentwürfe respektieren den vorhandenen Speicherlebenszyklus

Das System SHALL bearbeitete Medien im Inhaltseditor bis zum Content-Speichern lokal halten und danach über die vorhandene provisorische Content-Save-Operation persistieren; eigenständiges Kopienspeichern in der Mediathek SHALL den vorhandenen Bibliothekslebenszyklus verwenden.

#### Scenario: Lokales Ergebnis ohne vorzeitigen Upload übernehmen

- **WHEN** ein Redakteur eine fertig gerenderte lokale Bildbearbeitung im Inhaltseditor übernimmt
- **THEN** übernimmt die verständlich benannte Aktion nur den lokalen Entwurf ins Formular
- **AND** zeigt das Formular an, dass das Bild mit dem Inhalt gespeichert wird
- **AND** setzt diese lokale Übernahme keinen Serverupload oder serverseitigen Ready-Status voraus
- **AND** bleibt die dauerhafte Freigabe an den bestehenden Verarbeitungs- und Content-Save-Abschluss gebunden

#### Scenario: Bearbeitung in der Mediathek speichern

- **WHEN** ein Redakteur die Aktion „Als neues Bild speichern“ in der Mediathek ausführt
- **THEN** startet die Speicherung einer neuen Kopie im Bibliothekslebenszyklus
- **AND** bestätigt die Oberfläche den Erfolg erst nach dem erforderlichen Speicher- und Verarbeitungsabschluss
- **AND** bleiben bestehende Inhaltsverwendungen unverändert

#### Scenario: Waste-Branding verwendet die gemeinsame Bildbearbeitung

- **WHEN** ein berechtigter Redakteur ein bearbeitetes Bild für Waste-Branding übernimmt
- **THEN** speichert die ausdrücklich benannte Aktion die neue öffentliche Kopie unmittelbar über den bestehenden Bibliotheksupload
- **AND** wählt sie die persistente öffentliche URL im Settings-Formular aus
- **AND** wird die Konfiguration erst mit dem vorhandenen Settings-Speichern geändert
- **AND** entstehen weder Mainserver-Content-Save-Operationen noch neue behauptete Inhaltsreferenzen

#### Scenario: Änderungen im Bildeditor verwerfen

- **WHEN** ein Redakteur die aktuelle Bildbearbeitung abbricht
- **THEN** bleibt das zuvor ausgewählte Bild samt vorherigem Formularentwurf erhalten
- **AND** werden nur die Änderungen der abgebrochenen Editorsitzung verworfen

#### Scenario: Inhaltsbearbeitung abbrechen

- **WHEN** ein Redakteur ein neues lokales Bild oder eine bearbeitete Kopie im Inhalt auswählt und vor dem Speichern abbricht
- **THEN** existieren aus diesem Entwurf keine neu angelegten Servermedien
- **AND** bleiben vorhandene Medien und Referenzen erhalten
- **AND** werden lokale Vorschauressourcen freigegeben

#### Scenario: Kopie im Inhalt speichern

- **WHEN** ein Redakteur den Inhalt mit einer bearbeiteten Kopie speichert
- **THEN** persistiert der bestehende Operationspfad Grundlage, Zustand und Ausgabe konsistent
- **AND** wird nur die betreffende Formularverwendung mit dem regulären Content-Speichern geändert
- **AND** gelten vorhandene Regeln für unklaren externen Erfolg, Recovery und Cleanup weiter

#### Scenario: Verarbeitung oder Speicherung schlägt fehl

- **WHEN** Rendern, Upload oder Verarbeitung fehlschlägt
- **THEN** bleibt der geöffnete Browserentwurf für eine bewusste Wiederholung erhalten
- **AND** werden unvollständige Kopien nicht regulär auswählbar
- **AND** veröffentlicht die Wiederholung desselben Speicherversuchs keine doppelten Kopien
- **AND** benennt die Oberfläche den tatsächlichen Arbeitsschritt und unterscheidet Fehler der Bild- und Inhaltsspeicherung

#### Scenario: Speicherergebnis ist unklar

- **WHEN** das Ergebnis eines Content-Speichervorgangs nicht sicher bekannt ist
- **THEN** klärt der bestehende Operationspfad den Status vor einem neuen Speicherversuch
- **AND** behauptet die Oberfläche weder fälschlich Erfolg noch einen sicheren Fehlschlag

#### Scenario: Ungespeicherten Entwurf verlassen

- **WHEN** ein Redakteur das Formular mit ungespeicherten Bild- oder Inhaltsänderungen verlassen will
- **THEN** warnt der vorhandene Formularschutz vor dem Verlust
- **AND** verspricht das System keine Wiederherstellung lokaler Bildentwürfe nach Browserabsturz oder Reload

### Requirement: Bearbeitungsdaten erhalten die bestehenden Schutzgrenzen

Das System SHALL für Grundlage, Editorzustand, Ressourcen und Ausgaben Instanzbindung, Berechtigungen, Inhalts-/Größenvalidierung, aktive Scan-Regeln, Speicherquote und sichere Bereinigung im bestehenden Medienpfad durchsetzen.

#### Scenario: Geschützte Quelle bearbeiten

- **WHEN** ein berechtigter Redakteur aus einer geschützten Quelle eine Kopie erstellt
- **THEN** übernimmt die Kopie deren geschützte Sichtbarkeit
- **AND** gelangen weder Quelle noch private Bearbeitungsdaten in öffentliche Nebenpfade oder Bucket-Importe
- **AND** ersetzt eine Kopienberechtigung nicht die Prüfung des Quellzugriffs

#### Scenario: Zustand oder zusätzliche Datei ist ungültig

- **WHEN** ein Editorzustand oder eine zusätzliche Datei Grenzen überschreitet oder unzulässige Ressourcen enthält
- **THEN** wird die Speicherung verständlich abgewiesen
- **AND** bleiben bestehende Assets unverändert
- **AND** enthalten Logs keine Bildinhalte, Annotationstexte oder vollständigen Editorzustände

#### Scenario: Öffentliche Ausgabe und Editorzugriff trennen

- **WHEN** eine bearbeitete Kopie ausgeliefert, ausgewählt oder erneut bearbeitet wird
- **THEN** enthalten öffentliche Bildausgaben und Varianten keine privaten Grundlagen, Editorzustände oder ungefragt übernommenen eingebetteten EXIF-/IPTC-/XMP-/Standortdaten
- **AND** geben gewöhnliche Detail-/Picker-Antworten private Editorzustände nicht ungefiltert weiter
- **AND** prüft der Editorzugriff den tatsächlichen Quellzugriff zusätzlich zum Zugriff auf die Kopie
- **AND** bleiben CSRF- und erneute serverseitige Berechtigungsprüfungen für Mutationen erhalten

#### Scenario: Editor ohne zusätzliche Datenübertragung betreiben

- **WHEN** der Editor einschließlich Textwerkzeugen und erneutem Öffnen verwendet wird
- **THEN** werden Editor und freigegebene Ressourcen kontrolliert bereitgestellt
- **AND** gehen Bildbytes, Editorzustand und Annotationstexte nicht an externe Dienste
- **AND** werden keine CSP-/CORS-Grenzen allein für die Library gelockert
- **AND** belegen Datei- und Netzwerkprüfung diese Anforderungen

#### Scenario: Überdecken oder Weichzeichnen verwenden

- **WHEN** ein Redakteur Bildinformationen überdeckt, zuschneidet oder weichzeichnet
- **THEN** erklärt ein kontextbezogener Hinweis, dass die unveränderte Grundlage erhalten bleibt und dies keine sichere Anonymisierung ist
- **AND** bleiben die Werkzeuge ohne zusätzliche Pflichtbestätigung nutzbar
- **AND** bleibt eine bereits öffentliche Quelle unverändert öffentlich

#### Scenario: Bestehenden Datenschutzprozess auf Bearbeitungsdaten anwenden

- **WHEN** ein kontrollierter Lösch- oder Auskunftsvorgang ein bearbeitetes Medium betrifft
- **THEN** sind seine Grundlagen, Kopien, Zustände und Ressourcen im bestehenden Prozess zuordenbar
- **AND** berücksichtigt die kontrollierte Auflösung aktive Inhaltsreferenzen und weitere bestehende Löschhürden
- **AND** entstehen keine automatische Kaskadenlöschung oder unbegrenzte Aufbewahrungserlaubnis allein durch Weiterbearbeitbarkeit

#### Scenario: Zusätzlichen Speicher abrechnen

- **WHEN** eine Bearbeitung neue Original-, Zustands-, Ressourcen- oder Ausgabedateien speichert
- **THEN** werden tatsächlich neu gespeicherte Bytes genau einmal gegen die bestehende harte Quote gebucht
- **AND** ziehen Wiederholung und Cleanup keine nie gebuchten Bytes ab
- **AND** bleibt eine gemeinsam genutzte Grundlage bis zur letzten erforderlichen Abhängigkeit erhalten

### Requirement: Vorhandene Quellen- und Plugin-Verträge bleiben erhalten

Das System SHALL die vorhandenen Quelltypen, fachlichen Felder, Plugin-Actions und zulässigen Ausgabeziele bei der gemeinsamen Bildbearbeitung bewahren.

#### Scenario: Manuelle URL oder geschütztes Medium im Inhaltseditor

- **WHEN** ein Redakteur eine manuelle Bild-URL verwendet oder eine geschützte Bibliothekskopie auswählen möchte
- **THEN** bleibt die manuelle URL-Eingabe mit der bestehenden Content-Berechtigung ohne zusätzliche Bibliotheksrechte nutzbar
- **AND** wird daraus kein automatischer Remote-Import oder Editorabruf
- **AND** werden geschützte Assets und kurzlebige signierte URLs im bestehenden öffentlichen Content-/Branding-Zielvertrag nicht übernommen
- **AND** wird keine Quelle automatisch öffentlich gemacht

#### Scenario: Fachliche Medienfelder erhalten

- **WHEN** News, Events, POI, Generic Items, Projects, Cockpit Cards oder Waste die gemeinsame Integration verwenden
- **THEN** bleiben ihre jeweiligen Rollen, tatsächlich unterstützten Felder und fachlichen Actions erhalten
- **AND** entstehen keine neuen Mainserver-Felder oder pluginfremden Namespace-Actions zur optischen Vereinheitlichung

## MODIFIED Requirements

### Requirement: Redaktionelle und technische Metadaten

Das System SHALL technische und redaktionelle Metadaten getrennt, aber gemeinsam verwaltbar halten, globale Asset-Metadaten von contentbezogenen Verwendungsmetadaten unterscheiden und Metadaten beim Erstellen neuer Medien nicht mit Änderungen vorhandener Assets gleichsetzen.

#### Scenario: Redaktion pflegt globale Asset-Metadaten

- **WHEN** ein Redakteur mit `media.update` zentrale Angaben eines bestehenden Mediums ausdrücklich speichert
- **THEN** kann er Titel, Beschreibung, Alt-Text, Copyright, Lizenz und Tags am `MediaAsset` pflegen
- **AND** bleiben technische Metadaten wie MIME-Type, Größe oder Abmessungen systemseitig nachvollziehbar
- **AND** werden bestehende Content-Snapshots nicht automatisch überschrieben
- **AND** bleibt die ausdrücklich gespeicherte Änderung bei späterem Content-Abbruch bestehen

#### Scenario: Review ohne globale Änderungsberechtigung

- **WHEN** ein Redakteur ein bestehendes Asset mit `media.read` und `media.reference.manage`, aber ohne `media.update` überprüft
- **THEN** zeigt der Review dessen globale Asset-Metadaten schreibgeschützt
- **AND** darf der Redakteur das Asset bei ansonsten erfülltem Zielvertrag übernehmen und seine contentbezogenen Angaben mit der fachlichen Content-Berechtigung bearbeiten

#### Scenario: Neue Content-Datei lokal prüfen und übernehmen

- **WHEN** ein Benutzer eine neue lokale Datei oder bearbeitete Kopie im Content-Kontext aufnimmt
- **THEN** findet die Prüfung von Bild und Metadaten vor dem Upload im lokalen Entwurf statt
- **AND** gibt ein ausdrückliches Übernehmen den Entwurf in das Formular zurück, ohne dabei ein Servermedium anzulegen
- **AND** werden Metadaten der neuen Kopie erst im autorisierten Create-/Content-Save-Pfad gespeichert
- **AND** ist dafür keine Änderungsberechtigung am ursprünglichen bestehenden Asset erforderlich
- **AND** bleiben fachliche Content-Rechte, erforderliche Medienrechte und vollständige serverseitige Verarbeitung vor dauerhafter Nutzung verbindlich

#### Scenario: Angaben nur für den aktuellen Inhalt ändern

- **WHEN** ein Redakteur Verwendungsangaben im Inhaltsformular ändert oder eine Bildauswahl übernimmt
- **THEN** werden diese Angaben erst mit dem Inhalt gespeichert
- **AND** verändert die gewöhnliche Übernahme keine zentralen Metadaten nebenbei

#### Scenario: Zentrale Angaben im aktuellen Formular weiterverwenden

- **WHEN** ein Redakteur über die separat gekennzeichnete Mediathek-Aktion zentrale Angaben speichert
- **THEN** erklärt die Oberfläche deren Geltungsbereich und bietet passende Werte zur selektiven Übernahme in das aktuelle Inhaltsformular an
- **AND** überschreibt sie keine eigenen Formularangaben ohne ausdrückliche Auswahl
- **AND** werden Verwendungsfelder verständlich dem aktuellen Inhalt zugeordnet
