# Gestaltung und technische Abgrenzung

## Ausgangspunkt und Entscheidung

Der bestehende Detail-Workspace trennt Basis, Inhalt und Einstellungen durch Tabs. Für die Neuanlage werden die vorhandenen fachlichen Eingaben in einer durchgehenden Seite komponiert. Nach erfolgreicher Anlage gilt weiterhin die bestehende Navigation; beim Öffnen eines gespeicherten Inhalts erscheint dessen bisheriger Edit-Workspace.

Eine alternative Zusammenlegung nur der bisherigen Tabpanels würde deren teilweise ungünstige Feldfolge und leere Zusatzblöcke übernehmen. Ein Wizard würde neue Schrittabhängigkeiten einführen. Gewählt wird daher die fachlich sortierte Komposition derselben Felder im vorhandenen Editor.

## Redaktionelle Orientierung und sichere Entscheidungen

Die primäre Zielgruppe arbeitet ohne Schulung mit Nachrichten, Veranstaltungen, Orten, FAQ, Cockpit-Karten, Projekten und Umfragen. Der generische Inhalt ist ein technischer Sonderfall; dort bleiben Typangabe und technische Eingaben erhalten, ohne dafür einen neuen Einsteigerflow oder eine vereinfachte Typauswahl zu schaffen.

### Einstieg, Sprache und Hilfen

- Die sieben redaktionellen Create-Ansichten beginnen mit höchstens zwei kurzen Sätzen zu Zweck und Einstieg. Beispiel Nachricht: „Erstellen Sie eine Nachricht für die App. Beginnen Sie mit Überschrift und Text; Bilder und weitere Angaben können Sie ergänzen.“ Beispiele sind in der Umsetzung gegen den tatsächlichen Ausgabekanal zu prüfen.
- Bestehende Pflichtfelder sind konsistent und zugänglich gekennzeichnet; optionale Abschnitte sind ausdrücklich als optional erkennbar. Die Kennzeichnung ändert keine Validierung oder Pflichtigkeit.
- Knappe Abschnittsnamen folgen der Aufgabe. Ergänzende Leitfragen geben Orientierung: Nachrichten „Was möchten Sie mitteilen?“ und „Wann soll die Nachricht erscheinen?“, Veranstaltungen „Was findet statt?“, „Wann und wo?“ und „Was müssen Besucher wissen?“, Orte „Wo liegt der Ort?“ und „Wann ist er geöffnet?“, Umfragen „Was möchten Sie erfahren?“ und „Wer darf wann teilnehmen?“. Die fachliche Feldfolge bleibt maßgeblich; Leitfragen erzeugen keine zusätzlichen Schritte.
- Kurze Hilfen stehen direkt am Feld und sind programmatisch zugeordnet. Platzhalter ersetzen weder Label noch Hilfe. Einleitung/Teaser und mobile Kurzbeschreibung erläutern ihren tatsächlichen Anzeigeort, soweit dieser durch bestehende Verbraucher belegt ist; keine unbelegte App-Vorschau versprechen.
- Sprache erläutert den vorhandenen Sprachcode einschließlich Beispielen wie `de` und `en`; keine neue Sprachverwaltung. Sortiergewicht erklärt „Kleinere Zahlen werden zuerst angezeigt“. Alternativtext erklärt den Zweck und gibt einen kurzen beschreibenden Hinweis.
- Veröffentlichungsdatum, Sichtbarkeit, Aktivierung und Status erläutern ihre jeweilige bestehende Bedeutung. Ähnlich benannte Datumsfelder werden nicht gleichgesetzt. Vor der Textfestlegung werden die zuständigen Mapper und Ausgabeverträge geprüft; ungeklärte Semantik wird als offener Punkt dokumentiert, statt eine Wirkung zu erfinden.

### Ergänzungen nach redaktioneller Bedeutung

Häufig benötigte Ergänzungen erhalten einen direkt sichtbaren Einstieg in den vorhandenen Abschnitt, etwa „Veranstalter ergänzen“, „Eintrittspreise ergänzen“, „Öffnungszeiten hinzufügen“ und „Kontakt ergänzen“. Sie bleiben optional und dürfen bis zum Öffnen kompakt sein; ihre Bedeutung darf nicht in einem unspezifischen Sammelbereich verschwinden. Technische Angaben wie externe IDs oder JSON-Payload bleiben standardmäßig geschlossen und klar getrennt.

Geschlossene Zusatzabschnitte nennen ihren Inhalt und Zustand, etwa „2 Kontakte hinterlegt“ oder „Keine Öffnungszeiten angegeben“. Diese Zusammenfassungen werden aus dem aktuellen Formularzustand abgeleitet und begründen keine neuen Vollständigkeitsregeln. Öffnen allein erzeugt keine neuen Listeneinträge oder Defaultwerte.

### Wirkung der abschließenden Aktion

