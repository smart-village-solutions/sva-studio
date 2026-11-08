# Entwurf des Baustellenplugins

## Grundlage und Entscheidung

Gewählt wird ein eigenständiges Fachplugin auf dem bestehenden Mainserver-Datentyp `GenericItem`. Ein bloß vorkonfigurierter generischer Editor würde fachliche Validierung, Rechte und Bedienung nicht ausreichend abbilden. Ein neues Datenmodell im Mainserver würde dagegen bestehende App-Verträge und die bestätigte Liefergrenze verändern.

Das Plugin folgt den aktuellen Studio-Verträgen, insbesondere der exakten GenericItem-Zuständigkeit, dem Create-Onepager, der hostgeführten Mutation und der echten Inhaltshistorie. Das ältere Dokument `docs/superpowers/specs/2026-07-05-generic-item-plugin-pattern-design.md` liefert Hintergrund, ist aber gegenüber dem aktuellen Code und den geltenden Specs nachrangig. Maßgeblich ist das tatsächliche Upstream-Feld `genericType`, nicht die dort teilweise verwendete Bezeichnung `genericItemType`.

### Am 01.11.2026 lokal geprüfte Quellen

Die folgenden Nachweise beziehen sich auf lokale Checkouts und belegen keinen produktiven Versionsstand:

| Quelle                                                                                                                             | Beleg                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Altes CMS, `smart-village-app-cms/app/controllers/constructions_controller.rb`, Zeilen 95–107 und 153–247                          | Anlage und Bearbeitung über `createGenericItem`; Typ `ConstructionSite`; Konvertierung der verschachtelten Felder  |
| Altes CMS, `app/views/constructions/_form.html.erb`, Zeilen 1–151                                                                  | Feldumfang, Pflichtfelder, Kategorienfilter, Standort und Zeitraum                                                 |
| Altes CMS, `app/views/shared/partials/_restrictions_form.html.erb`                                                                 | Mehrere Freitextbeschreibungen unter `payload.restrictions`                                                        |
| App-Checkout `smart-village-app-app/smart-village-app-app-bb-webversion/src/helpers/parser/constructionSiteParser.ts`, Zeilen 3–37 | Erster Zeitraum, Standort, Inhaltsblock, Kategorie und Medieneintrag; alle Einschränkungen                         |
| Derselbe App-Checkout, `src/queries/constructionSite.js` und `src/hooks/constructionSites.ts`                                      | Abfrage von `ConstructionSite`; abgelaufene Enddaten werden im Hook herausgefiltert                                |
| Studio, `packages/plugin-projects/src/plugin.tsx` und `generic-item-ownership.ts`                                                  | Fachplugin mit öffentlichem SDK und exakter GenericItem-Zuständigkeit                                              |
| Studio, `packages/sva-mainserver/src/server/projects-route.ts` und `projects-contract.ts`                                          | Bestehendes Muster für Identität, Autorisierung, frischen Read, Erhalt weiterer Felder und lokale Nachverarbeitung |

Die genannte App-Variante muss vor Implementierung gegen den Zielverbraucher geprüft werden. Insbesondere ist die Kennzeichnung „Geplant“ im Studio keine Zusage, dass die App den Eintrag vor seinem Beginn ausblendet.

## Identität und Zuständigkeiten

| Element                  | Festlegung                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Anzeigename              | Baustellen                                                                                     |
| Plugin/Modul             | `construction-sites`                                                                           |
| Workspace-Package        | `@sva/plugin-construction-sites`                                                               |
| Studio-Content-Type      | `construction-sites.construction-site`                                                         |
| Mainserver-Diskriminator | exakt `ConstructionSite`                                                                       |
| Admin-Basispfad          | `/admin/construction-sites`, unter dem vorhandenen Host-Routing                                |
| Adapterpfad              | `/api/v1/mainserver/construction-sites`, als fachliche Bindung des bestehenden Studio-Adapters |
| Rechte                   | `construction-sites.read`, `construction-sites.create`, `construction-sites.update`            |

Pluginlokal bleiben Fachmodell, Formular, Validierung und fachliches Mapping. Der Host besitzt Authentifizierung, Instanz-/Organisationskontext, Verbindungsauflösung, Provider-Zugriff, Mutationsidentität, Audit, Historie und Nachverarbeitung. Es entsteht kein pluginlokaler zweiter Server oder Provider. Fachliche Adapterlogik folgt dem bestehenden öffentlichen Integrationsvertrag und wächst nicht im App-Composition-Root an.

