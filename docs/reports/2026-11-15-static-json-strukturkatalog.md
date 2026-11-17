# Lokaler Strukturkatalog der SaaS Static JSONs

Stand: 15. November 2026. Abgeschlossener erster Analyseschritt: Erfassung der tatsächlich gespeicherten JSON-Strukturen. Der Abgleich mit Mainserver- und App-Code sowie jede Studio-Integration sind ausdrücklich nicht Bestandteil dieses Schritts.

## Lokale Datenbank und Quellen

Die SQLite-Datenbank liegt im Studio-Checkout unter `artifacts/static-json-catalog/catalog.sqlite`. Der Ordner ist bereits durch `.gitignore` ausgeschlossen; die Datei hat lokale Zugriffsrechte `0600`. Der Katalog enthält keine vollständigen Inhaltswerte und keine Kopien der JSON-Dokumente. Gespeichert sind Strukturpfade, Typen, Vorkommenszahlen und Herkunftsmetadaten einschließlich Datensatz-ID, Kommune und Versionsangabe. Frei benannte Objektschlüssel bleiben Teil der Struktur und sind deshalb ebenfalls lokal zu behandeln.

| Quelle | Umfang und Erhebungsart |
| --- | --- |
| `saas-sva-app.static_contents` | Vorhandener SQL-Dump vom 15. November 2026, 10:22 Uhr Europe/Berlin, gefiltert auf `data_type = 'json'`; 866 Datensätze |
| `saas-sva-app.default_static_contents` | Gesonderte lesende Abfrage am 15. November 2026 über Planetary-Endpoint `sva`, Stack `saas-database`, Service `mysql`; 10 JSON-Vorlagen |

Die Quellen stammen aus zwei getrennten Erhebungen und bilden keinen gemeinsamen transaktionalen Snapshot. Herkunft, Quellprüfsummen und Erfassungszeit sind in `sources` hinterlegt. Bei der Dump-Quelle bezeichnet `acquired_at` die Katalogerfassung; der frühere Snapshot-Zeitpunkt steht in `note`.

Der MySQL-Dump wurde als Text mit einem Literal-Parser gelesen und nicht als SQL ausgeführt. Die Vorlagen wurden als gespeicherter Text untersucht; Liquid-Platzhalter wurden nicht gerendert. Produktivdaten wurden nicht geändert. Der Katalog ist kein Datenbackup und kein vollständiger Import der SaaS-Tabellen.

## Aufbau der SQLite-Datei

| Tabelle oder View | Zweck |
| --- | --- |
| `sources` | Herkunft, Quelltabelle, Erhebungsart und Prüfsumme |
| `documents` | Ein Quellen-Datensatz mit Name, Kommune, Version, Zeitstempeln, Inhaltsgröße, Parserstatus und Wurzeltyp; ohne Inhalt |
| `fields` | Beobachteter Pfad je Quelltabelle und JSON-Name, Elternpfad, Schlüssel und Knotenkategorie |
| `observations` | Je Dokument, Feld und Datentyp die Anzahl beobachteter Knoten |
| `issues` | Parserbefunde und doppelte Schlüssel mit Fundstelle; ohne Inhaltsauszüge |
| `field_summary` | Aggregierte Typen und Vorkommen je Feld sowie Anzahl parsebarer Dokumente desselben Namens und derselben Quelltabelle |
| `json_summary` | Dokument-, Kommunen-, Versions- und Pfadzahlen je JSON-Name und Quelltabelle |

Alle Felder beginnen mit `clarification_status = 'unreviewed'`; Beschreibungen bleiben offen. Es wurden keine Pflichtfelder oder Standardwerte aus dem Code übernommen oder aus der Häufigkeit abgeleitet. Die Ersterfassung verwendete `PRAGMA user_version = 1`, die Zweckzuordnung Version 2, die Parameter-Clusterung Version 3, der Codeabgleich der 22 Query-Bezeichner Version 4 und die anschließende breite statische Schlüsselprüfung Version 5.

### Pfade und Zählweise

- Die Wurzel heißt `$`, ein Objektschlüssel beispielsweise `$["settings"]["locationService"]`.
- Array-Indizes werden zu `[*]` zusammengefasst, beispielsweise `$["tabConfigs"][*]["screen"]`. Objektschlüssel werden nicht automatisch zu Wildcards verallgemeinert.
- Gezählt werden auch Wurzel-, Objekt- und Array-Knoten. Eine Pfadzahl ist deshalb keine Anzahl ausschließlich terminaler Key-Value-Paare.
- Leere Arrays erzeugen einen Array-Knoten, aber keinen erfundenen Elementtyp.
- `null`, `boolean`, `integer`, `number`, `string`, `object` und `array` werden unterschieden. `number` bezeichnet hier einen vom Parser als Fließkommazahl gelesenen Wert; die zusätzliche Unterscheidung zu `integer` ist eine Beobachtung, kein fachlicher Vertrag.
- `documents_with_path` zählt Dokumente, `node_occurrences` zählt Knoten einschließlich mehrfacher Vorkommen innerhalb von Arrays. Das bloße Vorkommen eines Pfads in einem Dokument beweist nicht, dass jedes Array-Element diesen Pfad besitzt.
- JSON-Namen und Schlüssel werden mit ihrer Schreibweise erhalten. Beispielsweise werden `wasteTypes` und `wastetypes` zunächst getrennt ausgewiesen. Die Namenszahl bezeichnet beobachtete Bezeichnungen, keine bestätigten fachlichen Typen.
- Doppelte Objektschlüssel werden erkannt. Für die Strukturerfassung bleiben beide Vorkommen sichtbar, statt eines davon stillschweigend zu verwerfen.

## Erste Ergebnisse

| Merkmal | Ergebnis |
| --- | ---: |
| JSON-Datensätze in `static_contents` | 866 |
| Unterschiedliche gespeicherte Namen in `static_contents` | 366 |
| Kommunen in diesen Datensätzen | 45 |
| Parsebare Inhalte in `static_contents` | 863 |
| Nicht als JSON parsebare Inhalte in `static_contents` | 3 |
| JSON-Vorlagen, alle parsebar | 10 |
| Strukturpfade aus `static_contents` | 7.168 |
| Strukturpfade aus `default_static_contents` | 267 |
| Dokument-/Pfad-/Typ-Beobachtungen insgesamt | 21.965 |
| Pfade mit mehreren beobachteten Typen, beide Quellen | 42 |
| Namen mit mehreren beobachteten Strukturvarianten in `static_contents` | 47 |
| Datensätze mit ausgefüllter Version in `static_contents` | 136 |
| Unterschiedliche ausgefüllte Versionsangaben | 31 |

Eine Strukturvariante wurde als Menge der beobachteten Pfad-/Typ-Paare pro parsebarem Dokument bestimmt. Inhaltswerte und die bloße Anzahl gleichartiger Array-Elemente gehen nicht in diese Unterscheidung ein. Unterschiede zwischen Kommunen und Versionen sind darin gemeinsam enthalten; sie sind noch nicht als Fehler oder Versionsänderung bewertet.

### Häufige Namen

| Name | Datensätze | Kommunen | Beobachtete Strukturpfade |
| --- | ---: | ---: | ---: |
| `globalSettings` | 75 | 44 | 932 |
| `homeService` | 56 | 36 | 105 |
| `tabNavigation` | 46 | 35 | 76 |
| `homeCarousel` | 39 | 38 | 44 |
| `mapSettings` | 39 | 38 | 664 |
| `about` | 30 | 25 | 36 |
| `appIntroSlides` | 26 | 24 | 27 |
| `homeAbout` | 26 | 23 | 20 |