Unmittelbar bei den abschließenden Aktionen nach dem letzten Abschnitt steht eine kurze, bei Einstellungsänderungen aktualisierte Erklärung der belegten Speicherwirkung. Beispiele für Nachrichten sind „Die Nachricht wird als Entwurf gespeichert und ist noch nicht öffentlich“ oder bei entsprechender Einstellung die sofortige beziehungsweise geplante Veröffentlichung. Bei Push werden zusätzliche Benachrichtigung und ausgewähltes Zielgebiet ausdrücklich genannt; deaktivierter Push darf nicht als Versand angekündigt werden. Bestehende Bestätigungen bleiben erhalten.

Für andere Typen werden ausschließlich deren tatsächliche Status-/Sichtbarkeitsverträge beschrieben. Ein Datum allein begründet keine zeitgesteuerte Veröffentlichung; ein Projektstatus darf nicht mit dem systemgeführten `published` gleichgesetzt werden. Die Erklärung ist eine Darstellung des bestehenden Formularzustands, kein eigener Publikationsplaner und keine zusätzliche Bestätigungsstufe. Der Submit im Seitenkopf macht dieselbe Wirkung durch eine kurze zustandsabhängige Aktionsbezeichnung und bei aktiviertem News-Push einen erkennbaren Hinweis deutlich. Beide Darstellungen werden aus demselben Formularzustand abgeleitet; keine zweite ausführliche Zusammenfassung oder zusätzliche Bestätigung.

### Fehler, Unterbrechen und Wiederaufnahme

Feldfehler nennen die konkrete Korrektur statt technischer Validatorbegriffe. Fehlgeschlagenes Speichern erhält die Eingaben und beschreibt den tatsächlichen Zustand. Bei mehrstufigen Save-/Medienreferenz-Vorgängen muss die Meldung zwischen fehlgeschlagener Anlage und bereits angelegtem Inhalt mit ausstehender Medienzuordnung unterscheiden; keine pauschale Behauptung „nicht angelegt“ und keine erneute Anlage bei Retry.

Die acht Create-Editoren melden ihren lokalen Änderungszustand über die schmale React-Anbindung in `@sva/studio-ui-react`. Ein Host-Rahmen direkt am vorhandenen Plugin-Editor verwendet den bestehenden Router-Blocker für tatsächliche Seitenwechsel und den vorhandenen `StudioConfirmDialog`. Ein registrierter Checker pro aktivem Editor genügt; keine Registry, kein Formularinhalt im Host und keine Plugin-SDK-/Manifest-Änderung. Edit-Ansichten bleiben unverändert.

Bei offenen Änderungen bietet der Dialog „Weiter bearbeiten“ und „Änderungen verwerfen“. Abbrechen erhält Eingaben und einen nachvollziehbaren Fokus; Verwerfen setzt den angehaltenen Seitenwechsel fort. Schließen/Neuladen verwendet den nativen Browserdialog, soweit unterstützt. Dessen Wortlaut ist browserbestimmt. Abschnittssprünge, Klappbereiche und Search-/Hash-Wechsel innerhalb desselben Editors sind kein Verlassen.

Der gemeinsame Hook führt nur einen lokalen Änderungszähler. Plugins melden benannte Formularänderungen und tatsächliche nutzerseitige Medienänderungen; bloßes Öffnen eines Pickers zählt nicht. Der bestehende Submit merkt die Revision vor dem Request. Nur ein bestätigter vollständiger Erfolg für dieselbe Revision darf die pluginlokale Formular-/Medienbaseline zurücksetzen und den Host-Checker synchron vor der Weiterleitung freigeben. Während eines Saves wird der Schutz nicht pauschal deaktiviert. Neue Eingaben während Save oder Medien-Retry bleiben geschützt und dürfen nicht durch `reset(getValues())` als gespeichert gelten.

Bei Medien-Teilerfolg bleibt die ursprüngliche Save-Revision für den bestehenden Referenz-Retry maßgeblich. Neuere Eingaben werden nicht als Teil dieses Retries bestätigt. Die nachweislich bereits angelegte ID wird vor jeder Navigation gemerkt; erneutes Create ist danach gesperrt. Scheitert die Weiterleitung oder bleibt der Redakteur wegen neuer Eingaben auf der Seite, führt ein normaler Link im bestehenden Statusbereich zur vorhandenen Edit-Route. Dieser Link durchläuft denselben Verlassensschutz. Es entsteht kein neuer Update-, Retry- oder Wiederherstellungspfad. Eine Verlassenswarnung ist keine Autosave- oder Wiederherstellungsgarantie.

Wo der Typ bereits einen Entwurfsmodus besitzt, erklären Hilfe und Erfolgsmeldung, wie der gespeicherte Entwurf später über den vorhandenen Bearbeitungsweg fortgesetzt wird. Für Typen ohne Entwurfsmodus wird kein solcher angeboten. Nach erfolgreicher Anlage bleibt die bestehende Navigation erhalten; ein Wechsel in den Edit-Workspace mit Tabs wird verständlich benannt.

