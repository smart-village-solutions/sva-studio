# Designkonzept: Medien verstehen, bearbeiten und verwenden

## Status und Ziel

Textlicher Gestaltungsvorschlag zur Nutzerprüfung, auf Grundlage des abgestimmten [fachlichen Entwurfs](./design.md). Keine UI-Implementierung und kein durchgeführter Nutzertest. Auf Wunsch des Nutzers entstehen keine Browsermockups.

Die Gestaltung richtet sich an gelegentliche, ungeschulte Redakteure. Jede Ansicht beantwortet drei Fragen: Welches Bild bearbeite ich? Wo wirken meine Änderungen? Was passiert beim nächsten Klick? Das Bild ist der visuelle Mittelpunkt; Speicherwirkung und Kontext bleiben sichtbar.

Die Redaktion entscheidet eigenverantwortlich über Gestaltung und Informationsgehalt. Kurze Hinweise ersetzen keine Schulung, werden aber auch nicht zu Pflichtbestätigungen. Es gibt keine neuen Freigaben, automatisch bewerteten Bildqualitäten, OCR-Prüfungen oder pauschalen Pflichtfelder. Nur bestehende fachliche Validierungen und technische Schutzgrenzen können einen Abschluss verhindern.

## 1. Gestalterische Richtung

Ruhige redaktionelle Arbeitsfläche innerhalb des vorhandenen Studio-Designs: große unverfälschte Vorschau, klare Typografie, kompakte beschriftete Werkzeuge und zurückhaltende Flächentrennung. Die Eigenständigkeit entsteht durch Bildraum und verständliche Informationshierarchie, nicht durch neue Farben, Schriften oder dekorative Effekte.

| Element    | Gestaltung                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Rahmen     | Bestehende Studio-Shell, Seitentitel und Navigation beibehalten                                                             |
| Flächen    | Vorhandene semantische Tokens für Hintergrund, Karte, gedämpfte Flächen und Rahmen                                          |
| Typografie | Bestehende Studio-Schrift; Seitentitel, Bereichstitel, Feldlabel und Hilfetext klar abgestuft                               |
| Abstände   | Vorhandene Abstands- und Radius-Skala; wenige zusammenhängende Bereiche statt einer Karte je Feld                           |
| Akzent     | Vorhandene Primärfarbe für die führende Aktion und aktive Werkzeuge                                                         |
| Zustände   | Text und Symbol ergänzen Farbe; Fehlerfarbe nur für Fehler oder destruktive Aktionen                                        |
| Bildfläche | Neutraler Hintergrund; vollständiges Bild standardmäßig eingepasst, keine unbeabsichtigte Beschneidung durch die Oberfläche |
| Bewegung   | Kurze funktionale Übergänge, keine dekorativen Animationen; reduzierte Bewegung berücksichtigen                             |

Default und Forest werden jeweils in Light- und Dark-Mode über die vorhandenen semantischen Tokens unterstützt. Die Bildfarben werden durch den Themewechsel nicht verändert. Transparenz erhält ein dezentes kontrastarmes Raster; geschützte Bilder werden dadurch nicht öffentlich nachgeladen. Bildumrandungen, Auswahlgriffe und Fokusmarkierungen bleiben auch auf wechselnden Bildhintergründen erkennbar.

## 2. Mediathek: Finden steht vor Verwalten

Der bestehende Bibliothekseinstieg bleibt erhalten. Oben stehen Seitentitel und Uploadaktion, darunter Suche und Tag-Filter, dann Medienraster und bestehende Cursor-Navigation. Keine neuen Filter, Ordner, Sortierverträge oder Gesamtzahlen werden für das Design vorausgesetzt.

Eine Medienkarte zeigt Bildvorschau, Titel, Erstellungszeitpunkt zum Unterscheiden von Kopien sowie die bereits verfügbaren relevanten Zustände. Zustandsinformationen werden nicht als undifferenzierte Badge-Sammlung präsentiert. „In Verarbeitung“ ist deutlich von einem fehlgeschlagenen Vorschauabruf getrennt; unbekannte Verwendungszahlen werden nicht als null ausgegeben.

Die Karte öffnet die Detailansicht. Sie erhält nicht zusätzlich eine ganze Reihe kleiner Bearbeitungsbuttons. Suche, Filter und Listenposition bleiben bei der Rückkehr nach Möglichkeit über den bestehenden Navigationsvertrag erhalten.

## 3. Mediendetail: Bild und Angaben zusammen prüfen