Das Plugin hängt nicht zur Laufzeit von `plugin-projects`, `plugin-faq` oder `plugin-generic-items` ab. Wiederverwendung erfolgt über vorhandene öffentliche SDK-/UI-Verträge. Die bestehenden Standard-Content-Helpers erzeugen teilweise auch Löschbeiträge; die Umsetzung darf deshalb nicht ungeprüft deren kompletten CRUD-Umfang übernehmen. Für den bestätigten Umfang werden nur die benötigten Beiträge mit vorhandenen SDK-Primitiven registriert; eine neue globale Optionsschicht ist dafür nicht vorgesehen.

## Redaktionelle Bedienung

### Übersicht

Die Liste verwendet die vorhandene Tabellen-, Such- und Pagination-Infrastruktur. Spalten: Titel, primärer Standort, Beginn, Ende, zeitliche Einordnung, letzte Änderung. Filter: Titel, Kategorie und Überlappung mit einem gewählten Zeitraum. Leere, ladende, fehlerhafte und nicht berechtigte Zustände sind unterscheidbar.

Filter und Sortierung gelten für den gesamten autorisierten fachlichen Datenbestand, nicht nur die gerade geladene Seite. Es werden nur exakte `ConstructionSite`-Einträge angezeigt; vollständig herausgefilterte Upstream-Seiten dürfen nicht fälschlich als Listenende gelten. Ausgeblendete, aber lesbare Einträge müssen für die redaktionelle Bearbeitung auffindbar bleiben.

Die Einordnung verwendet den primären Datumsbereich und Kalendertage: „Geplant“ bei künftigem Beginn, „Laufend“ einschließlich Beginn und Ende, „Beendet“ nach dem Ende. Fehlende, ungültige oder widersprüchliche Grenzen ergeben „Zeitraum unvollständig“. Sie wird beim Lesen berechnet und nicht gespeichert. Für Kalendertagsvergleiche wird die bestehende Instanz-/Datumslogik verwendet; die Server-Prozesszeitzone ist kein fachlicher Default.

### Erstellung und Bearbeitung

Erstellung als ein Formular ohne Wizard oder Editor-Tabs, in dieser Reihenfolge:

1. Titel und weitere Informationen.
2. Beginn und Ende.
3. Richtung, Grund und wiederholbare Einschränkungen.
4. Standort mit Bezeichnung, Karte und Koordinatenfeldern.
5. Kategorien.
6. Dateien mit Reihenfolge und unterstützten Metadaten.
7. Vorhandene Host-Steuerung für Identität/Sichtbarkeit, Erklärung der tatsächlichen Speicherwirkung und Speichern/Abbrechen.

Die optionale Beschreibung nutzt den bestehenden Texteditor und dessen sicheren HTML-Vertrag. Dateien und Kategorien besitzen einen sichtbaren Einstieg und eine Zusammenfassung; das Öffnen eines Bereichs erzeugt keine Daten. „Eingrenzung“ aus dem alten CMS wird als „Einschränkungen“ bezeichnet; gespeichert wird unverändert `restrictions`.

Bearbeitung verwendet dieselben Feldkomponenten und denselben Formularzustand in den vertrauten Detailbereichen „Basis“, „Inhalt“ und „Historie“. Basis enthält Titel, Zeitraum und vorhandene Ownership-/Sichtbarkeitssteuerung; Inhalt enthält Beschreibung, Verkehrsangaben, Standort, Kategorien und Medien. Die Historie lädt echte Host-Einträge einschließlich Lade-/Leer-/Fehlerzustand. Bei Erstellung gibt es keine leere Historienansicht.

Alle Eingaben sind beschriftet, Pflichtfelder und optionale Abschnitte erkennbar. Fehlermeldungen erscheinen am Feld und in einer verlinkten Zusammenfassung; geschlossene fehlerhafte Abschnitte öffnen sich vor dem Fokuswechsel. Karte und Maus sind nicht zur Standorterfassung erforderlich. Verlassenswarnung und Speicherfeedback stammen aus den bestehenden Komponenten. Neue Texte und Hilfen erhalten de-/en-Schlüssel; UI und Tastaturbedienung erfüllen WCAG 2.1 AA.