### Ausnahmefälle und Wiederherstellung im bestehenden Vertrag

Die folgende Tabelle ist eine Erhaltungsregel für die tatsächlich berührten Darstellungsstellen, kein Sanierungsauftrag für alle acht Plugins. Bestehende Fehler- und Retry-Verträge bleiben erhalten; neue Rückmeldungen entstehen nur an durch den Onepager veränderten Stellen. Keine neue Fehler-, Auth-, Logging-, Reconcile- oder Retry-Infrastruktur. Vorhandene Lücken blockieren diesen Change nur, wenn er eine Regression verursacht oder neue Texte eine unbelegte Wirkung behaupten; solche Stellen lokal korrigieren oder auf die unbelegte Aussage verzichten.

| Fall                                                      | Rückmeldung und Verhalten                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client- oder serverseitige Feldvalidierung                | Konkrete Korrektur am betroffenen Feld; bei geschlossenen Abschnitten vor Fokus öffnen. Serverseitige Fehler anhand vorhandener typisierter Feldzuordnung anzeigen; nicht zuordenbare Fehler im Formularbereich. Eingaben erhalten.                                                                      |
| Benötigte Daten laden nicht                               | Vorhandenen Lade-/Fehlerzustand mit passender Wiederholungsaktion zeigen; Fehler nicht als leere Auswahlliste darstellen. Nur abhängige Aktionen sperren.                                                                                                                                                |
| Optionale Anreicherung wie Karte oder Geocoding fällt aus | Fehler lokal am betroffenen Bereich anzeigen; übriges Formular bedienbar halten. Vorhandene manuelle Eingabe und lokale Wiederholung anbieten, soweit unterstützt; keine neue Fallback-Integration.                                                                                                      |
| Upload oder Medienauswahl schlägt fehl                    | Betroffenes Medium beziehungsweise die Aktion benennen, bisherige Auswahl und Texte erhalten; bestehende Wiederholungs-/Entfernungsaktionen verwenden. Keine stillschweigende Erfolgsmeldung oder Löschung.                                                                                              |
| Sitzung abgelaufen oder Berechtigung entzogen             | Vorhandenen Host-Auth-/Berechtigungszustand verständlich erklären und dessen vorgesehenen nächsten Schritt anbieten; kein blinder Save-Retry. Keine Wiederherstellung über Login/Reload versprechen, wenn der bestehende Vertrag sie nicht bietet.                                                       |
| Fachlicher Konflikt oder nicht mehr verfügbare Referenz   | Ursache anhand des bestehenden Fehlervertrags erklären und konkrete Korrektur ermöglichen; keine automatische Ersetzung oder Überschreibung. Nicht verfügbare Referenzen nicht stillschweigend entfernen.                                                                                                |
| Netzabbruch oder Timeout beim Absenden                    | Speicherergebnis als unbestätigt kennzeichnen, wenn der Host keinen eindeutigen Ausgang liefert. Weder Erfolg noch sicher fehlgeschlagene Anlage behaupten. Nur vorhandene sichere Reconcile-/Retry-Aktionen anbieten; keine neue Create-Mutation auf Verdacht und kein automatischer Wiederholungsloop. |
| Anlage bestätigt, Weiterleitung fehlgeschlagen            | Bestehenden News-Zustand erhalten: Anlage bestätigen und vorhandenen Öffnen-Link mit gespeicherter ID anbieten. Keine erneute Create-Mutation; ein vorhandener Verlassensschutz behandelt den bestätigten Save als gespeichert. Kein neues allgemeines Zustandsmodell.                                   |
| Unerwarteter Fehler                                       | Verständliche allgemeine Meldung mit sicherem nächsten Schritt; keine Roh-Exception, Stacktraces, Tokens oder personenbezogenen Daten anzeigen. Vorhandene sichere Fehlerreferenz nutzen, falls vorhanden.                                                                                               |

Während des laufenden Submits sind beide Auslöser über denselben Zustand gegen paralleles Auslösen gesperrt; nach einem Fehler gelten die bestehenden Retry-Regeln. Erfolgsmeldung und Navigation folgen ausschließlich dem bestätigten Ergebnis. Fehlermeldungen stehen dauerhaft am relevanten Bereich beziehungsweise in der vorhandenen Fehlerzusammenfassung, sind für assistive Technik wahrnehmbar und verlassen sich nicht nur auf Farbe oder flüchtige Toasts. Texte werden in de/en gepflegt. Technische Diagnose bleibt im bestehenden Host-Logging mit PII-Schutz; keine zusätzliche pluginlokale Logging- oder Exception-Schicht.

## Gemeinsame Darstellung