Beispiele für beobachtete Typvarianten sind `globalSettings.settings.locationService` als Objekt oder Boolean, `globalSettings.sections.categoriesNews[*].categoryId` als Integer oder String und `tabNavigation.tabConfigs[*]` als String oder Objekt. Diese Varianten sind Bestandsbeobachtungen und ohne Codeabgleich weder als erlaubt noch als fehlerhaft eingestuft.

### Gesondert erfasste Befunde

| Quellen-ID in `static_contents` | JSON-Name | Kommune | Version | Befund |
| --- | --- | ---: | --- | --- |
| 766 | `vereine-und-ehrenamtContent` | 26 | `4.0.3` | JSON-Parserfehler in Zeile 1, Spalte 1 |
| 1246 | `homeLiveTicker` | 36 | unversioniert | JSON-Parserfehler in Zeile 1, Spalte 1 |
| 1344 | `homeLiveTicker` | 24 | unversioniert | JSON-Parserfehler in Zeile 1, Spalte 1 |
| 1796 | `globalSettings` | 29 | `4.3.1` | Schlüssel `settings.search` innerhalb desselben Objekts zweimal vorhanden |

Nicht parsebare Dokumente besitzen weiterhin Herkunftsdatensätze und Befunde im Katalog, liefern aber keine Strukturbeobachtungen. Es wurden keine Inhalte repariert oder verworfen.

## Abfragen für die weitere Arbeit

Die folgenden Abfragen sind direkt in einem SQLite-Werkzeug ausführbar:

```sql
-- Namen und Umfang der vorhandenen JSONs
SELECT * FROM json_summary
ORDER BY source_table, document_count DESC, json_name;

-- Beobachtete Struktur von globalSettings
SELECT path, observed_types, documents_with_path, valid_documents
FROM field_summary
WHERE source_table = 'static_contents' AND json_name = 'globalSettings'
ORDER BY path;

-- Pfade mit unterschiedlichen Werttypen
SELECT source_table, json_name, path, observed_types
FROM field_summary
WHERE observed_types LIKE '%,%'
ORDER BY source_table, json_name, path;

-- Parserbefunde und doppelte Schlüssel einschließlich Quellen-ID
SELECT s.source_table, d.source_record_id, d.json_name,
       d.municipality_id, d.app_version, i.*
FROM issues i
JOIN documents d ON d.id = i.document_id
JOIN sources s ON s.id = d.source_id;
```

## Ergänzung: Zweckzuordnung und wiederkehrende Strukturmuster

Auf Grundlage der gewünschten Unterscheidung zwischen App-Settings und Navigation wurde die bestehende Tabelle `fields` um fünf Spalten ergänzt. Die gespeicherten Quellen, Dokumente, Typbeobachtungen und Befunde bleiben erhalten.

| Spalte | Bedeutung |
| --- | --- |
| `purpose_group` | Settings, Navigation/Seitenaufbau, ergänzende Inhalte, Dienstkonfiguration oder gemischter Container |
| `structure_pattern` | Beobachtetes Strukturmuster, beispielsweise Kacheleintrag, verschachtelte Liste, Tab-Konfiguration, Carousel oder Inhaltsverweis |
| `field_role` | Rolle des Schlüssels, beispielsweise Zielparameter, Query-Parameter, Anzeigetext oder möglicher Inhaltsverweis |
| `assignment_basis` | Begründung anhand der Struktur oder des Namens; bei vererbter Zuordnung Verweis auf den Elternpfad |
| `assignment_status` | Für alle erfassten Pfade `data_inferred`: aus Bestandsdaten abgeleitet, nicht im Code bestätigt |

Die View `classification_summary` zeigt die Zuordnung je JSON-Name und Quelltabelle. Sie enthält die Kategorie des Wurzelknotens, das Strukturmuster und die enthaltenen Gruppen. `name_binding = 'not_checked'` hält ausdrücklich fest, dass die Unterscheidung zwischen fest vorgesehenen und frei vergebenen JSON-Namen noch nicht durch Codeprüfung bestätigt wurde. Ein sprechender Name allein ist dafür kein Nachweis.

### Zuordnung der gespeicherten Namen

Die folgenden Zahlen beziehen sich auf die 366 unterschiedlich geschriebenen Namen aus `static_contents`, nicht auf die 866 einzelnen Datensätze:

| Gruppe | Wert in der DB | Namen |
| --- | --- | ---: |
| Navigation und Seitenaufbau | `navigation` | 305 |
| App-/Modul-Settings | `settings` | 6 |
| Gemischte Bereiche | `mixed` | 10 |
| Ergänzende Inhalte | `content` | 40 |
| Dienstkonfiguration, vorläufig anhand der gespeicherten Struktur | `service_config` | 4 |
| Ohne parsebare Struktur | `unknown` | 1 |

Bei den 10 Vorlagennamen ergeben sich sieben Navigationsstrukturen, ein Settings-Bereich und zwei gemischte Strukturen. Insgesamt sind die 7.435 Pfade zugeordnet: 5.006 Navigation, 2.137 Settings, 244 Inhalte, 21 Dienstkonfiguration und 27 gemischte Container. Die Zahl gemischter Container ist keine zusätzliche Menge von Dokumenten.

### Vorgehen und Beispiele

- Kacheleinträge und Navigationslisten werden anhand von Routen, Zielparametern, Icons und `children`-Strukturen erkannt. Beschriftungen und Gestaltung eines Navigationseintrags gehören zum jeweiligen Eintrag; sie werden nicht pauschal zu eigenständigen Settings erklärt.
- Wiederkehrende Formen bleiben als Muster sichtbar, unter anderem `tile_entries`, `tile_entry`, `nested_list`, `tab_configuration`, `navigation_map`, `list_entries` und `content_reference`. Gleiche Muster beweisen noch kein identisches fachliches Schema.
- Bei `globalSettings` bleiben gewöhnliche Funktions- und Darstellungseinstellungen unter Settings. `homeScreenConfig` und `widgets` werden als Seitenaufbau eingeordnet. Eingebettete Zielaktionen oder Inhaltsverweise erhalten eine eigene Navigationszuordnung. Der skalare Schlüssel `globalSettings.navigation` bleibt dagegen als Moduswahl unter Settings.
- Bei `tabNavigation` gehören `tabConfigs` zur Navigation; übergreifende Tab-Farben und Darstellungseinstellungen gehören zu Settings. Die Gesamtstruktur ist damit gemischt.
- `homeCarousel`, `sueHomeCarousel` und `homeDisturber` verbinden Inhaltsbereiche mit eigenen Navigationsaktionen. `homeLiveTicker` verbindet Text mit `liveTickerSettings`. Diese Namen sind entsprechend gemischt eingeordnet.
- `mapSettings` und Abfallartenkonfigurationen bleiben Settings. Ein `queryVariables`-Objekt macht eine Kartenkonfiguration nicht automatisch zur Navigation. Die Rolle Query-Parameter wird unabhängig von der Zweckgruppe erfasst.
- Hinweise auf Dienstkonfigurationen wie `feeds` mit Datenanbieterzuordnung beziehungsweise `app_name` und `mail_footer` werden separat geführt. Ihre Verbraucher werden hier nicht neu im Code geprüft.

32 Pfade sind als `content_reference_candidate` markiert, beispielsweise `staticJsonName`, `contentName`, `publicJsonFile` oder `carouselPublicJsonFile`. Bei `queryVariables.name` wird lediglich `query_argument_name_candidate` hinterlegt: Ohne Kenntnis der zugehörigen Query darf daraus kein sicherer JSON-Verweis abgeleitet werden.