## Felder und Validierung

| Fachfeld              | Mainserver-Vertrag                                   | Regel                                                                                |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Titel                 | `title`                                              | Getrimmt, nicht leer                                                                 |
| Weitere Informationen | `contentBlocks[].body`                               | Optional; keine zusätzliche Kopie in `payload`                                       |
| Beginn/Ende           | `dates[].dateStart`, `dateEnd`                       | Primärer Bereich vollständig, gültige Kalendertage, Ende ≥ Beginn                    |
| Richtung              | `payload.direction`                                  | Optionaler Freitext                                                                  |
| Grund                 | `payload.cause`                                      | Optionaler Freitext                                                                  |
| Einschränkungen       | `payload.restrictions[].description`                 | Wiederholbar, Reihenfolge erhalten; rein leere neue Zeilen nicht speichern           |
| Standort              | `locations[].name`, `geoLocation.latitude/longitude` | Optional; Koordinaten entweder beide leer oder beide endlich und in gültigem Bereich |
| Kategorien            | `categories[]`                                       | Bestehende Auswahl; baustellenkompatible oder ungetaggte Kategorien                  |
| Dateien               | `mediaContents[]`                                    | Vorhandener Medienvertrag einschließlich Rechte, URL-Regeln und Metadaten            |

Beide Datumsfelder werden bei Neuanlage mit heute vorbelegt. Beim Bearbeiten gibt es keine Default-Ersetzung fehlender Bestandsdaten. Ein bewusst gesetztes Enddatum wird durch eine Änderung des Beginns nicht überschrieben; ein widersprüchlicher Zeitraum erzeugt einen Fehler. Zahlenwert null ist als Koordinate gültig und darf nicht als leer behandelt werden. Unvollständige Koordinaten werden nicht zu null konvertiert.

Fachlich am 01.11.2026 ausdrücklich akzeptiert: Beim Speichern dürfen Zuordnungen zu deaktivierten Kategorien entfallen. Sie werden nicht wiederhergestellt und bei späterer Reaktivierung nicht automatisch erneut zugeordnet. Diese Ausnahme gilt ausschließlich für deaktivierte Kategoriezuordnungen; übrige Inhalte und Beziehungen bleiben geschützt. Neue Zuordnungen werden serverseitig gegen die bestehende Kategorie-/Instanzpolitik geprüft. Client und Server prüfen denselben fachlichen Eingabevertrag.

## Bestandsdaten und App-Kompatibilität

Der erste Zeitraum, Standort und Inhaltsblock wird als primär gekennzeichnet. Weitere vorhandene Einträge werden bei der Bearbeitung zugänglich dargestellt und mit ihren nicht bearbeiteten Metadaten erhalten; die Neuanlage beginnt jeweils mit einem primären Eintrag. Kategorien und Dateien bleiben mehrfach zuordenbar. Die erste Kategorie wird im geprüften App-Parser als Kategorie verwendet.

Die geprüfte App interpretiert den ersten Medieneintrag als Bild. Das Formular erläutert diese Wirkung, ohne Audio, Video oder Anhänge als überall darstellbar zu versprechen. Neu gewählte Reihenfolgen sind explizite Nutzeränderungen. Vorhandene Reihenfolgen werden weder automatisch sortiert noch stillschweigend „repariert“.

Bekannte Payload-Felder besitzen einen getypten Fachvertrag. Unbekannte Schlüssel bleiben im frisch geladenen Provider-Bestand erhalten, auch innerhalb unverändert übernommener Einschränkungen und weiterer verschachtelter Objekte. Das Formular sendet keine frei vertrauenswürdige Bestandskopie als Quelle für opake Felder; der Server ergänzt die autorisierten Änderungen in seinen eigenen frischen Read.

Fehlende Pflichtangaben können redaktionell korrigiert werden. Unbekannte oder beschädigte Strukturen werden nicht automatisch in leere Listen umgewandelt. Kann der bestehende Lese-/Schreibvertrag den Erhalt nicht sicherstellen, bleibt die Anzeige lesbar und die betroffene Mutation wird vor dem Write mit einer konkreten Erklärung blockiert. Ein beschädigtes Payload-Objekt wird insbesondere nicht durch `{}` ersetzt. Es gibt keinen freien JSON-Editor als Umgehung.