- Ein Formular mit einem vorhandenen Formular-/Submit-Owner; kein zweiter Zustand für Create und keine Kopie von Edit-Feldern.
- Titel beziehungsweise Frage als erstes Fachfeld; bei generischen Inhalten steht die bestehende Typangabe unmittelbar davor. Eine bestehende, berechtigungsabhängige Auswahl „Erstellen als“ steht davor und nutzt unverändert den Host-Vertrag.
- Benannte Abschnitte auf Basis der vorhandenen Studio-/shadcn-Bausteine; keine verschachtelten Cards und keine inneren Editor-Tabs.
- Kurze zusammengehörige Felder dürfen ab ausreichender Breite zweispaltig erscheinen; DOM-, Fokus- und mobile Reihenfolge entsprechen immer der folgenden Liste. Texte und Medien nutzen die Formularbreite.
- Hauptabschnitte sind offen. Zusatzabschnitte sind kompakt beziehungsweise geschlossen, bieten bei häufig benötigten Ergänzungen einen direkt sichtbaren fachlichen Einstieg und zeigen eine Zusammenfassung vorhandener Eingaben. Sie bleiben unmittelbar auf derselben Seite erreichbar. FAQ benötigt keine Klappbereiche.
- Optionale Listen verwenden vorhandene Hinzufügen-/Entfernen-/Sortierfunktionen. Keine Änderung der Defaultwerte oder Serialisierung leerer Einträge nur zur optischen Bereinigung.
- Bedingt verfügbare Felder werden nach bestehenden Regeln gezeigt oder deaktiviert. Ein geschlossenes Feldset darf keine Werte löschen; eine fachlich erforderliche Bereinigung bei Bedingungswechsel, etwa Push bei geplantem News-Publishing, bleibt bestehen. Direkt am betroffenen Bereich erklären, welche Option nicht verfügbar ist beziehungsweise zurückgesetzt wurde; keine generische Änderungs- oder Undo-Infrastruktur.
- Speichern/Anlegen und Abbrechen nutzen vorhandene Aktionen; Submit ist im Seitenkopf und nach dem letzten Abschnitt erreichbar. Beide Submit-Auslöser verwenden identische Lade-, Disabled- und Berechtigungszustände. Keine zusätzliche Sticky-Leiste erforderlich.
- Lange Formulare (Events, POI, generische Inhalte, Umfragen) bieten eine kompakte native Sprungnavigation zu Abschnitten ohne neuen Routen-/Search-Parameter. Sie blendet keine anderen Abschnitte aus. Abschnittssprünge verlassen das Formular nicht und lösen keine Verlassenswarnung aus. Native Fragmentziele liegen auf sichtbaren Überschriften beziehungsweise Klapptriggern; nach Tastaturaktivierung ist die Fortsetzung am Ziel nachvollziehbar. Bei Summary-Zielen ergänzt nachgewiesen unzureichendes natives Fokusverhalten eine kurze lokale Zielfokussierung am vorhandenen Link; dessen `href` bleibt als Fallback erhalten. Kein eigener Fokusmanager.
- Labels, Hilfen und Fehlermeldungen verwenden Übersetzungsschlüssel in Deutsch und Englisch. Die Umsetzung erfüllt WCAG 2.1 AA mit semantischen Überschriften, Labels, Tastaturbedienung und nachvollziehbarem Fokus.
- Validierung öffnet betroffene Zusatzabschnitte, bevor der bestehende Fehlerfokus greift. Eine vorhandene Fehlerzusammenfassung verweist auf erreichbare Felder. Öffnen/Schließen sendet das Formular nicht ab.
- Historie, Moderation, Ergebnisse, IDs und technische Zeitstempel werden bei Neuanlage nicht als leere Arbeitsbereiche gezeigt. Die je Plugin bestehenden fachlichen externen IDs bleiben dagegen als Eingabefelder erhalten.

## Feldinventur und Reihenfolge je Inhaltstyp

Die Nummerierung bestimmt die Reihenfolge. „Zusatz“ bezeichnet einen standardmäßig geschlossenen Abschnitt mit sichtbarem fachlichem Einstieg und Zustandszusammenfassung gemäß den obigen Regeln. Aufgeführt werden vorhandene fachliche Eingaben; unterstützte Medienmetadaten bleiben in der bestehenden Medienkomponente. Die Listen definieren keine neuen Modellfelder und ändern weder Pflichtigkeit noch Defaults.

### Nachrichten

Quelle: `packages/plugin-news/src/news.detail-form-schema.ts`, `news.detail-basis-tab.tsx`, `news.detail-content-tab.tsx`, `news.detail-settings-tab.tsx`.