Die Zuordnung speichert keine neuen Inhaltswerte. Deshalb ist die Kennzeichnung möglicher Referenzfelder noch kein aufgelöster Referenzgraph. Ob ein Ziel existiert und für dieselbe Kommune sowie Versionsauswahl passend ist, wurde nicht geprüft. Frei benannte Objektbereiche und JSON-Namen werden nicht automatisch zusammengelegt.

Die vier bereits besprochenen Parser-/Duplikatbefunde bleiben aus Nachweisgründen vorhanden und werden gemäß Nutzerentscheidung vorerst ignoriert. Sie blockieren die Zuordnung nicht. Der einzige Name ohne Zuordnung mangels Struktur ist `vereine-und-ehrenamtContent`.

### Abfragen zur Zuordnung

```sql
-- Übersicht je Name, einschließlich gemischter Strukturen
SELECT source_table, json_name, purpose_group, structure_pattern,
       contained_groups, name_binding
FROM classification_summary
ORDER BY source_table, purpose_group, json_name;

-- Settings und Navigation innerhalb von globalSettings unterscheiden
SELECT path, purpose_group, structure_pattern, field_role, assignment_basis
FROM fields
WHERE source_table = 'static_contents' AND json_name = 'globalSettings'
ORDER BY path;

-- Wiederkehrende Formen über frei benannte JSONs hinweg
SELECT source_table, structure_pattern, COUNT(DISTINCT json_name) AS names
FROM fields
WHERE purpose_group = 'navigation'
GROUP BY source_table, structure_pattern
ORDER BY names DESC;

-- Mögliche Inhaltsverweise und ihre Fundstellen
SELECT source_table, json_name, path, assignment_basis
FROM fields
WHERE field_role = 'content_reference_candidate'
ORDER BY source_table, json_name, path;
```

Die Zuordnung ist eine erste datenbasierte Arbeitshypothese. Insbesondere belegen die sechs ausschließlich als Settings eingeordneten Namen nicht, dass Settings nur in sechs Dateien vorkommen: Weitere Settings liegen in gemischten Strukturen. Semantik, tatsächlich ausgewertete Schlüssel und feste Bezeichner bleiben bis zum Codeabgleich offen.

## Ergänzung: Cluster der Navigations- und Query-Parameter

Die Navigationsparameter wurden erneut aus den 863 parsebaren Originaldokumenten des unveränderten Dumps von `static_contents` gelesen. Seine SHA-256-Prüfsumme wurde gegen den Katalog geprüft. Die zehn Vorlagen sind in diesem Analyseschritt nicht enthalten: Im Katalog liegen ihre Strukturbeobachtungen vor, jedoch keine Originalinhalte zur sicheren Rekonstruktion einzelner Einträge innerhalb von Arrays. Es fand kein erneuter Produktivzugriff und kein Codeabgleich statt.

### Trägerunabhängige Gruppierung

Ein Zielobjekt wird unabhängig davon erfasst, ob es in Kacheln, Tabs, verschachtelten Listen, Widgets oder einem anderen zuvor als Navigation/gemischt eingeordneten Bereich vorkommt. Erkennungsmerkmale sind `routeName`, `navigationTo`, `screen`, ein `params`-Objekt oder eine direkte nicht leere `query`-Angabe. Untergeordnete `params` werden nicht zusätzlich als eigenständiger Übergang gezählt; eingebettete Aktionen mit eigenem Ziel dagegen schon.

Ergebnis: 3.606 beobachtete Ziel-/Parameterobjekte, zusammengefasst in 84 Cluster nach Familie, Zielroute und Query-Bezeichner. Darin liegen 271 unterschiedliche vollständige Parameterformen. Diese Zahlen beschreiben gespeicherte Verwendungen, keine Anzahl nachgewiesener App-Funktionen.

| Familie | DB-Wert | Vorkommen | Cluster | Vollständige Parameterformen |
| --- | --- | ---: | ---: | ---: |
| Web- und Dokumentaufrufe | `web_or_document` | 1.934 | 2 | 30 |
| Statische HTML-Inhalte | `static_html` | 680 | 3 | 39 |
| JSON-definierte Seiten | `json_defined_page` | 415 | 6 | 35 |
| Datenabfragen | `data_query` | 249 | 31 | 80 |
| Sonstige App-Seiten | `native_page` | 237 | 34 | 56 |
| Formulare | `form` | 83 | 7 | 28 |
| Parameter ohne explizit zugeordnetes Ziel | `unbound_parameters` | 8 | 1 | 3 |

Die Zuordnung verwendet beobachtete Diskriminatoren: beispielsweise `Web`/`Pdf`, `Html`/`publicHtmlFile`, `NestedInfo`/`TilesScreen`/`Service`, benannte Queries und Form-Routen. Sie priorisiert explizite Web-, HTML-, JSON-Seiten- und Formularmerkmale vor der allgemeinen Datenabfrage. Die acht ungebundenen Fälle werden sichtbar gehalten und nicht als fehlerhafte Navigation bewertet. Auch bei einer benannten Route ist deren tatsächliche Unterstützung noch nicht im App-Code bestätigt.

### Query-Parameter getrennt von Darstellung

Für jede benannte Query wurde außerdem die Form ihres unmittelbar zugehörigen `queryVariables`-Objekts isoliert. `params.query` hat Vorrang vor einer direkten `query`; die Fundstelle steht in `selector_location`. Bei der Query unter `params` wird entsprechend `params.queryVariables` ausgewertet, sonst das direkte `queryVariables`.

Dadurch entstehen **22 beobachtete Query-Bezeichner mit 64 Query-Parameterformen**. Beschriftungen, Icons, konkrete IDs und URLs erzeugen hier keine künstlichen Varianten. Ein fehlendes `queryVariables` wird als leere Form `[]` festgehalten; das beweist weder Parameterlosigkeit der API noch eine gültige Abfrage.

| Query | Vorkommen | Query-Parameterformen | Beobachtete Argumente auf oberster Ebene, als Vereinigungsmenge |
| --- | ---: | ---: | --- |
| `publicHtmlFile` | 680 | 2 | `name` |
| `pointsOfInterest` | 67 | 14 | `category`, `categoryId`, `categoryIds`, `initialFilter`, `isPartOfIndexScreen`, `limit`, `location`, `order` |
| `newsItems` | 42 | 8 | `categoryId`, `categoryIds`, `dataProviderId`, `limit` |
| `genericItems` | 37 | 10 | `categoryId`, `categoryIds`, `currentMember`, `genericType`, `order` |
| `eventRecords` | 28 | 4 | `limit`, `location`, `order` |
| `categories` | 25 | 6 | `excludeIds`, `ids`, `order` |
| `pointOfInterest` | 13 | 2 | `id` |
| `pointsOfInterestAndTours` | 5 | 2 | `limit`, `onlyWithImage`, `orderPoi`, `orderTour` |
| `tours` | 3 | 3 | `categoryId`, `categoryIds`, `initialFilter`, `limit`, `order` |

Die übrigen 13 Bezeichner sind ebenfalls vollständig in der View erfasst. Die Argumentliste ist keine Pflichtfeldliste und erlaubt nicht die beliebige Kombination ihrer Felder. Die gespeicherten Formen erhalten die tatsächlich beobachteten Kombinationen und Typen. Unterschiedliche konkrete Werte teilen sich dieselbe Form; String und Integer bleiben unterschiedliche Typen. Array-Indizes werden nur für den Formenvergleich zu `[*]` zusammengefasst.