Auf breiten Ansichten liegt links die große vollständige Bildvorschau, rechts das Formular „Angaben in der Mediathek“. Darunter folgen Verwendung und bei Bedarf technische Informationen. Technische IDs, MIME-Typ und Storage-Diagnose verdrängen keine redaktionellen Angaben; vorhandene Diagnosefunktionen bleiben erreichbar.

Über der Vorschau stehen Titel, Sichtbarkeit und ein verständlicher Verarbeitungszustand. „Bild bearbeiten“ öffnet den Editor. Reine Metadatenpflege bleibt unmittelbar auf der Detailseite möglich.

Das Formular gruppiert:

- **Bild beschreiben:** Titel, Alternativtext und Beschreibung.
- **Bildrechte:** Copyright/Bildnachweis und Lizenz.
- **Wiederfinden:** Tags über die vorhandene einfache Tag-Eingabe, ohne neue Taxonomieverwaltung.

Hilfetexte erläutern den Zweck, etwa beim Alternativtext „Beschreiben Sie kurz die wichtige Bildinformation für diesen Inhalt.“ In der Mediathek wird eine allgemeine Beschreibung angeboten, deren Eignung später im Inhaltskontext beurteilt werden kann. Es werden keine neuen Pflichtfelder oder dekorativen-Bild-Optionen eingeführt. Grenzen, ungültige Eingaben und bestehende Werte werden an den jeweiligen Feldern nachvollziehbar dargestellt.

Die Formularaktionen heißen „Angaben speichern“ und „Änderungen verwerfen“. Ein Hinweis erklärt, dass bestehende Angaben in anderen Inhalten nicht automatisch geändert werden. Ein erfolgreicher Abschluss wird am Formular bestätigt, nicht ausschließlich durch eine kurzlebige Benachrichtigung.

„Bild bearbeiten“ darf ungespeicherte Metadaten nicht still verwerfen oder zentral speichern. Der Formularentwurf bleibt beim Editorwechsel erhalten und wird als Ausgangswert für die neue Kopie angeboten; das ursprüngliche Medium wird erst durch „Angaben speichern“ geändert. Bei Abbruch des Bildeditors kehrt derselbe Metadatenentwurf zurück.

## 4. Bildeditor: Ein Arbeitsraum statt verschachtelter Dialoge

Der gemeinsame Medien-Dialog wechselt in eine großzügige Editoransicht, statt einen weiteren Modal-Dialog über den Picker zu legen. Im Mediathekkontext wird dieselbe Editorintegration geöffnet. Der Aufrufkontext bleibt im Kopf sichtbar: „Bild für diesen Inhalt bearbeiten“ beziehungsweise „Bild aus der Mediathek bearbeiten“.

Auf dem Desktop gliedert sich die Arbeitsfläche in:

1. **Kopf:** verständlicher Titel, Bildname und Abbruchaktion.
2. **Werkzeugnavigation:** beschriftete Bereiche Zuschneiden, Drehen/Spiegeln, Bild anpassen, Filter, Text und Markierungen.
3. **Bildfläche:** größtmöglicher nutzbarer Raum für die Bearbeitung.
4. **Werkzeugeinstellungen:** nur die zum aktiven Werkzeug gehörenden Optionen.
5. **Abschlussleiste:** sichtbarer Entwurfsstatus, Rückgängig/Wiederholen und eine führende Weiteraktion.

Die genaue interne Anordnung muss mit den unterstützten Filerobot-Konfigurationen realisierbar sein. [ADR-069](../../../docs/adr/ADR-069-filerobot-bildeditor-mit-begrenzter-accessibility-abweichung.md) erlaubt dessen Spezialcontrols und akzeptiert die bekannten Accessibility-Lücken innerhalb der spezialisierten Werkzeug-/Canvas-Oberfläche. Studio übernimmt den zugänglichen Rahmen und die fachlichen Formulare; es wird kein zweites Canvas, eigener Ebeneneditor oder Accessibility-Fork gebaut.

Alle freigegebenen Werkzeuge bleiben erreichbar, ohne sämtliche Regler gleichzeitig einzublenden. Icons unterstützen Beschriftungen. „Alle Bildänderungen zurücksetzen“ ist eine nachgeordnete Aktion mit klarer Erklärung ihres Umfangs; Rückgängig betrifft den letzten Schritt. Objektänderungen bei Text und Markierungen bleiben beim erneuten Öffnen möglich.

## 5. Prüfen und abschließen

Die führende Aktion im Editor heißt „Weiter zu Angaben und Vorschau“. Sie rendert den aktuellen lokalen Stand und führt innerhalb desselben Arbeitsraums zur Prüfung; sie speichert noch nichts dauerhaft. „Zurück zur Bearbeitung“ erhält Bild- und Metadatenentwurf.