1. **Titel:** einzeiliges Hauptfeld.
2. **Einleitung:** mehrzeiliger Teaser.
3. **Nachrichtentext:** bestehender Rich-Text-Editor.
4. **Medien:** vorhandene Medienauswahl mit Vorschau, Reihenfolge und unterstützten Metadaten wie Alternativtext, Bildunterschrift und Copyright.
5. **Kategorien:** bestehende Mehrfachauswahl.
6. **Quelle (Zusatz):** Quell-URL und sichtbarer beschreibender Linktext zusammen; interne kompatible Beschreibungsfelder nicht doppelt darstellen.
7. **Veröffentlichung:** Entwurf, sofort oder geplant; Datum und Uhrzeit nur bei geplanter Veröffentlichung.
8. **Push:** bestehende berechtigungsabhängige Option, nur bei sofortiger Veröffentlichung aktivierbar; vorhandene Bestätigung für globalen Push bleibt bestehen.
9. **Push-Zielgebiet:** bestehende globale oder ortsbezogene Auswahl mit Straße, PLZ und Ort, nur bei vorhandener Berechtigung und fachlicher Verfügbarkeit.

Autor, Keywords, externe ID, alte Datums-/Anzeigefelder, Legacy-Inhaltsblöcke, Adresse, POI-Verknüpfung und Payload werden durch diesen Change nicht neu eingeblendet. Snapshot-Erhaltung bleibt unverändert.

### Veranstaltungen

Quelle: `packages/plugin-events/src/events.detail-form-types.ts`, `events.detail-basis-tab.tsx`, `events.detail-content-*.tsx`, `events.detail-settings-tab.tsx`.

1. **Titel:** einzeiliges Hauptfeld.
2. **Termine:** wiederholbare Einträge mit Beginn-/Enddatum, Beginn-/Endzeit, Wochentag, Zeitbeschreibung und „nur Zeitbeschreibung“ gemäß bestehender Oberfläche.
3. **Wiederholung:** aktivieren, Wiederholungstyp, Intervall und bei wöchentlicher Wiederholung Wochentage; bestehende Regeln und internen Kompatibilitätsfelder beibehalten.
4. **Ort/Adressen:** bestehende Adressliste mit Zusatz, Straße, PLZ, Ort, Adressart und Koordinaten soweit heute sichtbar; Karte und Geocoding unmittelbar zuordnen.
5. **Beschreibung:** vorhandener Texteditor.
6. **Medien:** bestehende Medienauswahl, Vorschau, Reihenfolge und Metadaten.
7. **Kategorien:** Mehrfachauswahl.
8. **Veranstalter (Zusatz):** Name, Anschrift, Kontakt und bestehende Geo-Eingaben zusammen.
9. **Kontakte (Zusatz):** wiederholbare Ansprechpartner mit Vorname, Nachname, E-Mail, Telefon, Fax und Weblinks samt Beschreibung.
10. **Links (Zusatz):** wiederholbare URL-/Beschreibungspaare.
11. **Preise (Zusatz):** Bezeichnung, Betrag, Kategorie und Beschreibung je Eintrag.
12. **Technische Angaben (Zusatz):** externe ID.
13. **Sichtbarkeit:** abschließender Schalter.

POI-Verknüpfung, Barrierefreiheitsdaten, Keywords und Tags bleiben gemäß bestehender Spec verborgen. Insbesondere wird keine POI-Auswahlliste geladen. Im Modell vorhandene Felder sind keine Freigabe zur Erweiterung der Oberfläche.

### Orte / POI

Quelle: `packages/plugin-poi/src/poi.detail-form.types.ts`, `poi.detail-basis-tab.tsx`, `poi.detail-content-tab.tsx` und dessen eingebundene Abschnitte.

1. **Name:** einzeiliges Hauptfeld.
2. **Standort:** Standortbezeichnung, Straße, PLZ, Ort, Karte/Adresssuche und ergänzende manuelle Koordinaten. Bestehende Abbildung auf erste Adresse und Standort bleibt erhalten.
3. **Beschreibung:** vorhandener Rich-Text-Editor.
4. **Mobile Kurzbeschreibung:** kurzes Textfeld.
5. **Medien:** vorhandene Medienauswahl mit Vorschau, Reihenfolge und Metadaten.
6. **Kategorien:** Mehrfachauswahl.
7. **Öffnungszeiten (Zusatz):** Wochentag, geöffnet/geschlossen, Uhrzeiten, Gültigkeitsdatum von/bis und Beschreibung als bestehende wiederholbare Einträge.
8. **Kontakt (Zusatz):** Vorname, Nachname, E-Mail, Telefon, Fax, Website und Linkbeschreibung.
9. **Weitere Links (Zusatz):** URL-/Beschreibungspaare.
10. **Preise (Zusatz):** Name, Betrag, Kategorie und Beschreibung je Eintrag.
11. **Betreiber (Zusatz):** Name, Ansprechpartner, E-Mail, Telefon, Fax, Website/Linkbeschreibung, Anschrift und Koordinaten.
12. **Technische Angaben (Zusatz):** externe ID.
13. **Aktiv:** abschließender Schalter.