## Schreibfluss und Vertrauensgrenzen

1. Der Host prüft Session, aktive Instanz, Plugin-Aktivierung, Fachrecht, Organisation, Mutationsidentität und den bestehenden CSRF-Vertrag.
2. Der Server validiert den fachlichen Input. Ein vom Client mitgegebener Typ oder Provider ersetzt keine serverseitige Typ-/Zugriffsprüfung.
3. Bei Bearbeitung wird unter dem bestehenden Mutationsschutz frisch mit der tatsächlich verwendeten Identität gelesen. Typ und Provider-/Objektberechtigung werden erneut geprüft. Ein Vergleich mit dem beim Laden erfassten Baseline-Zustand erkennt zwischenzeitliche Inhaltsänderungen; `updatedAt` allein gilt nicht als Inhaltsnachweis.
4. Das fachliche Mapping ersetzt nur explizit bearbeitete Werte und erhält den übrigen aktuellen Bestand. Leeren, Entfernen und Weglassen sind unterscheidbare Operationen. Nicht vollständig lesbare Pflichtgruppen dürfen keine Vollersetzung auslösen.
5. Der vorhandene Studio-Adapter schreibt über `createGenericItem`; Updates behalten die vorhandene GenericItem-ID. Identität, Kategorien, Relationen und leere Werte werden vor Aktivierung gegen den tatsächlichen Upstream-Vertrag nachgewiesen.
6. Eine unabhängige Detailabfrage prüft die beabsichtigte Änderung und den Erhalt relevanter unberührter Daten. Danach erfolgen die vorhandenen lokalen Bindungs-, Projektions-, Medien- und Historienarbeiten.
7. Die Antwort unterscheidet vollständigen Erfolg, Provider-Erfolg mit ausstehender lokaler Nachverarbeitung und unklaren Provider-Ausgang. Bei unklarem Ausgang kein blinder Write-Retry; Wiederaufnahme über bekannte ID und bestehende Operations-/Readback-Verträge. Ein fehlgeschlagener Medienreferenzschritt wiederholt keine Content-Anlage.

Sichtbarkeit und Baustellenzeitraum sind getrennte Aspekte. Eine reine Inhaltsänderung erhält die bestehende Sichtbarkeit. Die Darstellung einer Sichtbarkeitssteuerung und der Create-Default folgen dem vorhandenen Host-Vertrag; eine explizite Änderung braucht zusätzlich dessen Veröffentlichungsautorisierung. Ohne Veröffentlichungsrecht darf die Anlage nicht durch einen impliziten Default sichtbar werden. Der Baustellenzeitraum löst keine Veröffentlichung, Archivierung oder Hintergrundaktion aus.

Lokale Locks koordinieren keine Writes des alten CMS oder fremder Importer. Baseline-Vergleich und Readback verringern das Risiko, sind aber ohne atomare Upstream-Versionsprüfung keine vollständige Sperre gegen Änderungen zwischen letztem Read und Write. Dieses Restrisiko muss im Implementierungsnachweis sichtbar bleiben; eine Mainserver-Erweiterung oder zentrale Sperrplattform entsteht aus diesem Change nicht.

## Invarianten und geplante Nachweise

| Invariante                                                                  | Nachweis                                                                                                                                                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exakter Typ, Instanz, Provider und Identität bei jedem Zugriff              | Routen-/Adaptertests mit fremden IDs, falschem Typ, fehlenden Rechten, deaktiviertem Modul und unterschiedlichen Organisationen                                                    |
| Keine Reduktion von Bestandsdaten                                           | Roundtrip-Fixtures mit mehreren Relationen, opaken Payload-/Unterobjektfeldern, Metadaten und unveränderter Reihenfolge; tatsächliche Request-Variablen plus unabhängiger Readback |
| Hauptangaben entsprechen dem bestehenden App-Verbrauch                      | Parser-/Mapping-Fixtures und gesonderte Prüfung einer neuen und einer bearbeiteten Baustelle in der Ziel-App                                                                       |
| Zeitliche Einordnung hat keine Schreibwirkung                               | Grenztag-, Schaltjahr-, unvollständige Daten- und Zeitzonentests; keine Mutation durch Listenaufruf                                                                                |
| Kein unbemerkter Lost Update oder blinder Retry im erkennbaren Konfliktfall | Geänderter Baseline-Bestand, Antwortverlust nach Write, erneuter Klick und lokale Nachverarbeitungsfehler; Rest-Race ausdrücklich dokumentieren                                    |
| Bedienbarkeit und echte Historie                                            | Gezielte E2E-Prüfung von Create/Edit, Feldfehlerfokus, Tastatur, Verlassenswarnung, Rechtezuständen und Historie                                                                   |

