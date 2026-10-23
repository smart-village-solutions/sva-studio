# Entwurf: Medienmetadaten und vollständiger Bildeditor

Das zugehörige [Designkonzept](./ui-design.md) konkretisiert Informationshierarchie, Ansichten, Aktionen, Zustände und barrierefreie Bedienung als Gestaltungsvorschlag zur Nutzerprüfung.

## Status und Ausgangslage

Fachlich im Dialog am 22.10.2026 freigegeben; schriftlicher Entwurf zur Nutzerprüfung. Keine Implementierung oder neue Dependency ist mit diesem Dokument bereits freigegeben.

Der aktuelle Quellstand besitzt den zentralen Medienvertrag, den gemeinsamen Picker, getrennte Content-Verwendungsmetadaten mit Übernahmedialog, lokale Dateientwürfe und provisorische Content-Save-Assets. Die Mediendetailansicht bietet nur Tag-Bearbeitung. `metadataUpdateSchema` und `updateMedia` können Textmetadaten, Fokuspunkt und Zuschnitt speichern; ein nachträglicher Parameter-Patch erzeugt keine neuen Varianten. Der Prozessor erzeugt über Sharp Thumbnail-, Teaser- und Hero-Varianten; ein vorhandener Crop hat dort Vorrang vor dem Fokuspunkt.

Maßgebliche bestehende Pfade:

- `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx`
- `packages/studio-ui-react/src/use-studio-media-picker-overlay.confirm.ts`
- `packages/studio-ui-react/src/content-media-metadata-dialog.tsx`
- `packages/plugin-sdk/src/content-media-persistence.ts`
- `packages/auth-runtime/src/iam-media/asset-mutation-handlers.ts`
- `packages/auth-runtime/src/iam-media/processing-variants.ts`

## 1. Redaktionelle Oberfläche

### Proportionalität und redaktionelle Verantwortung

Der vollständige Editor bleibt frei nutzbar. Hinweise zu Bildrechten, Alternativtext, Bildqualität, Zuschnitt und eingefügtem Text unterstützen die Redaktion, erzwingen aber keine neuen Checkboxen, Pflichtfelder, Freigaben oder Veröffentlichungssperren. Bestehende fachliche Validierungen bleiben bestehen. Kein automatischer Qualitätsprüfer, OCR-Dienst, Moderationsworkflow oder neues Berechtigungsmodell wird eingeführt.

Die Prüfung von Angaben und Vorschau ist eine Arbeitsansicht mit direkter Abschlussaktion, keine zusätzliche Bestätigungsrunde. Unveränderte Angaben müssen nicht erneut bestätigt werden. Die technischen Schutzgrenzen sind unten abschließend benannt; optionale Hilfen dürfen den normalen Ablauf nicht blockieren.

Mediathek und Medienpicker verwenden dieselbe hostseitige Editorintegration. Es entstehen weder ein zweiter Medienhaupteinstieg noch plugin-eigene Bildeditoren. Die Integration wird erst beim Öffnen geladen.

Der Umfang enthält Zuschnitt mit freien und festen Seitenverhältnissen, Drehen, Spiegeln, Bildanpassungen, Filter, Text und Annotationen sowie Undo/Redo und Zurücksetzen. Er wird in einem gemeinsamen Lieferumfang umgesetzt. Zusätzlich zeigt das Studio Fokuspunkt und die tatsächlichen Ausschnitte seiner vorhandenen Standardvarianten. Varianten werden aus der fertig bearbeiteten Bildausgabe erzeugt; der Fokuspunkt bezieht sich auf diese Ausgabe. Der Editorzuschnitt wird dabei nicht ein zweites Mal als Varianten-Crop angewendet.

Die Oberfläche setzt kein Medienfachwissen voraus. Zuschneiden, Drehen und Bildanpassung sind unmittelbar auffindbar; Filter, Text und Markierungen sind in weiteren beschrifteten Werkzeugbereichen erreichbar. Der vollständige Umfang bleibt erhalten. „Alle Bildänderungen zurücksetzen“ ist klar vom Rückgängigmachen des letzten Schritts getrennt.

### Dokumentierte Integrationsentscheidung für den spezialisierten Editor