### Speicherung und Nachvollziehbarkeit

| Tabelle oder View | Zweck |
| --- | --- |
| `navigation_clusters` | Familie, Route, Query-Bezeichner und Status `data_inferred` |
| `navigation_variants` | Vollständige Parameterform sowie isolierte Query-Parameterform als Listen von Pfad-/Typ-Paaren, ohne Inhaltswerte; SHA-256 der vollständigen Form |
| `navigation_occurrences` | Quellen-Dokument und konkreter Objektpfad einschließlich Array-Index, verwendeter Zielschlüssel, Query-Fundstelle und zugeordnete Variante |
| `navigation_cluster_summary` | Vorkommens-, Dokument-, Namen- und Variantenzahlen je Cluster |
| `navigation_parameter_summary` | Pfade und Typen der vollständigen Parameterformen mit Vorkommenszahlen |
| `navigation_query_shape_summary` | Query-Parameterformen je Query, auch über unterschiedliche Träger und Routen hinweg zusammengefasst |

Anders als in der ersten reinen Strukturerfassung werden nun auch die symbolischen Routen- und Query-Bezeichner gespeichert, da sie die Gruppierung bestimmen. Konkrete Ziel-URLs, JSON-Zielnamen aus Parameterwerten, IDs, Texte oder andere Nutzwerte werden weiterhin nicht übernommen.

```sql
-- Alle beobachteten Query-Parameterformen, unabhängig von Kachel/Tab/Liste
SELECT query_name, query_parameter_schema_json, occurrences
FROM navigation_query_shape_summary
ORDER BY query_name, occurrences DESC;

-- Cluster und Anzahl der vollständigen Formen
SELECT family, route_name, query_name, occurrences, shape_variants
FROM navigation_cluster_summary
ORDER BY family, occurrences DESC;

-- Originalfundstellen einer Query, einschließlich Kommune und Version
SELECT d.source_record_id, d.json_name, d.municipality_id, d.app_version,
       o.object_path, o.selector_location, cl.route_name
FROM navigation_occurrences o
JOIN documents d ON d.id = o.document_id
JOIN navigation_variants v ON v.id = o.variant_id
JOIN navigation_clusters cl ON cl.id = v.cluster_id
WHERE cl.query_name = 'pointsOfInterest';
```

Die Cluster bestätigen eine überschaubare Menge wiederkehrender gespeicherter Parameterformen. Sie sind noch kein vollständiger Katalog aller möglichen oder erlaubten App-Parameter. Dieser Nachweis benötigt den späteren Codeabgleich. Insbesondere werden leere, historische und möglicherweise ungenutzte Formen nicht stillschweigend als gültig freigegeben.

## Ergänzung: Codeabgleich der 22 Query-Bezeichner

Dieser Schritt prüft die zuletzt aufgelisteten 22 Werte des Schlüssels `query`. Er ist kein vollständiger Codeabgleich aller 7.435 Strukturpfade. Geprüft wurden App-HEAD `3e4e7711d15db1c78da3c03b1ad930bd2b35417f` und Mainserver-SaaS-HEAD `b01aead122485848cd03ea774c12eb9fc3efdd28` anhand der lokalen Dateien, ohne Laufzeit- oder Produktivprüfung.

Für 21 der 22 Bezeichner ist eine App-Zuordnung zu einer konkreten Implementierung vorhanden. Ein Bezeichner besitzt in den untersuchten Quellen weder einen App-Handler noch eine Mainserver-Implementierung: `myRequests`.

| Einordnung | Bezeichner | Nachweis |
| --- | --- | --- |
| Mainserver-GraphQL, direkte Feldzuordnung | `categories`, `eventRecord`, `eventRecords`, `genericItems`, `getConversations`, `newsItem`, `newsItems`, `pointOfInterest`, `pointsOfInterest`, `publicHtmlFile`, `tours` | App-Konstante und `getQuery`-Zuordnung, importierte GraphQL-Abfrage und korrespondierendes Feld in `app/graphql/types/query_type.rb` |
| Mainserver-GraphQL, zusammengesetzte Abfrage | `pointsOfInterestAndTours` | Die App-Abfrage enthält die beiden Felder `pointsOfInterest` und `tours`; kein gleichnamiges Mainserver-Feld erforderlich |
| Mainserver-GraphQL, spezialisierte App-Abfragen | `vouchers`, `vouchersCategories`, `vouchersRedeemed` | Die ersten beiden App-Selektoren fragen `genericItems` mit `genericType: "Voucher"` ab; `vouchersRedeemed` fragt das Mainserver-Feld `vouchers` ab |
| Externer SUE-Dienst | `requests` | `src/queries/SUE/requests.tsx` verwendet den konfigurierten SUE-Endpunkt über REST |
| Externer Volunteer-Dienst | `calendarAll`, `calendarAllMy`, `groups`, `groupsMy`, `conversations` | Konkrete REST-Implementierungen in `src/queries/volunteer/`; beide Kalenderselektoren verweisen auf `calendarAll` |
| Kein Handler gefunden | `myRequests` | Kein Eintrag in den App-Konstanten oder der Query-Zuordnung und kein direkter Treffer für `myRequests`/`my_requests` in den untersuchten App-/Mainserver-Quellen |

Die ähnlichen Namen `conversations` und `getConversations` sind damit keine bloßen Schreibvarianten: `conversations` lädt Volunteer-Nachrichten über REST, `getConversations` verwendet Mainserver-GraphQL.

### Fundstelle von myRequests

Der Bezeichner steht einmal im untersuchten Dump:

- Tabelle `static_contents`, Quellen-ID **778**, Name **`sueHomeCarousel`**
- Kommune **31**, unversioniert
- Objektpfad **`$[0]["buttons"][2]`**
- Zielroute **`SueList`**, Query in **`params.query`**

Der App-Pfad `src/screens/SUE/SueListScreen.tsx` übernimmt `route.params.query` und ruft `getQuery(query)` auf. In `src/queries/index.js` liefert `getQuery` ausschließlich den Eintrag aus seiner Zuordnung zurück; ein Alias oder Rückfall von `myRequests` auf `requests` ist dort nicht vorhanden. Der Befund lautet daher präzise: **Der gespeicherte Bezeichner ist im untersuchten lokalen Code nicht auflösbar.** Ob der betroffene Button aktuell erreichbar ist oder eine produktiv ausgelieferte andere App-Version ihn unterstützt, ist nicht geprüft. Eine automatische Ersetzung durch `requests` wäre ohne Klärung der beabsichtigten Funktion nicht gerechtfertigt.

### Speicherung des Nachweises

Die Tabelle `query_code_checks` enthält je Query-Bezeichner App-Status, Mainserver-Status, Backend-Zuordnung, Codefundstellen, Hinweise, Commit-IDs und Prüfzeit. Gesucht wurde in der App unter `src/` und `webversion/src/` sowie im SaaS-Mainserver unter `app/`, `lib/` und `config/`. Der zusätzliche Mainserver-Master-Checkout und der weitere lokale App-Checkout lieferten für `myRequests` ebenfalls keinen Treffer.

```sql
SELECT query_name, app_status, mainserver_status, backend_kind, note
FROM query_code_checks
ORDER BY query_name;
```

Die Strukturklassifikationen behalten ihren bisherigen Status `data_inferred`. Der Nachweis eines Query-Handlers bestätigt nicht automatisch alle gespeicherten Parameterkombinationen. Es wurden keine Bestands-JSONs und kein Anwendungscode geändert.