Zertifikate, Barrierefreiheit, Tags, Payload, Keywords und im Modell vorhandene zusätzliche Preis-, Adress- oder Standortattribute werden nicht neu eingeblendet. Bestehende allgemeine Kontakte und Betreiber bleiben getrennt.

### Generische Inhalte (technischer Sonderfall)

Quelle: `packages/plugin-generic-items/src/generic-items.detail-form.defaults.ts`, `generic-items.detail-basis-tab.tsx` und `generic-items.content-*.tsx`.

1. **Typ und Titel:** `genericType` vor Titel; vorhandene Eingabekomponenten und Typverträge bleiben erhalten.
2. **Inhaltsblöcke:** Überschrift, Einleitung und Rich-Text-Haupttext je bestehendem wiederholbaren Block; blockbezogene Mediendaten verlustfrei erhalten.
3. **Medien:** bestehende zentrale Medienauswahl mit Reihenfolge und Metadaten.
4. **Kategorien:** Mehrfachauswahl.
5. **Links (Zusatz):** URL und Beschreibung je Eintrag.
6. **Adressen (Zusatz):** Zusatz, Straße, PLZ, Ort, Adressart und Koordinaten mit vorhandenen Karten-/Suchfunktionen.
7. **Standorte (Zusatz):** Name, Abteilung, Bezirk, Region, Bundesland und Koordinaten.
8. **Kontakte (Zusatz):** Vorname, Nachname, E-Mail, Telefon, Fax und Weblinks.
9. **Termine (Zusatz):** Wochentag, Datum und Uhrzeit von/bis, Zeitbeschreibung und ausschließliche Verwendung der Zeitbeschreibung.
10. **Öffnungszeiten (Zusatz):** Wochentag, Gültigkeit von/bis, Uhrzeit von/bis, geöffnet/geschlossen und Beschreibung.
11. **Preise (Zusatz):** vorhandene Felder für Name, Betrag, Kategorie, Beschreibung, Gruppenpreis sowie Alters- und Gruppengrößengrenzen.
12. **Barrierefreiheit (Zusatz):** Beschreibung, Typangabe und Links.
13. **Weitere Angaben (Zusatz):** Keywords, externe ID und bestehende JSON-Payload-Eingabe; vorhandene JSON-Validierung beibehalten.
14. **Publikation:** `publicationDate`, `publishedAt` und Sichtbarkeit zusammen; vorhandene Bedeutungen und Validierungen unverändert mit verständlichen Labels erläutern, ohne ein neues Terminierungsmodell zu behaupten.

`author` und ausschließlich technisch mitgeführte Felder erhalten keine neue freie Eingabe. Der frei eingegebene `genericType` begründet keine zusätzlichen spezialisierten Onepager oder ein neues Typschema.

### FAQ

Quelle: `packages/plugin-faq/src/faq.types.ts`, `faq.editor-tabs.tsx`.

1. **Frage:** einzeiliges Hauptfeld.
2. **Antwort:** großes Nur-Text-Textfeld, kein Rich-Text und kein HTML.
3. **Sprache:** bestehendes Sprachcodefeld mit unverändertem Default.
4. **Sortiergewicht:** Zahl mit Erklärung der aufsteigenden Sortierung.
5. **Veröffentlichungsdatum:** vorhandenes Feld mit unveränderter Semantik.
6. **Sichtbarkeit:** Schalter.

Alle sechs Felder bleiben direkt sichtbar. Keine Medien-, Kategorie-, Orts- oder Kontaktbereiche ergänzen.

### Cockpit-Karten

Quelle: `packages/plugin-cockpit-cards/src/cockpit-cards.types.ts`, `cockpit-cards.editor-fields.tsx`, `cockpit-cards.content-fields.tsx`.

1. **Überschrift:** einzeiliges Hauptfeld.
2. **Text:** bestehender Texteditor.
3. **Bilder:** vorhandene Medienauswahl mit Reihenfolge, Alternativtext, Bildunterschrift und Copyright soweit vom bestehenden Vertrag unterstützt.
4. **Verlinkung:** Ziel-URL, Linktext und „in neuem Tab öffnen“ zusammen; kein neuer Pflicht-Link und keine neue Normalisierungs-/Löschlogik bei leerem Link.
5. **Kategorie:** vorhandene Auswahl.
6. **Sprache:** Sprachcodefeld.
7. **Sortiergewicht:** Zahl mit Erläuterung.
8. **Veröffentlichungsdatum:** vorhandenes Feld.
9. **Sichtbarkeit:** abschließender Schalter.

### Projekte

Quelle: `packages/plugin-projects/src/projects.api-types.ts`, `projects.editor-tabs.tsx`.