## Umsetzung, Aktivierung und Rücknahme

Die [Aufgabenliste](./tasks.md) ordnet die Umsetzung in Vertragsnachweis, Adapter/Integration, Oberfläche und Abnahme. Das sind Arbeitsschritte eines begrenzten Features, kein Auftrag für einen PR-Stack.

Bestehende Daten bleiben im Mainserver. Das Modul wird über die vorhandenen Plugin-/Distributionskataloge und Instanzaktivierung eingebunden. Ohne registrierte Fachzuständigkeit gilt der bestehende generische Fallback; fehlende Fachrechte erzeugen in der gemeinsamen Übersicht keinen generischen Ersatz. Ein technischer Generic-Items-Zugriff bleibt ein separat autorisierter bestehender Pfad.

Rücknahme erfolgt über vorhandene Plugin-Aktivierung oder regulären Rollback; keine Datenrückmigration. Bei Umsetzung werden arc42 04/05/06/08/10 sowie die verantwortliche Anwender- und Referenzdokumentation gezielt fortgeschrieben. Die lokale Implementierung und ihre Nachweise stehen in der Aufgabenliste; der Change ist noch nicht ausgerollt.

Vor externen Schreibtests werden Zielinstanz, Konto/Identität und isolierte Testdatensätze konkret benannt und freigegeben. Ohne diese Freigabe bleiben Vertrags- und UI-Tests lokal. Ein regulärer Rollout richtet sich ausschließlich nach `docs/guides/studio-rollout-process.md`.

## Vertragsprüfung nach Umsetzungsfreigabe am 01.11.2026

### Status und Quellenqualität

Der Plan ist zur Umsetzung freigegeben. Der eigene Branch `feature/construction-sites-plugin` basiert auf Studio-HEAD `2de63c21d10a053a3ea1ba816e7c52ae528bb71b`; außer den eigenen, bisher ungetrackten Konzeptdateien lag kein fremder Arbeitsstand im Studio vor. Dies war der Stand der Vorprüfung; die anschließende lokale Produktimplementierung ist in der Aufgabenliste dokumentiert.

Die zusätzliche Prüfung verwendet den neueren lokalen Checkout `SVA-Gitlab/mainserver/smart-village-app-mainserver`, HEAD `76d2e12a`, Commitdatum 05.10.2026. Die unten genannten Quelldateien sind dort unverändert. Der ältere Checkout `SVA/smart-village-app-mainserver` auf `37f86dce` vom 06.11.2024 ist für diese Schlussfolgerungen nicht maßgeblich. Keiner der Checkouts ist damit bereits als produktiver Versionsstand verifiziert; eine Live-Schreibprüfung fand nicht statt.

XERJ lieferte für Studio den Indexstand `60059753b161236d0fd0b1ca6ffd99ab5feb2a48`, abweichend vom aktuellen HEAD. Deshalb wurden die Treffer am aktuellen Projektpfad nachgelesen. Die Payload-Referenzen lieferten keinen unmittelbar passenden Mechanismus für diesen externen destruktiven Update-Vertrag; aus ihnen wurde kein Code übernommen.

### Befunde an derselben Invariante: nicht bearbeitete Daten erhalten