## Ergänzung: Settings und strukturelle Optionen im Code

Der Codeabgleich wurde über die 22 Query-Bezeichner hinaus auf alle 7.435 gespeicherten Pfade mit 1.034 unterschiedlichen benannten Schlüsseln erweitert. Er umfasst Settings, Navigationsoptionen, Zielparameter, Query-Argumente und strukturelle Darstellungsoptionen. Es handelt sich um einen breiten statischen Erstabgleich mit konkreten Nachweisen und offenen Prüffällen, nicht um eine vollständige Datenflussanalyse oder den Beweis, dass sämtliche verbleibenden Schlüssel ungenutzt sind.

### Methode und Umfang

- Untersucht wurden 1.685 Quelldateien aus mobiler App, enthaltener Webversion und SaaS-Mainserver. App-Tests und Typdeklarationsdateien wurden für diesen Verbraucherindex ausgeschlossen. Die Codebasis entspricht den oben genannten lokalen Checkouts; SHA-256-Prüfsummen der tatsächlich gelesenen Dateien dokumentieren auch Abweichungen vom jeweiligen HEAD.
- Für JavaScript und TypeScript wurden mit dem vorhandenen TypeScript-Parser Property-Zugriffe, String-Indizes und Destructuring erfasst. Ein begrenzter Aliasabgleich verfolgt direkte `globalSettings`-Zugriffe und lokale Destructuring-Ketten. Treffer nur in Typen oder als Stringliteral zählen nicht als nachgewiesener Verbraucher.
- Im Ruby-Code wurden statische String-Zugriffe über Index, `dig` und `fetch` erfasst; GraphQL-Argumente sowie App-GraphQL-Variablen wurden als eigene, kontextabhängige Evidenz aufgenommen. Der Ruby-Abgleich ist keine vollständige Parser-/Datenflussanalyse.
- Gleichnamige Zugriffe an anderer Stelle bestätigen nicht automatisch den konkreten JSON-Pfad. Solche Fälle bleiben offen. Funktionsparameter, komponentenübergreifende Weitergaben, generische Maps und Plattform-Styles benötigen ebenfalls Kontextprüfung.
- Wurzel-/Array-Knoten, frei benannte Dictionary-Einträge und reine Anzeigetextfelder in Inhaltsbereichen werden getrennt behandelt. Strukturelle Felder eines Inhaltsbausteins, etwa Bild-, Aktions- oder Darstellungsoptionen, bleiben dagegen im Optionsabgleich.

### Ergebnis des Erstabgleichs

| Status in `field_code_checks` | Pfade | Bedeutung |
| --- | ---: | --- |
| `global_settings_path_read` | 188 | Syntaktisch aufgelöster Lesezugriff stimmt mit dem vollständigen gespeicherten globalSettings-Pfad überein |
| `same_key_read_context_open` | 5.401 | Benannter Lesezugriff vorhanden, Ursprung oder vollständiger JSON-Pfad noch nicht belegt |
| `settings_branch_no_named_read` | 60 | Einer der unten genannten 18 Settings-Bereiche oder dessen Unterstruktur; kein benannter Zugriff auf den Bereich gefunden |
| `same_key_other_context_review` | 116 | Gleichnamige Treffer in anderem Kontext manuell geprüft; Nutzung dieses Settings-Bereichs damit nicht belegt |
| `no_named_read_found` | 343 | Kein benannter Zugriff bzw. passender Namensnachweis im Index; dynamische Nutzung und andere Branches nicht ausgeschlossen |
| `literal_or_type_only` | 61 | Nur String-/Typ-Treffer, kein etablierter Lesezugriff |
| `query_schema_context_open` | 5 | Gleichnamige GraphQL-Variable oder Schema-Argument; konkrete Operation noch zuzuordnen |
| `style_forwarding_review` | 120 | Mögliche generische Weitergabe an Komponenten oder Plattform; kein Negativurteil |
| `dynamic_dictionary_key` | 274 | Individuell benannte Dictionary-Einträge statt fest vorgegebener Optionen |
| `individual_content` | 31 | Reine Anzeigetextfelder in Inhaltsbereichen, aus dem Optionsurteil ausgenommen |
| `container` | 836 | Strukturelle Wurzel-/Array-Knoten ohne eigenen Schlüsselnamen |

Die 343 Pfade ohne benannten Nachweis enthalten 172 unterschiedliche Schlüsselnamen. Das ist eine Prüfliste, keine Liste sicher entbehrlicher Optionen. Auch die 5.401 gleichnamigen Lesezugriffe sind ausdrücklich noch keine vollständigen Nutzungsbestätigungen. Insgesamt werden 6.294 Pfade als Optionen behandelt; die übrigen fallen in die drei gesonderten Gruppen Dictionary-Eintrag, individueller Text und Container.

### Settings-Bereiche ohne gefundenen benannten Zugriff

Unter `globalSettings.settings` betrifft dies im untersuchten lokalen Stand:

| Bereich | Bereich | Bereich |
| --- | --- | --- |
| `--profile` | `appUi` | `bookmarkIcon` |
| `chatbotType` | `contrast` | `detail` |
| `iconFamilies` | `isIncognitoWebScreens` | `klima-taler` |
| `newsAndEventsWithImages` | `openingTimes` | `personalizedWidgets` |
| `showFilterByOpeningTimes` | `showPOIsFullScreenMap` | `showResourceFilters` |
| `wallet` | `webView` | `whatWhere` |

Für diese Namen wurde kein benannter Property-/Index-/Destructuring-Lesezugriff im erfassten Code gefunden. Insbesondere können neuere Funktionen wie die Wallet außerhalb des lokalen App-Stands implementiert sein. Es wurde weder ein globales Urteil über alle Branches noch eine Löschfreigabe abgeleitet.

### Gleicher Schlüssel, anderer Pfad

Die folgenden Gegenbeispiele wurden gezielt gelesen und als Kontextprüffälle gespeichert:

| Gespeicherter Settings-Bereich | Gefundener anderer Kontext |
| --- | --- |
| `settings.serviceTiles` | `Service.tsx` liest `appDesignSystem.serviceTiles` aus dem ConfigurationsContext |
| `settings.news` | `Overviews.js` liest `globalSettings.filter.news` |
| `settings.feedback` | Navigationsdefinitionen verwenden `texts.screenTitles.feedback` |
| `settings.profile` | Treffer betreffen unter anderem `texts.profile` und API-/Mitgliedsdaten |
| `settings.accessibility` | `AccessibilityProvider.tsx` verwaltet lokalen Zustand der Betriebssystem-Accessibility |

Diese Beispiele belegen, warum die Gleichheit eines Schlüsselnamens keine ausreichende Bestätigung seiner Verwendung ist. Ein weiterer möglicher Verbraucher des konkreten Settings-Pfads bleibt jeweils zu prüfen.

### Weitere Optionskandidaten

Außerhalb der Settings wurden beispielsweise `webUrlBackup`, `headerImage-Backup`, `newEntryForm`, `skipResourceFilters`, `isIncognito`, `headerLargeTitle`, `usedAsInitialScreen`, `isModalTab`, `isHighlightedTab`, `privacyContentName` und `termsContentName` ohne benannten Zugriff erfasst. Einige Namen sehen nach Ablage-/Backup-Varianten aus, andere nach neueren Funktionen. Die konkrete Wirkung und mögliche indirekte Verarbeitung werden nicht aus dem Namen abgeleitet.