Diese Arbeitsansicht ist zugleich der reguläre Abschluss, keine zusätzliche Freigabe- oder Bestätigungsstufe. Hinweise zu Alt-Text, Bildrechten oder Ausschnitten lassen sich ohne separate Checkboxen passieren. Relevante hinzugefügte Texte und Markierungen sollen im Inhaltskontext textlich zugänglich bleiben; dafür bietet die Oberfläche einen kurzen Hinweis und die vorhandenen Inhaltsfelder, keine automatische OCR oder Veröffentlichungssperre. Komplexe Informationen können eine Erläuterung im Inhalt statt eines überlangen Alternativtexts benötigen.

Die Prüfung zeigt das fertige Bild, den wichtigen Bildbereich und die drei vorhandenen Standardvarianten. „Quadratische Vorschau“, „Breite Vorschau“ und „Großes Titelbild“ werden mit Seitenverhältnis und tatsächlicher Größe ergänzt, damit ähnliche breite Varianten unterscheidbar bleiben. Dies sind Formatvorschauen, keine verbindlichen Darstellungen aller Apps.

Der wichtige Bildbereich ist visuell markierbar und alternativ über beschriftete Eingaben bedienbar. Änderungen aktualisieren die Vorschauen, ohne zu behaupten, serverseitige Dateien seien bereits neu erzeugt worden. Kleine Ausschnitte zeigen tatsächlich die Beschneidung von Text und Markierungen. Ein allgemeiner Hinweis erklärt das Risiko; es wird keine automatische Erkennung abgeschnittener Texte vorausgesetzt.

Daneben beziehungsweise darunter werden die Metadaten der neuen Kopie gepflegt. Beschreibung und Alternativtext erscheinen sichtbar mit einem kurzen Prüfhinweis. Copyright, Lizenz und Tags sind übernommen; der Titelvorschlag erhält „Bearbeitet“ höchstens einmal. Diese Angaben gelten für die neue Kopie. Inhaltsspezifische Werte werden dadurch nicht ungefragt überschrieben.

| Kontext                                | Führende Abschlussaktion               | Unmittelbare Wirkung                                                                                             |
| -------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Mediathek                              | Als neues Bild speichern               | Neue Kopie über den vorhandenen Upload-/Verarbeitungspfad speichern                                              |
| Neues lokales Bild im Inhalt           | Bild übernehmen                        | Lokalen Entwurf im aktuellen Formular auswählen                                                                  |
| Bearbeitetes Bibliotheksbild im Inhalt | Bearbeitetes Bild übernehmen           | Lokale bearbeitete Kopie im aktuellen Formular auswählen                                                         |
| Waste-Branding                         | Als neues Bild speichern und auswählen | Neue öffentliche Bibliothekskopie unmittelbar speichern und deren URL im bestehenden Settings-Formular auswählen |

In der Mediathek erklärt die Abschlussleiste „Das bisherige Bild und seine Verwendungen bleiben erhalten“. Nach Erfolg öffnet sich die neue Kopie mit Bestätigung und nachvollziehbarem Bezug zur Bearbeitungsgrundlage. Im Inhalt wird der Arbeitsraum geschlossen, die Vorschau im Formular aktualisiert und „Wird mit dem Inhalt gespeichert“ angezeigt. Es gibt keine zusätzliche Erfolgsmeldung, die dauerhafte Speicherung vortäuscht.

Waste-Branding erklärt dagegen die unmittelbare Speicherung in der Mediathek und die noch erforderliche Speicherung der Konfiguration. Dort gilt nicht „Wird mit dem Inhalt gespeichert“. Der bestehende Settings-Ablauf erhält keinen neuen Content-Save-Vertrag.

## 6. Medienpicker und Angaben für diesen Inhalt

Der vorhandene Picker bleibt der Einstieg für Bibliotheksauswahl und neue Dateien. Nach Auswahl erscheinen Vorschau, die im Fachmodul unterstützten Verwendungsangaben und die Aktion „Bild bearbeiten“. Beispielsweise heißt das Feld „Alternativtext für diesen Inhalt“. Nicht unterstützte Felder werden nicht allein zur optischen Vereinheitlichung eingeführt.