Studio-Primitives verantworten Dialograhmen, Metadaten, Status, Speicheraktionen und die Prüfung der Ausgabevarianten. Ausschließlich innerhalb der spezialisierten Bildarbeitsfläche darf Filerobot seine mitgelieferten Werkzeuge und Einstellcontrols verwenden: Deren Ersatz durch eigene Canvas-/Objektbedienung würde den vorhandenen vollständigen Editor nachbauen und die technische Oberfläche unnötig vergrößern. Diese begrenzte Architekturentscheidung ist die gleichwertig dokumentierte Ausnahme nach DEVELOPMENT_RULES Abschnitt 3; sie erlaubt kein zweites allgemeines UI-System und keine Nutzung der Editor-Primitives außerhalb der Integration.

Die Entscheidung ist in [ADR-069](../../../docs/adr/ADR-069-filerobot-bildeditor-mit-begrenzter-accessibility-abweichung.md) festgehalten. Der Nutzer akzeptiert ausdrücklich die bekannten Accessibility-Lücken der spezialisierten Filerobot-Werkzeug-/Canvas-Oberfläche. Diese sind kein Integrationsblocker mehr; es entsteht kein eigener Accessibility-Adapter, Objekteditor oder Fork. Theme- und i18n-Integration sowie alle übrigen Qualitätsanforderungen bleiben bestehen. Studio-eigene Dialograhmen, Formulare, Status, Variantenprüfung und Abschlussaktionen unterliegen weiterhin den Accessibility-Regeln. Die Abweichung wird am Editoreinstieg und bei Umsetzung im bestehenden Accessibility Statement benannt, ohne Pflichtbestätigung.

Der Fokuspunkt wird als „Wichtiger Bildbereich“ erklärt. Vorschauen tragen verständliche Formbezeichnungen wie „Quadratische Vorschau“ und „Breites Titelbild“, statt ausschließlich interne Preset-Namen zu zeigen. Sie bilden die vorhandenen Standardvarianten ab und versprechen keine identische Darstellung in jedem Ausgabekanal. Die Oberfläche weist auf mögliche abgeschnittene Texte oder Markierungen in kleineren Ausschnitten hin. Alle hier genannten Benutzertexte sind Formulierungsvorgaben und werden bei Umsetzung über das bestehende i18n-System bereitgestellt.

Titel, Alternativtext, Beschreibung, Copyright, Lizenz und Tags können beim Aufnehmen, vor dem Kopienspeichern und später am bestehenden Medium bearbeitet werden. Client und Server verwenden übereinstimmende Feldgrenzen und eindeutige Lösch-/Leerwertsemantik. Vorhandene Daten bleiben bei Validierungs- und Speicherfehlern erhalten. Technische Felder bleiben schreibgeschützt.

## 2. Speichern und Geltungsbereich

| Aktion                                     | Wirkung                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Zentrale Metadaten speichern               | Bestehendes Asset aktualisieren; keine Änderung seiner Bildbytes oder bestehender Content-Snapshots |
| Angaben für aktuellen Inhalt ändern        | Formularentwurf ändern; Persistenz erst mit regulärem Content-Speichern                             |
| Bild in Mediathek bearbeiten und speichern | Neues Bibliotheksasset samt Bearbeitungsgrundlage und Ausgabevarianten erzeugen                     |
| Bild im Inhaltseditor übernehmen           | Ergebnis als lokalen Entwurf auswählen; Upload erst beim Content-Speichern                          |
| Bild erneut bearbeiten und speichern       | Neue Kopie erzeugen; bisherige Kopie und ihre Verwendungen erhalten                                 |

Im Picker sind zentrale Änderungen eine ausdrücklich benannte, separat gespeicherte Aktion mit eigener Berechtigungsprüfung. Ein anschließender Content-Abbruch nimmt diese bewusst gespeicherte Änderung nicht zurück. Die gewöhnliche Auswahl beziehungsweise Übernahme eines Bildes schreibt keine zentralen Metadaten nebenbei.