1. **Unsichtbare Kategorien:** Im neueren Mainserver liefert `app/graphql/types/query_types/generic_item_type.rb:52–54` für einen Datensatz nur `object.categories.active`. `app/services/resource_service.rb:285–286,315–329` nimmt dagegen sämtliche Kategorien in die beim regulären GraphQL-Update zu löschenden Zuordnungen auf und baut anschließend aus dem Request neu auf. Eine nicht als Default wieder hinzugefügte inaktive Altzuordnung ist im Detail-Read nicht enthalten, kann aber durch eine reine Titeländerung verloren gehen. Auch der nachfolgende Detail-Read blendet sie aus und kann diesen Verlust daher nicht beweisen oder ausschließen.
2. **Nicht vollständig abgebildete abhängige Beziehungen:** Dasselbe `update_resource` ersetzt weitere `dependent: :destroy`-Beziehungen. Die aktuelle Studio-Abfrage in `packages/sva-mainserver/src/generated/generic-items.ts:296–345` enthält beispielsweise `companies`, `genericItemMessages` und `pushNotifications` nicht. Die Lese-/Schreibmatrix muss deshalb vollständig gegen den tatsächlich verwendeten Updatepfad geprüft werden. Für nicht wiederherstellbare Beziehungen genügt nur eine vor dem Write verlässliche Erkennung und Ablehnung; ein Readback allein verhindert keinen Verlust.
3. **Toleranter Read verliert seine Warnungen:** `mapGenericItemDetail` liefert `deviations`, doch `mapGenericItem` in `packages/sva-mainserver/src/server/service-internals/generic-item-mappers.ts:160–175` reduziert auf `.data`. `getGenericItemWithConfig` in `generic-item-operations.ts:99` verwendet diesen reduzierten Pfad. Ein schreibender Verbraucher kann dadurch über diesen Vertrag nicht unterscheiden, ob eine Liste tatsächlich leer war oder fehlerhafte Einträge ausgelassen wurden. Die bestehenden Mappertests zeigen dieses tolerante Verhalten ausdrücklich; ein erfolgreicher Mappertest belegt keinen verlustfreien Write.

Die alternative Nested-Sync-Logik des Mainservers löst den Nachweis für diese Mutation derzeit nicht: `resource_service.rb:504–509` aktiviert sie über einen Importkontext, den `create_generic_item.rb` beim gewöhnlichen GraphQL-Aufruf nicht setzt. Zusätzliche Inventurabfragen über Kategorien oder globale Beziehungen wären erst auf vollständige Sichtbarkeit und dieselbe Identität zu prüfen; ein unbewiesener Scan ist kein Ersatz für einen vollständigen Schreibvertrag.

### Konsequenz und begrenzter Korrekturvorschlag

Die Vorprüfung hatte Aufgabe 1.2 zunächst angehalten. Nach der ausdrücklichen fachlichen Akzeptanz des Entfalls deaktivierter Kategoriezuordnungen wird die Umsetzung fortgesetzt. Für die verbleibenden Befunde wird der vorhandene Studio-Adapter um einen vollständigen, streng geprüften Baustellen-Read/Write-Vertrag ergänzt; nicht verlustfrei bearbeitbare Bestände werden vor dem Write abgewiesen. Die Ausnahme für Kategorien ist keine allgemeine Datenverlustfreigabe.

Ursprünglich vorgeschlagene, inzwischen für diesen Lieferabschnitt verworfene Alternative: Der vorhandene GenericItem-Vertrag muss für berechtigte redaktionelle Updates unveränderte Beziehungen serverseitig erhalten und vollständig lesbare versus ausgelassene Daten erkennbar machen. Vorzugsweise wird dafür der bestehende Updatepfad begrenzt erweitert, ohne neuen Dienst oder zweite fachliche Datenhaltung. Die genaue Änderung und ihre Kompatibilität sind im verantwortlichen Mainserver-Repository separat zu entwerfen; dessen Änderung ist vom bisherigen Studio-Auftrag ausdrücklich ausgeschlossen.

Der konkrete Nachweis vor erneutem UI-Ausbau ist ein Roundtrip mit einer aktiven und einer inaktiven, nicht als Default konfigurierten Kategorie, weiteren unangetasteten Relationen und einem beschädigten Leseeintrag: Titeländerung erhält aktive Zuordnungen und übrige Inhalte; die deaktivierte Zuordnung darf ausdrücklich entfallen. Ein unvollständiger oder nicht wiederherstellbarer übriger Bestand verhindert den Write. Die Fixture bildet den aktiven Filter der Mainserver-Antwort und die ersetzende Mutation ab; ein einfacher Echo-Mock reicht nicht.

Ein auf Lesen und Neuanlage reduzierter erster Lieferabschnitt wäre technisch ein anderer möglicher Zuschnitt, erfüllt aber die freigegebene Erstellung **und Bearbeitung** nicht. Die anschließende explizite Akzeptanz deaktivierter Kategoriezuordnungen ist oben dokumentiert. Ein reduzierter Lieferumfang oder Verlust anderer Inhalte ist weiterhin nicht freigegeben.