„Angaben in der Mediathek bearbeiten“ ist bei vorhandenen Assets eine nachgeordnete, ausdrücklich zentrale Aktion. Sie wechselt den Inhalt desselben Dialogs in die zentrale Pflegeansicht; eine eigene Aktion „Angaben in der Mediathek speichern“ verhindert Verwechslungen mit dem Formularabschluss. Bei Erfolg wird erklärt, dass der Inhalt noch nicht gespeichert ist, und die vorhandene selektive Übernahme der passenden Werte angeboten. Abbrechen erhält die zuvor bearbeiteten Inhaltsangaben.

Bereits gespeicherte Medien und lokale Entwürfe werden unterscheidbar dargestellt. Bei fehlenden Änderungsrechten bleiben zentrale Angaben lesbar; das Verwenden eines berechtigt verfügbaren Mediums bleibt möglich. Kopienspeichern richtet sich nach Erstellungs- und Quellzugriffsrechten, nicht nach der Berechtigung, das Original zu ändern.

Manuelle Bild-URLs bleiben über die vorhandene Eingabe erreichbar und benötigen keine neuen Bibliotheksrechte. Für diese Quelle wird kein funktionsloser Bearbeiten-Button angeboten; ein automatischer URL-Import ist nicht vorgesehen. Geschützte Medien sind im bestehenden öffentlichen Content-/Branding-Ziel nicht übernehmbar, auch wenn sie in der Mediathek bearbeitet werden können. Ein verständlicher Grund ersetzt die falsche Erwartung einer automatischen Veröffentlichung.

Bei Werkzeugen zum Überdecken oder Weichzeichnen genügt ein knapper Hinweis: „Das Original bleibt erhalten. Diese Bearbeitung ist keine sichere Anonymisierung.“ Keine Pflichtbestätigung und keine Sperre des Werkzeugs.

## 7. Zustände und Fehler

| Zustand                    | Sichtbare Rückmeldung und Handlung                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Editor lädt                | Beschrifteter Ladezustand; Abbrechen bleibt möglich; Formularentwurf bleibt bestehen                                                                |
| Lokal geändert             | Entwurfsstatus im Arbeitsraum; noch keine Speicherbestätigung                                                                                       |
| Export läuft               | „Bild wird vorbereitet“; doppelte Abschlussaktionen gesperrt                                                                                        |
| Upload läuft               | „Bild wird hochgeladen“ mit echtem Fortschritt, soweit verfügbar                                                                                    |
| Verarbeitung läuft         | „Bild wird verarbeitet“; kein erfundener Prozentfortschritt                                                                                         |
| Inhalt wird gespeichert    | Eigener Schritt, klar vom Bild-Upload getrennt                                                                                                      |
| Erfolg in Mediathek        | Neue Kopie anzeigen und Speicherung bestätigen                                                                                                      |
| Übernahme im Inhalt        | Vorschau und Hinweis auf noch erforderliches Inhaltsspeichern                                                                                       |
| Sicherer Fehler            | Verständlicher Fehler an der betroffenen Aktion; Entwurf erhalten und passende Wiederholung anbieten                                                |
| Unklarer Abschluss         | „Speicherstatus wird geprüft“; keine unkontrollierte neue Speicherung oder vorschnelle Fehlermeldung                                                |
| Editorzustand nicht lesbar | Erklären, dass die bisherige Bearbeitung nicht geladen werden kann; vorhandenes Bild bleibt erhalten, keine stille Reduzierung auf ein flaches Bild |

Während einer dauerhaft angenommenen Verarbeitung bedeutet das Schließen der Ansicht keinen erfolgreichen Serverabbruch. Die Beschriftung und vorhandene Statusanzeige müssen diese Wirkung korrekt vermitteln. Ein nur lokal arbeitender Editorabbruch verwirft dagegen die aktuelle Editorsitzung und erhält das zuvor ausgewählte Bild. Nur bei vorhandenen Änderungen ist eine Bestätigung zum Verwerfen nötig; sie ist kein zusätzlicher Routineklick bei jeder Auswahl.

## 8. Verwendung und Löschschutz

Der bestehende Verwendungsbereich unterscheidet „In Inhalten verwendet“ und „Zum Weiterbearbeiten benötigt“. Auch bei null Inhaltsreferenzen bleibt eine bestehende Bearbeitungsabhängigkeit sichtbar. Eine verständliche Erklärung und berechtigt lesbare Links führen zu den betroffenen Kopien. Nicht zugängliche Objekte werden nicht durch Titel oder Links offengelegt.

Löschen bleibt räumlich von normalen Speicheraktionen getrennt. Ist es blockiert, steht der Grund sichtbar in der Ansicht; ein deaktivierter Button ohne Erklärung genügt nicht. Es gibt keinen Ersatz-für-alle-Dialog und keine neue Versionshistorie.