Im Inhaltsformular werden die tatsächlich unterstützten Verwendungsfelder ausdrücklich zugeordnet, beispielsweise „Alternativtext für diesen Inhalt“. Die separate Aktion „Angaben in der Mediathek bearbeiten“ erläutert, dass am Medium gespeichert wird und bereits verwendete Angaben in anderen Inhalten erhalten bleiben. Nach erfolgreichem zentralem Speichern kann der Redakteur passende Werte selektiv in den aktuellen Formularentwurf übernehmen; vorhandene eigene Formulardaten werden nicht ungefragt überschrieben. Dafür wird der bestehende Metadaten-Übernahmedialog erweitert beziehungsweise wiederverwendet. Benutzer müssen keine Begriffe wie Asset, Snapshot oder globale Metadaten verstehen.

Kopien übernehmen Copyright, Lizenz, Tags, Beschreibung und Alternativtext. Der Titel erhält einen lokalisierten, bearbeitbaren Vorschlag mit Zusatz „Bearbeitet“. Beschreibung und Alternativtext werden zur Prüfung angezeigt, weil eine Bearbeitung die Bildaussage verändern kann. Ohne fachliche Freigabe entsteht daraus keine neue Pflichtfeldregel.

Der automatisch vorgeschlagene Zusatz wird bei wiederholter Bearbeitung nicht angehäuft. Vorschau und Erstellungszeitpunkt helfen beim Unterscheiden mehrerer Kopien; es entsteht keine zusätzliche Versionsverwaltung.

Es gibt keinen pauschalen Austausch aller Verwendungen. Im Inhaltseditor wird die Kopie nur im aktuellen Formular ausgewählt; erst dessen Speichern ändert die betreffende Verwendung. Der vorhandene selektive Metadaten-Übernahmedialog bleibt für bestehende Content-Snapshots zuständig.

## 3. Ausgangsbild, Editorzustand und Bildausgabe

Eine bearbeitete Kopie benötigt drei zusammengehörige Bestandteile: unveränderte Bearbeitungsgrundlage, zuletzt gespeicherten Editorzustand und gerenderte Ausgabe. Die fachliche Referenz zeigt weiterhin auf genau das neue Asset. Die Zuordnung zur Bearbeitungsgrundlage ist eine interne Medienabhängigkeit, keine Content-Referenz und keine Versionshistorie.

Bei erneuter Bearbeitung werden Grundlage und Zustand geladen, damit Text, Annotationen und Einstellungen einzeln veränderbar bleiben. Eine weitere Kopie muss auf die tatsächlich benötigte Grundlage verweisen; eine bloße Verweiskette über jede Zwischenkopie genügt nicht. Bereits vorhandene, nicht bearbeitete Medien bleiben ohne Editorzustand editierbar und starten aus ihrem Bildoriginal.

Die Implementierung erweitert `iam.media_assets` um `editing_document`, `editing_source_asset_id` und `editing_source_key`. Der versionierte Zustand bleibt in der Asset-Zeile; vorhandene Quellen werden mit instanzgebundenem Selbst-Fremdschlüssel und `ON DELETE RESTRICT` wiederverwendet. Lokale Grundlagen liegen ausschließlich im vorhandenen privaten Storage-Bereich; Kopien verweisen direkt auf die tatsächliche Grundlage, nicht auf Zwischenkopien. `deletion_pending` wird vor Storage-I/O unter derselben Zeilensperre wie die Kopien-/Referenzanlage gesetzt und durch normale Asset-Upserts nicht zurückgesetzt. Eine getrennte, nach dem Lock ausgeführte Referenzprüfung sieht unter READ COMMITTED auch gerade abgeschlossene Kopienanlagen. Der Löschabschluss entfernt Asset und gebuchte Bytes atomar und ist wiederholbar.

Der vorhandene Upload-/Claim-Prozessor nimmt Ausgabe und gegebenenfalls zusätzliche lokale Grundlage zusammen an. Private Grundlage und Inline-Rasterressourcen durchlaufen denselben konfigurierten Scan; Zustands- und zusätzliche Datei-Bytes fließen in die bestehende Quotenfinalisierung ein. `GET /api/v1/iam/media/$assetId/editing` prüft Kopie und tatsächliche Grundlage gesondert und liefert nur dafür eine kurzlebige URL samt validiertem Zustand; normale Antworten projizieren die privaten Felder aus. Der bestehende Verwendungsnachweis ergänzt separat gezählte Bearbeitungsabhängigkeiten und zeigt Kopientitel nur bei vorhandenen Leserechten. Für lokale Ausgangsbilder muss deren Original zusätzlich zur gerenderten Ausgabe erhalten werden; nur das fertige Bild hochzuladen erfüllt die Anforderung nicht. Eine vorhandene gespeicherte Quelle darf nur mit wirksamer Instanz-/Zugriffsbindung wiederverwendet werden. Neue private Hilfsdateien und Editorzustände dürfen weder als unregistrierte Bucket-Medien erscheinen noch öffentlich ausgeliefert werden.