Style-Keys wie `fontSize` oder `paddingVertical` dürfen aus einem fehlenden eigenen Zugriff nicht als ungenutzt eingestuft werden: Ein ganzes Style-Objekt kann an React Native oder eine Komponente weitergegeben werden. Dafür gibt es den gesonderten Prüfstatus.

### Speicherung und Abfragen

| Tabelle oder View | Zweck |
| --- | --- |
| `code_scan_sources` | Backend, Quelldatei und SHA-256 des untersuchten lokalen Dateistands |
| `code_key_evidence` | Schlüsselname, Backend, Datei, Zeile, Evidenzart und gegebenenfalls syntaktisch aufgelöster globalSettings-Pfad |
| `code_dynamic_evidence` | Erkannte dynamische Indizes oder Spread-Weitergaben mit Settings-Bezug |
| `field_code_checks` | Ein Prüfstatus je Strukturpfad, begrenzte Evidenzverweise, offener Settings-Vorfahre und Begründung |
| `field_code_summary` | Lesbare Verbindung von Pfad, Zweckgruppe und Codeprüfstatus |

```sql
-- Optionspfade ohne gefundenen benannten Zugriff
SELECT source_table, json_name, path, read_status, note
FROM field_code_summary
WHERE read_status IN ('no_named_read_found', 'settings_branch_no_named_read')
ORDER BY json_name, path;

-- Vollständige Fundstellen eines Schlüsselnamens prüfen
SELECT backend, file_path, line, evidence_kind, global_settings_path_json
FROM code_key_evidence
WHERE property_key = 'serviceTiles'
ORDER BY backend, file_path, line;

-- Pfadgenaue syntaktische Nachweise für globalSettings
SELECT path, evidence_ids_json
FROM field_code_summary
WHERE json_name = 'globalSettings' AND read_status = 'global_settings_path_read'
ORDER BY path;
```

Die Evidenz bleibt getrennt von der fachlichen Zweckzuordnung. Alle bisherigen Quellen, Dokumente, Cluster und Typbeobachtungen bleiben erhalten; Produktivdaten und Anwendungscode wurden nicht verändert. Die Nutzerinformation zur relativ neuen Funktion `myRequests` ist außerdem im bestehenden Query-Nachweis ergänzt: Der Bezeichner bleibt für diesen lokalen Stand ungeklärt und wird nicht als global ungenutzt behandelt.

## Ergänzung: Im Code vorhandene, im Bestand fehlende JSON-Pfade

Der umgekehrte Abgleich liefert ebenfalls belegte Lücken im Datenbestand. Eine erste gezielte Gegenprüfung von App-Zugriffen und Mainserver-Verbrauchern hat 25 Einträge mit konkreter Codefundstelle bestätigt: 24 Pfade in `globalSettings` einschließlich ihrer Container und den bislang fehlenden JSON-Namen `languages`. Dies ist eine bestätigte erste Teilmenge und keine abschließende Zahl aller vom Code unterstützten, im Dump fehlenden Optionen.

| Quelle | Im erfassten Bestand fehlende Konfiguration |
| --- | --- |
| App | `globalSettings.settings.sliderSettings.refreshInterval` |
| App | `globalSettings.settings.ar` mit `tourId` und `physicalWidthforTargetImage` (Schreibweise wie im Code) |
| App | `globalSettings.settings.weather` mit `showAlerts` |
| App | `globalSettings.settings.listsWithoutArrows` |
| App | `globalSettings.sections.eventListIntro.formIntroText` |
| App | `globalSettings.settings.settingsScreenListItemTitles` mit den bislang fehlenden Einträgen `pushNotifications`, `matomo`, `onboarding`, `termsAndConditions` |
| App | `globalSettings.hdvt` mit `events` |
| App | `globalSettings.whistleblow.globaleaks` mit `endpoint`, `editInfo` und `form`; letzteres mit `contextId`, `answers`, `receivers`, `identityProvided`, `score` |
| Mainserver | JSON-Dokument `languages`, gelesen durch `app/services/language_service.rb`; ohne Inhalt greift der Rückfall auf `de` |

Die neue Tabelle `code_only_json_paths` hält Name, Pfad, Backend, Datei, Zeile und Prüfstatus fest. Diese Pfade werden bewusst nicht als Bestandsbeobachtungen in `fields` eingetragen: Ein Codezugriff beweist keine Verwendung durch eine der erfassten Kommunen. Das SQLite-Format hat damit Version 6.

```sql
SELECT json_name, path, backend, file_path, line, note
FROM code_only_json_paths
ORDER BY json_name, path;
```

Die Fundstellen wurden nach der automatischen Suche gezielt gelesen. JavaScript-Methoden und Eigenschaften wie `map`, `find`, `forEach`, `toString` und `length` werden nicht als zusätzliche JSON-Schlüssel gewertet. Ebenso sind `globalSettings.waste.streetId`, `streetName` und `selectedTypeKeys` lokaler Nutzerzustand und hier keine neu nachgewiesenen serverseitigen Konfigurationsoptionen. Die Prüfung der 25 Einträge ist auf die lokale Codebasis und die erfassten Daten begrenzt; weitere Branches und zusätzliche nicht erfasste Datenbanken bleiben offen.

## Ergänzung: Module als unabhängige Zuordnungsdimension

Der Katalog enthält jetzt eine fachliche Modulzuordnung unabhängig von der bisherigen Aufgabe (`purpose_group`, beispielsweise Settings oder Navigation). Die bestehenden Aufgaben- und Codeprüfstatus werden dabei nicht überschrieben. Es wird keine Aufteilung der produktiven JSONs und keine Studio-Integration vorgenommen. Datenbankformat: Version 7.

Alle 7.435 Bestandsfelder und 25 zusätzlichen Code-Pfade besitzen genau eine primäre Modulzuordnung. Davon bleiben 12 Bestandsfelder unter `unknown` ungeklärt. Für die 84 Navigationscluster gibt es zusätzlich 85 Zielmodul-Verknüpfungen: Der kombinierte Aufruf `pointsOfInterestAndTours` verweist auf Orte und Touren. Die Unterscheidung zwischen Strukturzuständigkeit und Zielmodul bleibt damit ausdrücklich erhalten.

### Modulgruppen und Zuschnitt

| Gruppe | Zugeordnete Module |
| --- | --- |
| App-Grundfunktionen | App-Grundfunktionen, Design und Darstellung, Barrierefreiheit, Onboarding |
| Zusammensetzung | Navigation und Seitenaufbau |
| Inhaltsmodule | Nachrichten, Veranstaltungen, Orte, Touren |
| Fachmodule | Abfall, Mängelmelder/SUE, Gutscheine, Wallet, ÖPNV/Mobilität, Wetter, Beteiligung, Ehrenamt, Hinweisgebersystem, Augmented Reality, Schwarzes Brett, Warnmeldungen, Chatbot |
| Querschnitt | Profil/Anmeldung, Nachrichten/Postfach, Push, Suche, Analytics, Karten/Standort, Merkliste, Web-/Dokumentaufrufe, gemeinsame Inhaltsdarstellung |
| Betrieb und offene Fälle | Mainserver-Betrieb, Ungeklärt |

Die Module sind ein analytischer Zuschnitt dieses Katalogs und kein Nachweis einer identischen Package- oder Produktmodulstruktur. Ein Modul kann derzeit nur als Navigationsziel auftreten oder nur zusätzliche Code-Pfade besitzen; ein leerer Bestandsumfang bedeutet nicht, dass es keine entsprechende App-Funktion gibt.

### Zuordnungsregeln