## 9. Kleine Bildschirme und Barrierefreiheit

Auf schmalen Ansichten stehen Vorschau, Angaben und Verwendung untereinander. Der Spezialeditor nutzt seine unterstützte responsive Darstellung, ohne den Studio-Rahmen zu verdrängen. Einstellbereiche wechseln mit dem Werkzeug, statt sämtliche Regler gleichzeitig einzublenden. Studio-eigene Abschlussaktionen bleiben erreichbar und verdecken weder Felder noch Tastaturfokus. Für die Studio-eigenen Flächen werden 200 Prozent Textvergrößerung, angepasste Textabstände und Reflow bei 320 CSS-Pixeln beziehungsweise entsprechendem 400-Prozent-Desktopzoom geprüft. Die bekannte Abweichung im Spezialeditor begründet keine Ausnahme für Formulare, Status oder Abschlussaktionen.

Tastaturfokus kehrt nach Schließen zum Auslöser zurück. Im Studio-Rahmen folgt die Fokusreihenfolge der sichtbaren Reihenfolge. Studio-Statusmeldungen verwenden geeignete Live-Regionen; der zusätzlich Studio-eigene wichtige Bildbereich erhält eine ohne Zeigegerät nutzbare Eingabe. Der Standardweg für Bildauswahl, Upload, Metadatenpflege und Verwendung bleibt ohne Öffnen des Spezialeditors verfügbar.

Die fehlende vollständige Tastatur-/Screenreaderbedienung von Filerobots Werkzeugnavigation und Canvas-Objekten ist gemäß ADR-069 bewusst akzeptiert. Am Einstieg steht ein kurzer Hinweis ohne Pflichtbestätigung: „Die Bildbearbeitung ist derzeit nicht vollständig mit Tastatur und Screenreader bedienbar.“ Die Einschränkung wird bei Umsetzung im bestehenden Accessibility Statement erfasst. Eine gleichwertige zugängliche Bildbearbeitung wird nicht versprochen. Einfache unterstützte Verbesserungen sind möglich, eine umfassende eigene Nachrüstung ist keine Voraussetzung des Lieferumfangs.

Die vorhandenen Studio-Vorgaben für normale Texte, UI-Kontraste, Aktionsflächen und Tooltips gelten im umgebenden Studio weiterhin. Theme und übersetzte Beschriftungen werden auch im Spezialeditor über vorhandene Konfiguration angepasst; verbleibende Lücken werden transparent benannt. Keine uneingeschränkte WCAG-Konformitätsaussage für den Editor.

## 10. Bestehende Bausteine und Designabnahme

Verwendet werden StudioPageTitle, vorhandene Button-, Input-, Textarea-, Label-, Dialog-, Tabs-, Card-, Badge- und Alert-Bausteine sowie der bestehende Medienpicker, die Vorschau-/Verwendungskomponenten und der Metadaten-Übernahmeablauf. Neue Basis-Komponenten, Iconfamilien, Schriftpakete, eigene Theme-Systeme oder externe Medienplattformen sind nicht Teil des Konzepts. Die Editorintegration nutzt die vorhandenen semantischen Tokens, soweit deren Anpassung unterstützt ist.

Bei Umsetzung stammen sämtliche Benutzertexte einschließlich Library-Labels, Tooltips, Tastaturhinweisen und Fehlermeldungen aus der tatsächlich aktiven deutschen und englischen Übersetzungsquelle. Die Formulierungen in diesem Dokument sind Gestaltungsvorgaben, kein Anlass für hardcodierte Strings.

Die Designabnahme nutzt die sieben Redaktionsszenarien des fachlichen Entwurfs. Nach jedem Abschluss muss der Nutzer zutreffend sagen können: Was wurde bereits gespeichert, wo wirkt es und welcher nächste Schritt fehlt? Zusätzlich werden Light/Dark, schmale Ansicht, Zoom, Tastatur, fehlende Rechte, lange Titel, leere Metadaten, Verarbeitung und Fehler geprüft. Ein gestalterisch schönes Ergebnis ersetzt weder die Wiederherstellungsprüfung des Editorzustands noch diese Bediennachweise.

Die Light/Dark-Abnahme umfasst beide vorhandenen Themes Default und Forest. Waste-Branding, manuelle URLs und geschützte Auswahl werden als bestehende abweichende Verbraucherverträge mitgeprüft. Die gültige bestehende Browser-/Assistive-Technology-Matrix ist vor der Abnahme zu klären; eine zweite Matrix wird nicht angelegt.