Der Zustand enthält eine Format-/Editorversionskennung. Verwendete Schriften und zusätzliche Bildressourcen müssen lokal verfügbar beziehungsweise kontrolliert mitgespeichert sein; Browser-Object-URLs und flüchtige externe Ressourcen sind keine dauerhaften Referenzen. Inkompatible Zustände werden verständlich gemeldet, nie still auf das gerenderte Bild reduziert. Ein Editorupdate benötigt einen Wiederherstellungsnachweis für gespeicherte Testzustände.

## 4. Datenfluss und Ausführungsgrenzen

### Bestehende Verbrauchergrenzen

| Verbraucher                                               | Quellen und Abschluss                                                                                                                                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mediathek                                                 | Berechtigt lesbare öffentliche und geschützte Assets; Kopie speichert unmittelbar als Bibliotheksmedium und übernimmt die Quellsichtbarkeit                                                           |
| News, Events, POI, Generic Items, Projects, Cockpit Cards | Lokale Dateien und geeignete öffentliche Bibliotheksassets; bearbeitete Kopien bleiben bis zum regulären Content-Speichern lokal                                                                      |
| Waste-Branding                                            | Bestehender öffentlicher Picker und unmittelbarer Bibliotheksupload; persistente öffentliche URL wird im vorhandenen Settings-Formular übernommen, Konfiguration erst durch dessen Speichern geändert |
| Manuelle Bild-URL im Inhalt                               | Vorhandene URL-Eingabe und Content-Berechtigungen bleiben erhalten; keine automatische Bearbeitung oder Überführung in ein Asset                                                                      |

Die gemeinsame Editorintegration unterscheidet nur diese tatsächlich vorhandenen Abschlusskontexte. Sie erzeugt keine neue Strategie-/Provider-Plattform. Waste behält `waste-management.settings.manage` und die bestehenden Medienprüfungen. Ein Abbruch seines Settings-Formulars kann einen bewusst angelegten Bibliotheksupload zurücklassen, wie bisher; die Oberfläche stellt dessen unmittelbare Speicherung ausdrücklich dar. Bildänderungen werden dort über „Als neues Bild speichern und auswählen“ abgeschlossen. Keine neue Content-Save-Operation und keine neu behauptete Usage-Erfassung für Branding-URLs.

Content-Plugins behalten ihre vorhandenen Rollen und unterstützten Metadatenfelder, insbesondere die eingeschränkten Kachel-Felder. Die Berechtigungsprüfung kombiniert weiterhin fachliche Actions im eigenen Plugin-Namespace mit der Host-Medien-Capability. Der gemeinsame Vertrag führt weder neue Mainserver-Felder noch pluginfremde Actions ein.

Geschützte Medien und ihre geschützten Kopien sind im bestehenden öffentlichen Content-/Branding-Vertrag nicht auswählbar. Kurzlebige signierte URLs werden dort nicht persistiert; es gibt keine automatische Sichtbarkeitsänderung. Manuelle URLs bleiben ohne zusätzliche Bibliotheksrechte nutzbar; ein beliebiger Remote-Import durch den Editor gehört nicht zum Umfang. Eine lokale Datei kann weiterhin über die vorhandene Dateiauswahl aufgenommen werden.

Im Inhaltseditor bleiben Dateien, Editorzustand und Vorschauen bis zum Speichern im Browser. Abbrechen oder Entfernen verwirft lokale Entwürfe und gibt Object-URLs frei, ohne neue Medien anzulegen. Reload-/Offline-Persistenz dieser Browserentwürfe gehört nicht zum Umfang. Ein beabsichtigtes Verlassen mit ungespeicherten Änderungen wird über den vorhandenen Formularschutz behandelt.