1. **Titel:** einzeiliges Hauptfeld.
2. **Kurzbeschreibung:** mehrzeiliges Textfeld.
3. **Volltext:** vorhandener Rich-Text-Editor.
4. **Bilder:** sortierbare optionale Galerie mit bestehender Medienauswahl, URL, Alternativtext, Bildunterschrift und Urheberangabe; Position über Reihenfolge.
5. **Sprache:** bestehendes Sprachfeld.
6. **Status:** bestehende Statusauswahl mit unveränderten erlaubten Werten und Default; keine neue Statusübergangslogik.

Autor, `published`, `publishedAt`, Erstellungs-/Änderungszeitpunkt bleiben systemgeführte Metadaten.

### Umfragen

Quelle: `packages/plugin-surveys/src/surveys.detail-form.ts`, `surveys.detail-content-model.ts`, `surveys.detail-content-tab.tsx`.

1. **Titel:** einzeiliges Hauptfeld.
2. **Kurzbeschreibung:** mehrzeiliges Textfeld.
3. **Beschreibung:** bestehender Textbereich.
4. **Fragen:** sortierbare flache Abschnitte mit Titel, Beschreibung, Fragetyp und Pflichtfrage. Antwortoptionen mit Titel und gegebenenfalls Freitextoption unmittelbar bei der Frage; Positionswerte werden durch die bestehende Reihenfolge geführt.
5. **Teilnahmegebiet:** vorhandene Zielgebietsauswahl.
6. **Laufzeit:** Start und Ende zusammen.
7. **Anonymität:** bestehender Schalter.
8. **Datenschutzhinweis:** Textbereich.
9. **Transparenzhinweis:** Textbereich.
10. **Ergebnisdarstellung:** „Ergebnisse in der App anzeigen“ und Freigabe nie/nach Teilnahme/nach Umfrageende zusammen.
11. **Status:** bestehende Auswahl `DRAFT`, `ACTIVE`, `ARCHIVED` mit unveränderten Voraussetzungen.

Alle fünf Fragetypen bleiben erhalten. Fragen und Optionen bleiben inline, ohne innere Tabs oder verschachtelte Cards. Bestehende Löschbestätigungen bleiben bestehen. Moderation, Ergebnisse und Historie erscheinen erst im gespeicherten Edit-Workspace.

## Ownership und gemeinsame UI-Bausteine

Maßgeblich sind `docs/development/plugin-development.md` (Standard Path) und `docs/architecture/08-cross-cutting-concepts.md` (Studio-UI-Boundary). Die neue Darstellung verschiebt keine Fachverantwortung in den Host oder die gemeinsame UI-Bibliothek:

- **Plugin:** Feldreihenfolge, fachliche Abschnittskomposition, Feldhilfen, Übersetzungen im Plugin-Namespace sowie Ableitung der Wirkungsbeschreibung aus dem eigenen bestehenden Fachvertrag. Kein Import aus anderen Fachplugins, `apps/*` oder nicht öffentlichen Host-Interna; keine pluginabhängige Fallunterscheidung in der gemeinsamen UI.
- **Gemeinsame UI:** öffentliche Exporte von `@sva/studio-ui-react` für Seitenrahmen, Abschnitte, Felder, Hilfen, Fehler-/Statusdarstellung, Dialoge und Aktionen. shadcn/Radix wird über dieses Package gekapselt, nicht separat in Plugins eingebaut. Fachliche Wrapper dürfen diese Bausteine komponieren, aber keine eigene visuelle Varianten-, Token- oder ARIA-Schicht definieren. Fachtexte kommen über vorhandene Label-/Prop-Verträge vom Verbraucher; die UI-Bibliothek kennt keine News-, Event- oder Umfragestatusregeln.
- **Host:** bestehende Routen, Guards, Principal-/Credential-Bindung, Persistenz, Audit, Save-/Medienreferenz-Retry und Navigation. Plugins konsumieren ausschließlich die bestehenden öffentlichen SDK-/UI-Verträge. Die Verlassenswarnung nutzt ausschließlich die neue schmale React-Anbindung über das öffentliche UI-Package; kein Import von App-Router-Interna ins Plugin und kein neuer Plugin-Beitragstyp.

Für doppelte Primäraktionen ist der bestehende `primaryAction`-Vertrag von `StudioDetailPageTemplate` zu nutzen; Save-Zustände und Feedback folgen `StudioSaveButton`/`useStudioSaveFeedback`, soweit im bestehenden Editor zuständig. Keine zweite pluginlokale Aktionsleiste, eigene Save-Timer oder Dialog-/Fehlersysteme.