- Benannte Settings-Bereiche werden dem fachlichen Modul zugewiesen: beispielsweise `settings.wasteAddresses` zu Abfall, `settings.eventCalendar` zu Veranstaltungen und `settings.matomo` zu Analytics.
- Gemischte JSONs wie `globalSettings` werden pfadweise aufgeteilt. Übergreifende Container erhalten einen gemeinsamen Zuständigkeitsbereich; die Unterfelder können andere Module besitzen. Die primäre Modulzuordnung eines Containers behauptet keine ausschließliche Zuständigkeit für alle Nachfahren.
- Gemeinsame Navigationsstrukturen wie `routeName`, `params`, `queryVariables` und `children` verbleiben grundsätzlich bei ihrem Navigationsbaustein. Fachliche Ziele werden separat über die Cluster verknüpft. In einem bereits modulspezifischen JSON kann die Struktur dem Modul zugeordnet sein, etwa bei `profileService` dem Profil.
- Modulbezogene Designbereiche wie `appDesignSystem.sueListItem` bleiben bei SUE, gemeinsam verwendete Styles beim Designbereich. Style-Keys werden nicht zu eigenen Modulen vervielfacht.
- Frei vergebene Namen wie kommunale Service- oder Themenlisten begründen allein keine fachliche Modulzuständigkeit. Ihre Navigationsstruktur bleibt gemeinsam; erst das belegbare Ziel kann ein Fachmodul zuweisen.
- Allgemeine Queries wie `categories` und `genericItems` bleiben unter gemeinsamer Inhaltsdarstellung. Ohne Auswertung konkreter Parameterwerte ist daraus kein einzelnes Fachmodul ableitbar.
- `myRequests` verweist anhand der Route `SueList` vorläufig auf SUE. Das hebt den offenen Implementierungsnachweis für den lokalen App-Stand nicht auf.

### Status und Nachvollziehbarkeit

Die Zuordnung unterstützt `evidenced` (belegt), `provisional` (vorläufig) und `unresolved` (ungeklärt). Alle neu vorgenommenen fachlichen Zuordnungen stehen zunächst auf **vorläufig**, die offenen Fälle auf **ungeklärt**. Ein nachgewiesener Code-Lesezugriff belegt noch nicht automatisch eine fachlich bestätigte Modulgrenze. Daher wurde keine Zuordnung künstlich als belegt markiert.

| Tabelle oder View | Zweck |
| --- | --- |
| `modules` | Stabile Modul-ID und deutsche Bezeichnung |
| `module_assignments` | Primärmodul, Status und Begründung je Bestandsfeld oder zusätzlichem Code-Pfad; Fremdschlüssel sichern die Fundstelle |
| `navigation_target_modules` | Separates Zielmodul je Navigationscluster; mehrere Ziele sind möglich |
| `module_path_catalog` | Gemeinsame Übersicht mit Modul, bisheriger Aufgabe, Rolle, Pfad, Herkunft und Begründung |
| `module_field_summary` | Pfadzahlen je Modul und Zuordnungsstatus, getrennt nach Bestand und zusätzlichen Code-Pfaden |

```sql
-- Überblick über die Modulzuordnung
SELECT label, status, observed_paths, code_only_paths
FROM module_field_summary
WHERE observed_paths + code_only_paths > 0
ORDER BY observed_paths DESC, label;

-- Settings, Navigation und andere Aufgaben eines Moduls zusammen ansehen
SELECT json_name, path, task_group, field_role, origin, status, basis
FROM module_path_catalog
WHERE module_id = 'waste'
ORDER BY json_name, path;

-- Fachmodule, auf die die allgemeinen Navigationscluster verweisen
SELECT cl.route_name, cl.query_name, m.label, tm.status, tm.basis
FROM navigation_target_modules tm
JOIN navigation_clusters cl ON cl.id = tm.cluster_id
JOIN modules m ON m.id = tm.module_id
ORDER BY m.label, cl.route_name, cl.query_name;
```

Vollständigkeit der Zuordnung, unveränderte Bestandszahlen, vollständige Zielzuordnung aller Cluster, SQLite-Integrität und Fremdschlüssel wurden geprüft. Diese zusätzliche Einordnung ist keine Bereinigung oder Neubewertung der 18 vorerst zurückgestellten Settings-Bereiche.

## Ergänzung: GitHub-Issues für App-Plugins und Mainserver-Abgleich

Am 15. November 2026 wurden im Repository `smart-village-solutions/sva-studio` über das verbundene Konto `pwilimzig` **25 Issues angelegt und sieben bestehende Issues ergänzt**. Die Inhalte wurden nach jedem Schreibvorgang unabhängig erneut aus GitHub gelesen und vollständig mit dem beabsichtigten Text verglichen. Titel, Status, bestehende Fachanforderungen, Labels und Zuweisungen bestehender Issues wurden nicht ersetzt; ergänzt wurde jeweils ein abgegrenzter App-Konfigurationsabschnitt.