Beim Content-Speichern wird das zusammengehörige Medienergebnis in die bestehende Content-Media-Save-Operation aufgenommen. Quelle/Zustand/Ausgabe werden erst nach den erforderlichen Prüfungen und bestätigtem Content-/Referenzabschluss regulär nutzbar. Der bestehende Recovery-Vertrag für unklaren Mainserver-Erfolg bleibt maßgeblich; kein vorzeitiges Löschen möglicherweise bereits verwendeter Medien.

In der Mediathek startet das ausdrückliche Kopienspeichern den vorhandenen Bibliotheksupload. Der bestehende Studio-Job validiert und verarbeitet die Ausgabe; Sharp erstellt daraus die Standardvarianten. Ein Browserexport gilt serverseitig nicht als vertrauenswürdig. Das Rendern von Filtern oder Annotationen durch Sharp wird nicht behauptet: Filerobot rendert die vollständige Bearbeitung, Sharp verarbeitet deren Ausgabe.

Lokales Übernehmen und dauerhafte Freigabe sind unterschiedliche Schritte: Ein vollständig gerenderter lokaler Entwurf darf ohne Serverupload ins Formular übernommen werden. Im Editor heißt die Aktion „Bild übernehmen“ beziehungsweise „Bearbeitetes Bild übernehmen“; das Formular zeigt „Wird mit dem Inhalt gespeichert“. Die Auswahl wird erst durch das reguläre Content-Speichern dauerhaft wirksam. Eine Aufnahme als serverseitig verfügbares Bibliotheksmedium oder eine persistierte Referenz setzt weiterhin die vollständige Verarbeitung und den bestehenden Content-Save-Abschluss voraus.

In der Mediathek heißt die Aktion „Als neues Bild speichern“. Die Oberfläche bestätigt den Erfolg erst nach dem erforderlichen Speicher-/Verarbeitungsabschluss; bestehende Verwendungen werden nicht ausgetauscht. Speicherfehler dürfen keine scheinbar erfolgreiche, aber später nicht wiederherstellbare Kopie hinterlassen. Quelle, Zustand und gerenderte Ausgabe benötigen eine konsistente Veröffentlichung; dafür werden vorhandene Claim-, Finalisierungs- und Cleanup-Pfade erweitert, kein paralleler Orchestrator eingeführt.

## 5. Rechte, Sicherheit und Datenintegrität

Bestehende `media.*`-Actions bleiben Grundlage: Lesen/gegebenenfalls geschützte Delivery für die Quelle, Erstellen für eine Kopie, Ändern für zentrale Metadaten und vorhandene Referenzrechte für Content-Verwendungen. Kopienspeichern setzt nicht die Berechtigung voraus, das bestehende Quellasset global zu ändern. Plugins erhalten keine Storage-Artefakte.

Metadaten beim Erstellen einer neuen Kopie werden im autorisierten Create-/Operationspfad gespeichert; daraus folgt kein `media.update`-Recht für bestehende Assets. Erneute serverseitige Instanz-/Berechtigungsprüfung und der bestehende CSRF-Schutz gelten bei jeder Mutation, einschließlich Zustand, Quelle und finalem Abschluss. Der bestehende Read-Endpunkt darf private Editorzustände nicht durch ungefilterte zusätzliche Asset-Felder an normale Picker-/Detailantworten weiterreichen. Der bestehende Medien-Lesepfad erhält zweckgebundene Datenprojektionen; Editorzugriff prüft zusätzlich die Rechte auf die tatsächliche Grundlage, nicht nur auf die sichtbare Kopie.

Geschützte Quellen dürfen über Editor, Hilfsressourcen, Fehler oder Kopien keine öffentliche Nebenroute erhalten. Die Kopie übernimmt im ersten Umfang die Sichtbarkeit ihrer Quelle; neue lokale Bilder folgen dem vorhandenen Uploadvertrag. Ein neuer Sichtbarkeitswechsel ist nicht Teil der Bildbearbeitung. Benötigte Quellen sind vor Löschung geschützt, solange weiterbearbeitbare Kopien von ihnen abhängen; Prüfung und Anlage dieser Abhängigkeit müssen konkurrierende Löschungen korrekt behandeln.