Zuerst bestehende öffentliche Bausteine prüfen und den zuständigen Pfad erweitern. Eine gemeinsame UI-Erweiterung ist nur bei belegtem Darstellungsdefizit und tatsächlichen Verbrauchern zulässig; sie bleibt präsentationsorientiert und ohne Plugin-Abhängigkeit. Fachnahe Spezialcontrols werden nicht allein wegen der Onepager-Migration zentralisiert. Öffentliche Package-Einstiegspunkte und `workspace:*`-Abhängigkeiten bleiben verbindlich; keine Deep-Imports oder erweiterten Boundary-Allowlists als Abkürzung.

## Umsetzung im bestehenden Pfad

Create und Edit sind unterschiedliche Kompositionen derselben Feldabschnitte im vorhandenen Editor. Ein Feld wird je Modus nur einmal gemountet; DOM-IDs und RHF-Registrierungen dürfen nicht doppelt entstehen. Neue kleine pluginlokale Abschnitte sind nur bei fehlender Wiederverwendbarkeit der bisherigen Tab-Komponente zulässig; sie ersetzen dann deren Inline-Felder auch im Edit-Modus im selben Lieferabschnitt.

Es entsteht keine generische Feldbeschreibung, kein schemaabhängiger Renderer und keine neue Plugin-SDK-/Manifest-API. Die freigegebene schmale React-Anbindung für den Verlassensschutz ist der einzige neue öffentliche UI-Vertrag. Bestehende host-owned Autorisierung, Credential-/Principal-Bindung, Validierung, Save-/Medienreferenz-Retry und Navigation nach erfolgreicher Mutation bleiben unverändert. Karten, Rich-Text und Medienpicker werden nicht parallel für verborgene Edit-Panels im Create-Modus gemountet.

## Risiken und Nachweise

- **Doppelte Felder oder verlorene Werte:** gezielte Editor-Tests für Wechsel von Abschnittszuständen, Listenoperationen und resultierenden bestehenden Save-Input; pro Modus genau ein Feld und ein Submit-Owner.
- **Unsichtbare Fehler:** Test mit ungültigem Wert in geschlossenem Zusatzabschnitt, Öffnen vor Fokus und erhaltener Eingabe nach fehlgeschlagenem Save.
- **Edit-Regression:** bestehende Tab-, Historien- und Medien-Tests gezielt weiterführen; bei Umfragen zusätzlich Moderation/Ergebnisse.
- **Fachliche Scope-Ausweitung:** Abgleich der sichtbaren Felder gegen die hier genannten aktuellen UI-Quellen, nicht allein gegen Types; insbesondere Events und POI bleiben reduziert.
- **Zu lange oder teure Seite:** Zusatzbereiche, semantische Sprunglinks und keine doppelt gemounteten Rich-Text-/Karten-/Medieninstanzen. Keine neue Performance-Infrastruktur.
- **Unbeabsichtigte Mutation:** Ausklappen, Navigation und Listenaktionen verwenden bestehende nicht-submit Buttons; ein tatsächliches Anlegen verwendet genau den vorhandenen Submit-Pfad.

Die Lieferung kann pluginweise innerhalb dieses Changes erfolgen; jede umgestellte Ansicht erfüllt unmittelbar Create- und Edit-Nachweise. Kein künstlicher PR-Stack und kein Feature-Flag. Rücknahme bedeutet Wiederherstellung der bisherigen Create-Komposition ohne Datenmigration. Die typbezogenen Wirkungsbeschreibungen werden am bestehenden Quellvertrag geprüft. Die Verlassenswarnung bleibt auf den bestehenden Host-Rahmen der acht Create-Editoren begrenzt. Es entstehen keine neuen Statusmodelle oder globalen Navigationsmechanismen.

## Redaktionelle Akzeptanz

Zusätzlich zu den technischen Regressionstests wird mit ungeschulten Personen ein kurzer aufgabenbasierter Durchlauf für Nachricht und Veranstaltung durchgeführt. Aufgaben beschreiben ein Ergebnis (etwa eine Nachricht zunächst ohne Veröffentlichung vorbereiten oder eine Veranstaltung mit Termin, Ort und Eintrittspreis anlegen), keine Klickfolge. Der Nachrichten-Entwurf verwendet ausschließlich den bereits vorhandenen Entwurfsmodus.

Ohne mündliche Hilfe müssen die Personen Pflichtangaben und optionale Ergänzungen erkennen, den Inhalt anlegen und vor dem Absenden korrekt erklären, ob und unter welchen bestehenden Bedingungen er öffentlich wird sowie ob und an welches Zielgebiet Push gesendet wird. Zusätzlich wird ein korrigierbarer Fehler geprüft; das Unterbrechen mit ungespeicherten Eingaben wird einbezogen. Beobachtete Missverständnisse, Hilfebedarf und Ergebnis werden knapp festgehalten; automatisierte Editor-Tests ersetzen diesen Verständlichkeitsnachweis nicht. Generische Inhalte sind von diesem Einsteigernachweis ausgenommen, behalten aber sämtliche technischen, Validierungs- und Accessibility-Nachweise.