Der gemeinsame Einstieg mit verlinkter Gesamtübersicht ist [#2180 – JSON-Abgleich mit dem Mainserver](https://github.com/smart-village-solutions/sva-studio/issues/2180). Er beschreibt unter anderem Datensatz-/Versionsidentität, Fallstricke des vorhandenen unversionierten Writers, Erhalt fremder Felder, atomare Konfliktprüfung, unklaren Schreibausgang und unabhängigen Readback. Der bestehende Waste-Pfad soll gezielt erweitert beziehungsweise erhalten werden; es ist kein zusätzlicher allgemeiner Sync-Dienst vorgesehen.

### Übergreifende App-Plugins

| Menüpunkt | Issue |
| --- | --- |
| Allgemein, einschließlich Karte/Standort, Barrierefreiheit und Onboarding | [#2181](https://github.com/smart-village-solutions/sva-studio/issues/2181) |
| Design | [#2182](https://github.com/smart-village-solutions/sva-studio/issues/2182) |
| Navigation | [#2183](https://github.com/smart-village-solutions/sva-studio/issues/2183) |
| Suchen & Filtern | [#2184](https://github.com/smart-village-solutions/sva-studio/issues/2184) |
| Profile | [#2185](https://github.com/smart-village-solutions/sva-studio/issues/2185) |
| Analytics | [#2186](https://github.com/smart-village-solutions/sva-studio/issues/2186) |

### App-Module und vorhandene Plugin-Issues

| Modul | Issue | Vorgehen |
| --- | --- | --- |
| Startseite | [#2187](https://github.com/smart-village-solutions/sva-studio/issues/2187) | neu |
| Nachrichten | [#2188](https://github.com/smart-village-solutions/sva-studio/issues/2188) | vorhandenes Plugin `news` erweitern |
| Events | [#2189](https://github.com/smart-village-solutions/sva-studio/issues/2189) | vorhandenes Plugin `events` erweitern |
| Orte | [#2190](https://github.com/smart-village-solutions/sva-studio/issues/2190) | vorhandenes Plugin `poi` erweitern |
| Gutschein | [#2191](https://github.com/smart-village-solutions/sva-studio/issues/2191) | vorhandenes Plugin `vouchers` erweitern |
| Stellenanzeigen | [#1433](https://github.com/smart-village-solutions/sva-studio/issues/1433) | bestehendes Issue ergänzt; Plugin bereits vorhanden |
| Baustellen | [#1435](https://github.com/smart-village-solutions/sva-studio/issues/1435) | bestehendes Issue ergänzt; Plugin bereits vorhanden |
| Touren | [#1428](https://github.com/smart-village-solutions/sva-studio/issues/1428) | bestehendes Issue ergänzt |
| Abfall | [#2192](https://github.com/smart-village-solutions/sva-studio/issues/2192) | vorhandenes Plugin `waste-management` erweitern |
| Mängelmelder/SUE | [#2193](https://github.com/smart-village-solutions/sva-studio/issues/2193) | Bestands-App-Konfiguration; getrennt von DefectReport-Ablösung |
| Wallet | [#2194](https://github.com/smart-village-solutions/sva-studio/issues/2194) | neu |
| ÖPNV/Mobilität | [#2195](https://github.com/smart-village-solutions/sva-studio/issues/2195) | neu |
| Wetter | [#2196](https://github.com/smart-village-solutions/sva-studio/issues/2196) | neu |
| Ehrenamt | [#2197](https://github.com/smart-village-solutions/sva-studio/issues/2197) | neu |
| Hinweisgebersystem | [#2198](https://github.com/smart-village-solutions/sva-studio/issues/2198) | neu |
| Augmented Reality | [#1429](https://github.com/smart-village-solutions/sva-studio/issues/1429) | bestehendes Issue ergänzt |
| Schwarzes Brett | [#1437](https://github.com/smart-village-solutions/sva-studio/issues/1437) | bestehendes Issue ergänzt |
| Warnmeldungen/MoWaS | [#2199](https://github.com/smart-village-solutions/sva-studio/issues/2199) | Bestandskonfiguration; verknüpft, aber nicht vermischt mit #2084 |
| Chatbot | [#2200](https://github.com/smart-village-solutions/sva-studio/issues/2200) | neu |
| Ratsinformation/OParl | [#2201](https://github.com/smart-village-solutions/sva-studio/issues/2201) | neu |
| Klima-Taler | [#2202](https://github.com/smart-village-solutions/sva-studio/issues/2202) | neu |
| Beteiligungsprojekte | [#2203](https://github.com/smart-village-solutions/sva-studio/issues/2203) | App-Konfiguration, ausdrücklich nicht Studio-Inhaltstyp Projects |
| Bürgerbeteiligung/Consul | [#2204](https://github.com/smart-village-solutions/sva-studio/issues/2204) | neu, bislang keine exklusiven Settings im Katalog |
| Umfragen | [#618](https://github.com/smart-village-solutions/sva-studio/issues/618) | bestehendes Issue ergänzt; vorhandenes Plugin `surveys` |
| Begegnungen/Encounter | [#1441](https://github.com/smart-village-solutions/sva-studio/issues/1441) | bestehende Discovery ergänzt, keine Implementierungsfreigabe |

Die analytische Sammelgruppe Beteiligung wurde für die Issue-Planung in OParl, Klima-Taler, Beteiligungsprojekte, Consul und Umfragen getrennt. Die Modulzuordnung der Erfassung wird dadurch nicht rückwirkend als verbindliche Plugin-ID interpretiert. Neue technische IDs und konkrete Beiträge sind im jeweiligen vorhandenen Pluginvertrag vor Umsetzung festzulegen.

### Genauigkeit der Feldmatrizen

Die Issue-Texte enthalten die konkreten beobachteten Blattpfade mit Datentypen sowie die zusätzlichen Code-Pfade. `BESTAND` bezeichnet Datenvorkommen, nicht automatisch bestätigte App-Unterstützung; `PRÜFEN` hält offenen Code-/Kontextbedarf fest und `CODE` kennzeichnet einen Code-Nachweis ohne Bestandsdaten. Für frei benannte Navigationsdokumente sind die wiederkehrenden Pfadformen zusammengefasst; ihre Vereinigungsmenge darf nicht als beliebig kombinierbares Schema übernommen werden. Konkrete Inhaltswerte werden nicht veröffentlicht.

Bei Stellenanzeigen, Baustellen, Touren, Umfragen und Consul ist ausdrücklich festgehalten, dass bislang keine exklusiven JSON-Settings belegt sind. Ein belegtes Ergebnis „keine Settings erforderlich“ ist zulässig; es wird kein leerer Editor oder neuer Schalter verlangt. Bestehende fachliche Inhaltsfunktionen bleiben eigenständiger Umfang. FAQ, Cockpit Cards und Projects erhalten keine App-Konfigurationsissues.

Serverseitige Import-/Mail-Konfigurationen sind dem gemeinsamen Abgleich als Inventar zugeordnet, erhalten aber keinen zusätzlichen App-Menüpunkt oder pauschale Bearbeitungsfreigabe. Die 18 zurückgestellten Bereiche und die bekannten Parser-/Duplikatbefunde bleiben wie vereinbart offen beziehungsweise vorerst ignoriert.

### Nachverfolgung im lokalen Katalog

Das SQLite-Format hat Version 8. `planning_issues` hält Issue-Nummer, URL, Planungskennung und verifizierten Erstellungs-/Ergänzungsstatus fest. `planning_issue_assignments` ordnet alle 7.435 Bestandsfelder und 25 zusätzlichen Code-Pfade einem zuständigen Issue zu; diese Planungsdimension bleibt getrennt von fachlichem Modul und Codeprüfstatus. `planning_issue_summary` liefert die aggregierte Übersicht. Lokale Arbeitskopien und der Publikationsnachweis liegen unter dem Git-ignorierten `artifacts/static-json-catalog/`.

```sql
SELECT label, issue_number, operation, observed_paths, code_only_paths, url
FROM planning_issue_summary
ORDER BY issue_number;
```

Die Anlegung der Issues hat keinen Anwendungscode, Produktivdaten oder Plugin-Aktivierungen geändert. Noch nicht implementierte Funktionen sind durch die Issues nicht als umgesetzt ausgewiesen.

## Nachweis und Grenzen

Der SQL-Literal-Parser wurde gezielt auf Kommas, maskierte Apostrophe, Backslashes, Zeilenumbrüche und `NULL` geprüft. Die Strukturerfassung wurde auf gemischte Array-Elemente, leere Arrays, Boolean-/Integer-Unterscheidung und doppelte Schlüssel geprüft. SQLite-Integrität, Fremdschlüssel, Quellenanzahl und das Fehlen von Strukturbeobachtungen für nicht parsebare Dokumente wurden geprüft; die gespeicherte Datei wurde anschließend unabhängig lesend geöffnet.

Für die Zweckzuordnung wurden konkrete Gegenbeispiele geprüft: `globalSettings.settings.personalizedTiles` und die skalare Moduswahl `globalSettings.navigation` bleiben Settings, Ziel-Query-Parameter in `tabConfigs` gehören zur Navigation und `mapSettings.queryVariables` bleibt Teil der Karten-Settings. Zusätzlich wurden die Vollständigkeit der Zuordnung sowie unveränderte Quellen-, Dokument-, Beobachtungs- und Befundzahlen geprüft.

Die Strukturerfassung des Katalogs basiert auf vorhandenen Daten der beiden JSON-Quellen. Nicht verwendete, aber vom Code unterstützte Strukturpfade sind damit noch nicht als eigener vollständiger Katalog erfasst. Trotz Query-Abgleich und breiter statischer Schlüsselprüfung bleiben vollständige Datenflüsse, Pflichtfelder, Standardwerte, fachliche Bedeutung, dynamische Schlüsselräume und die Gültigkeit für andere App-Versionen teilweise offen. Weder bloße Namensgleichheit noch ein fehlender direkter Treffer rechtfertigen eine automatische Bereinigung.

Die bisherige Codeübersicht steht unter [Static JSONs im SVA Mainserver und in der App](../reference/static-jsons-mainserver-app.md). Sie wurde für diesen Datenkatalog nicht als Beleg für die Unterstützung einzelner Felder verwendet.