Der Verwendungsnachweis unterscheidet Inhaltsverwendungen und benötigte Bearbeitungsgrundlagen. Auch ohne Inhaltsreferenzen wird ein Löschhindernis verständlich erklärt, beispielsweise „Dieses Original wird zum Weiterbearbeiten von zwei Bildern benötigt“. Die betroffenen Kopien sind im Rahmen der vorhandenen Leserechte verlinkt. Die Anzeige behauptet nicht, eine Bearbeitungsabhängigkeit sei eine Content-Verwendung.

Zusätzliche Originaldateien, Zustände, Ressourcen und Ausgaben berücksichtigen die bestehende harte Speicherquote. Tatsächlich neu gespeicherte Bytes werden genau einmal gebucht und beim Cleanup nur entsprechend ihrer tatsächlichen Buchung abgezogen. Bereits geteilte Grundlagen werden nicht mehrfach als physischer Speicher gezählt und nicht durch das Löschen einer Kopie entfernt.

Alle neu eingehenden Dateien durchlaufen Inhalts-/Größenprüfung und das im Ziel aktive Scan-Gate. Strukturierter Editorzustand erhält ein begrenztes Schema; beliebige externe Nachlade-URLs, ausführbare Inhalte und ungeprüfte Ressourcen werden nicht akzeptiert. Kein neuer Scanner und keine Änderung seiner Aktivierung. Audit verwendet bestehende Pfade mit zulässigen Korrelationen, ohne Bildinhalte, Textannotation-Inhalte, Editorzustände, Secrets oder Storage-Keys in Logs.

### Datenschutz im bestehenden Medienpfad

Editorpaket, freigegebene Schriften und benötigte Ressourcen werden kontrolliert mit der Anwendung bereitgestellt. Bildbytes, Editorzustände und Annotationstexte gehen nicht an Scaleflex oder andere externe Dienste. Keine externen Schriftabrufe, Telemetrie oder Erweiterung von CSP-/CORS-Freigaben allein für die Integration. Öffentliche gerenderte Ausgaben und Varianten enthalten keine private Bearbeitungsgrundlage, keinen Editorzustand und keine ungefragt übernommenen eingebetteten EXIF-/IPTC-/XMP-/Standortdaten. Die redaktionell gepflegten Angaben bleiben am Medienmodell erhalten; ein neues Metadaten-Import-/Export-System entsteht nicht.

Nicht destruktive Bearbeitung ist keine sichere Anonymisierung. Überdecken, Zuschneiden oder Weichzeichnen entfernt die Information nicht aus der aufbewahrten Grundlage. Ein kurzer kontextbezogener Hinweis erklärt dies bei entsprechenden Werkzeugen, ohne eine zusätzliche Bestätigung zu verlangen oder die Werkzeuge zu sperren. Bereits öffentliche Originale werden durch eine Kopie weder zurückgezogen noch nachträglich privat.

Die interne Abhängigkeit muss beim vorhandenen kontrollierten Lösch-/Auskunftsprozess zusammen mit Original, Kopien, Zustand und Ressourcen auffindbar sein. Erforderliche Bereinigung löst die Abhängigkeiten kontrolliert von den Kopien zur Grundlage auf; bestehende aktive Inhaltsreferenzen und gegebenenfalls fachliche Löschhürden bleiben maßgeblich. Keine automatische Kaskadenlöschung und keine unbegrenzte Aufbewahrungszusage allein wegen Weiterbearbeitbarkeit. Umfang und Berechtigungen dieser vorhandenen Prozessanbindung werden in der Implementierungsplanung konkretisiert; neue Retention-Jobs oder ein eigenes Datenschutz-Dashboard sind ausgeschlossen.

## 6. Fehler und Bedienbarkeit

- Abbruch im Editor verwirft nur dessen aktuelle Änderungen und erhält den vorherigen Formularentwurf.
- Fehler beim Rendern, Hochladen oder Verarbeiten zeigen übersetzte Meldungen; der Browserentwurf bleibt für eine bewusste Wiederholung erhalten, solange die Seite geöffnet ist.
- Während des Speicherns zeigt die Oberfläche den tatsächlichen Arbeitsschritt, etwa „Bild wird hochgeladen“ oder „Inhalt wird gespeichert“. Fehlermeldungen unterscheiden Bild- und Inhaltsspeicherung und bieten die zum bestätigten Zustand passende nächste Aktion an.
- Wiederholungen dürfen nicht durch denselben Speicherversuch mehrere veröffentlichte Kopien erzeugen; vorhandene Operations-/Upload-Identitäten werden verwendet.
- Technische Content-Save-Timeouts und unklare externe Ergebnisse folgen dem vorhandenen Recovery-Pfad; es wird keine automatische Wiederaufnahme erfunden.
- Bei unklarem Speicherergebnis wird zunächst der vorhandene Operationsstatus geklärt, statt ungeprüft einen neuen Speicherversuch zu starten. Es wird weder fälschlich Erfolg noch ein sicherer Fehlschlag behauptet.
- Beim Verlassen warnt der vorhandene Formularschutz vor ungespeicherten Änderungen. Eine Wiederherstellung nach Browserabsturz oder Reload wird nicht versprochen.
- Studio-eigene Dialograhmen, Metadaten, Status, Variantenprüfung und Abschlussaktionen behalten zugängliche Fokusführung, Tastaturbedienung, Beschriftung und Kontrast. Der zusätzlich Studio-eigene Fokuspunkt erhält eine ohne Zeigegerät bedienbare Eingabe. Deutsche/englische Texte bleiben auch im Spezialeditor erforderlich.
- Die fehlende vollständige Tastatur-/Screenreaderbedienung der Filerobot-Werkzeuge und ihrer Canvas-Objekte ist gemäß ADR-069 akzeptiert. Sie wird dokumentiert, nicht als bestanden getestet und nicht durch eine eigene parallele Objektbedienung kompensiert. Normale Auswahl, Upload und Verwendung eines unverändert übernommenen Bildes bleiben ohne den Spezialeditor erreichbar.
- Die Studio-eigene Abnahme umfasst Default und Forest jeweils in Light/Dark, 200 Prozent Textvergrößerung, Textabstände und Reflow bei 320 CSS-Pixeln beziehungsweise entsprechendem 400-Prozent-Desktopzoom. Normale Texte benötigen mindestens 4,5:1, große Texte und relevante UI-Kontraste mindestens 3:1; vorhandene 44×44-Pixel-Aktionsflächen und zugängliche Tooltips gelten weiter. Theme-Anpassungen der spezialisierten Oberfläche nutzen unterstützte Konfiguration; verbleibende Accessibility-Lücken werden gemäß ADR-069 transparent erfasst, nicht als volle Konformität ausgegeben.
- Text und Markierungen im Bild können relevante Information hinzufügen. Die Oberfläche bietet einen kurzen Hinweis, diese Information im Inhaltskontext auch textlich zugänglich zu machen; bei komplexen Darstellungen kann Fließtext nötig sein. Alt-Text-Hilfe beschreibt den Informationswert im Kontext. Keine automatische OCR, pauschale Pflicht auf jedem Bibliotheksasset oder Sperre der Textfunktion.

## 7. Library-Eignung und Nachweise

Filerobot Image Editor ist gemäß ADR-069 für den vollständigen Funktionsumfang gewählt. Die technische Vorprüfung belegt Grundbetrieb und einen repräsentativen Zustands-Roundtrip; konkrete Versionsbindung, transitive Lizenz-/Sicherheitsprüfung, TypeScript-Grenze und Client-Ladegrenze sind in der Umsetzung abzusichern. Die akzeptierte Accessibility-Abweichung ersetzt diese Nachweise nicht und betrifft nicht die umgebende Studio-Oberfläche.

Entscheidend ist ein Roundtrip mit Zuschnitt, Rotation, Spiegelung, Bildanpassung, Filter, Text und Annotation: speichern, erneut laden, einzelne Objekte ändern und identische übrige Darstellung erhalten. Ebenso werden Schrift-/Ressourcenauflösung und Fokus-/Variantenkoordinaten geprüft. Scheitert ein notwendiger Nachweis, wird die Abweichung vor Umsetzung zur Entscheidung vorgelegt; kein stiller Funktionsabbau, Fork oder zweiter Editor.

Die spätere Testauswahl umfasst:

- Unit-Tests für Metadaten-Patches, Übernahme, Koordinaten und Zustandsvalidierung.
- API-/Persistenztests für Instanz-/Rechtegrenzen, Abhängigkeiten/Löschrennen, Sichtbarkeit, Quote, atomare Veröffentlichung, Wiederholung und Cleanup.
- Browserabnahme für Mediathek und gemeinsamen Picker, lokale Dateien und vorhandene Assets, erneutes Bearbeiten, getrenntes Metadatenspeichern, Abbruch und Fehler.
- Redaktionelle Abnahme ohne vorausgesetzte Schulung: Bild in Nachricht einfügen, Alternativtext nur für diesen Inhalt ändern, Helligkeit korrigieren, wichtige Bildbereiche in Varianten prüfen, Textfehler in einer Kopie korrigieren, nach Speicherfehler fortsetzen und Löschhindernis einer Bearbeitungsgrundlage nachvollziehen. Geprüft werden die tatsächlich erwartete Speicherwirkung, verständliche Aktionen und das Ausbleiben unbeabsichtigter Änderungen; dieser Entwurf enthält noch keinen durchgeführten Nutzertest.
- Charakterisierung aller sechs bestehenden Content-Anbindungen mit ihren tatsächlich unterstützten Verwendungsfeldern; keine neuen Mainserver-Felder nur zur Vereinheitlichung.
- Regression für Waste-Branding mit unmittelbarem Upload und unverändertem Settings-Abschluss sowie für manuelle URLs und abgewiesene geschützte Content-Auswahl.
- Dateiprüfung öffentlicher Ausgabe/Varianten und Netzwerkbeobachtung einer vollständigen Editorsitzung einschließlich Text, Ressourcen und erneutem Öffnen; keine unerwarteten Metadaten, privaten Zustände oder externen Datenübertragungen.
- Positive und negative Zugriffstests auf Kopie und Grundlage sowie Nachweis kontrollierter Löschauflösung ohne neue automatische Kaskade. Keine unberechtigte Detail-/Picker-Projektion des Editorzustands.
- Gezielte Server-Runtime-, Typ-, Security- und Accessibility-Gates entsprechend den betroffenen Pfaden. Keine Code-Testläufe für diesen reinen Dokumentationschange.

## 8. Dokumentation und weitere Schritte

Der [Konzeptabgleich](./concept-review.md) ist auf die vorliegende Überarbeitung bezogen; seine fachlichen Korrekturen gelten als eingearbeitet, nicht als technisch nachgewiesen. Die im aktuellen Accessibility-Leitfaden verlinkte Browser-/AT-Matrix ist unter dem genannten Pfad nicht vorhanden. Vor der Library-Abnahme wird ihre gültige bestehende Quelle geklärt und der Verweis bei Umsetzung korrigiert; dafür entsteht keine zusätzliche parallele Matrix.

Dieser Entwurf erweitert keine aktuelle Produktdokumentation um vermeintlich bereits verfügbare Funktionen. Nach Nutzerprüfung folgt ein konkreter Implementierungsplan einschließlich minimaler Ablageentscheidung und Gates. Bei Umsetzung werden `docs/reference/media-management.md`, tatsächliche Anwender-/Übersetzungsressourcen und arc42 05, 06 und 08 fortgeschrieben. Etwaige Schemaänderungen erfordern vorherige Prüfung und anschließende Aktualisierung beider kanonischer Schemadokumente. Rollouts folgen ausschließlich `docs/guides/studio-rollout-process.md` und benötigen die dafür geltende Freigabe.

## Liefergrenze des PRs

Ziel ist die vollständige Metadatenpflege und der freigegebene gemeinsame Bildeditor innerhalb der bestehenden Medienverwaltung. Maximal betroffen sind `packages/media`, Medienpfade in Datenrepository/Auth-Runtime/Routing/SDK/UI, die vorhandenen Medienverbraucher in App und Plugins, deren Übersetzungen und Tests sowie zugehörige Migration und aktuelle Dokumentation. Nicht-Ziele sind Mainserver-Vertragsänderungen, neue Dienste oder Speicherprovider, weitere Medientypen, DAM-/Ordner-/Versionsverwaltung, automatische Inhaltsmoderation, neue verpflichtende redaktionelle Freigaben sowie Merge und Rollout.
