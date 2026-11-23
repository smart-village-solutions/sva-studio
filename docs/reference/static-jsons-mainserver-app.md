# Static JSONs im SVA Mainserver und in der App

Stand: 15. November 2026. Diese Referenz beschreibt die untersuchten bestehenden Daten- und Verarbeitungspfade als Grundlage für weitere Studio-Arbeiten. Der Abschnitt zum gemeinsamen Abgleich verweist zusätzlich auf die bestätigte Architekturentscheidung; deren Umsetzung steht noch aus.

Die Erfassung und der anschließende statische Codeabgleich sind im Bericht zum lokalen SQLite-Strukturkatalog unter `docs/reports/2026-11-15-static-json-strukturkatalog.md` dokumentiert. Der Katalog erfasst beobachtete Pfade und Typen, dokumentiert einen statischen Erstabgleich für 7.435 Pfade und verzeichnet Pfade, die bisher nur im Code gefunden wurden. Vollständige Datenflussanalysen und Kontextprüfungen stehen noch aus.

## Untersuchungsstand und Quellen

Untersucht wurden der lokale Mainserver-Code, der lokale App-Code und der zuvor erstellte SQL-Dump der JSON-Einträge aus `static_contents`.

| Quelle | Lokaler Stand |
| --- | --- |
| Mainserver | Repository `smart-village-app-mainserver`, insbesondere Worktree `.worktrees/saas`, HEAD `b01aead122485848cd03ea774c12eb9fc3efdd28` |
| Mobile App und enthaltene Webversion | Repository `smart-village-app-app/smart-village-app-app`, HEAD `3e4e7711d15db1c78da3c03b1ad930bd2b35417f` |
| Datenbankprüfung | Planetary-Endpoint `sva`, Stack `saas-database`, Service `saas-database_mysql`, Datenbank `saas-sva-app` |

Die Aussagen zum Code beziehen sich auf die gelesenen lokalen Dateien; die Commit-IDs sind Orientierungspunkte und beweisen keine Übereinstimmung mit produktiv ausgelieferten Versionen. Es erfolgte keine App-Laufzeitprüfung. Die Untersuchung hat weder Code noch Produktivdaten verändert.

Der Export enthält 866 Einträge mit `data_type = 'json'` und rund 1,9 MB Inhalt. Er wurde als konsistenter InnoDB-Snapshot ohne Tabellensperren erstellt und lokal auf Gzip-Integrität, Abschlussmarkierung und INSERT-Anzahl geprüft. Diese Prüfung ist keine fachliche oder vollständige JSON-Schemavalidierung. Dump und Inhalte bleiben außerhalb des Repositorys.

## Fachliche Aufgaben

Static JSONs konfigurieren vorhandene App-Funktionen und liefern strukturierte Inhaltsbausteine. Einige werden zusätzlich unmittelbar vom Mainserver ausgewertet.

| Name oder Namensgruppe | Aufgabe und Verbraucher |
| --- | --- |
| `globalSettings` | Übergreifende Einstellungen für Navigation, Module, Startseitenabschnitte, Widgets, Filter und Design; Bereitstellung über den SettingsContext der App |
| `tabNavigation`, `navigation` | Tab- beziehungsweise Drawer-Navigation mit Bildschirmzuordnung, Parametern, Beschriftungen und Darstellung |
| `homeService`, weitere frei benannte Kachel-JSONs | Service-Kacheln mit Titel, Icon oder Bild, Zielroute und Bildschirmparametern |
| `<Name>Content` | Ergänzende Inhalte ober- und unterhalb einer Kachelseite, etwa `forAbove` und `forBelow` |
| `homeCarousel`, `homeDisturber`, `homeLiveTicker` | Startseiteninhalte wie Bilder, Hinweise, Lauftexte und Aktionen |
| `about`, `homeAbout` | Informations- und Navigationseinträge; der SaaS-Mainserver besitzt einen Rückfall von `about` auf `homeAbout` |
| `appIntroSlides` | Einführungsfolien mit Texten, Bildern und bekannten Aktionen |
| `mapSettings` | Kartenkonfiguration, unter anderem Marker, Cluster, Zoom und Filter; im Dump vorhanden und in der enthaltenen Webversion verarbeitet |
| `wasteTypes` | Eigenschaften und Bezeichnungen der Abfallarten; App-Darstellung sowie Mainserver-Erinnerungen und Kalenderexporte |
| `gtfsConfig` | Konfiguration der ÖPNV-Importe im Mainserver, unter anderem Feeds und Datenanbieter |
| `languages` | Sprachkonfiguration des Mainservers mit Rückfall auf Deutsch |
| `noticeboard-notify-creator`, `defectreport-notify-for-category`, `mailer-config` | Je nach Mailer App-Name, Mail-Fußtexte und weitere Mail-Einstellungen |

Die Liste beschreibt gelesene Verbraucher und beobachtete Strukturen. Sie ist kein vollständiger Katalog aller Namen oder unterstützten Schlüssel. Insbesondere erzeugt ein neuer JSON-Eintrag keinen neuen Bildschirmtyp: Der App-Code muss die angesprochene Funktion bereits unterstützen.

## Speicherung, Mandantenzuordnung und Vorlagen

`static_contents` speichert den Inhalt als Text in `content`. Weitere zentrale Felder sind `id`, `name`, `data_type`, `version`, `municipality_id` sowie die Zeitstempel. JSON und HTML teilen sich diese Tabelle.

Im SaaS-Modell ist der Name ohne Beachtung der Groß-/Kleinschreibung innerhalb von Version und Kommune eindeutig. `StaticContent` verwendet `MunicipalityScope`, der normale Modellabfragen auf die über `MunicipalityService` gesetzte Kommune begrenzt. Derselbe Name kann deshalb in mehreren Kommunen vorkommen. Direkte SQL-Abfragen umgehen diesen Rails-Scope; Zuordnungen dürfen beim Export oder bei späteren Änderungen nicht verloren gehen.

`default_static_contents` enthält systemweite Vorlagen mit Liquid-Platzhaltern. Beim Anlegen einer Kommune rendert `DefaultStaticContent::InstantiateService` daraus kommunenspezifische `StaticContent`-Datensätze. Dies ist eine Instanziierung; eine laufende Synchronisation bestehender Einträge mit später geänderten Vorlagen ist in diesem Pfad nicht vorgesehen. Die Vorlagen waren nicht Teil des JSON-Dumps aus `static_contents`.

Die Mainserver-Verwaltung bietet Bearbeitung über einen JSON-Editor und eine GraphQL-Mutation `createOrUpdateStaticContent`. Der gelesene Modellpfad erzwingt kein vollständiges fachliches JSON-Schema. Die konkreten Berechtigungs- und Schreibverträge wären vor einer Studio-Integration gesondert zu prüfen.

## Auslieferung über GraphQL und Versionsauswahl

Die App verwendet `publicJsonFile(name:, version:)`. Im gemeinsamen Abfragepfad sucht der Mainserver anhand von Datentyp, Name und aktuellem Kommunenkontext nach dem passenden Eintrag.

- Bei angegebener Version sucht die Auswahl die höchste gespeicherte Version, die kleiner oder gleich der angefragten Version ist; ersatzweise einen unversionierten Eintrag.
- Für versionsbezogene JSON-Antworten versucht der Mainserver, `content` in ein JSON-Objekt oder Array umzuwandeln. Bei einem Parserfehler bleibt der ursprüngliche Datensatz erhalten.
- Für ältere Clients ohne Versionsparameter sieht der Antwortpfad eine unveränderte String-Repräsentation des Inhalts vor.
- Fehlt ein passender Eintrag, ist für JSON ein leerer Inhalt mit dem Namen `not found` vorgesehen.

Diese Beschreibung des Auswahlpfads ist keine vollständige Prüfung aller Fehlerfälle, etwa ungültiger Versionsangaben.

## Verarbeitung in der mobilen App

### Laden und lokaler Zustand

`useStaticContent` ist der zentrale Hook. Er sendet den Namen und `appJson.expo.version` an GraphQL und liefert Daten, Ladezustand, Fehlerzustand und `refetch` an den Verbraucher zurück. Für JSON akzeptiert er grundsätzlich nicht leere Objekte oder Arrays; optional kann ein Verbraucher einen eigenen Parser übergeben.

Apollo verwendet einen über AsyncStorage persistierten Cache. Die Fetch-Policy hängt von Verbindung, Mainserver-Erreichbarkeit und dem gespeicherten Aktualisierungszeitpunkt ab:

| Zustand | Verhalten |
| --- | --- |
| Online, Server erreichbar, Aktualisierung fällig | `network-only` |
| Online, Server erreichbar, Aktualisierungszeitpunkt noch nicht erreicht | `cache-first` |
| Offline oder Server nicht erreichbar | `cache-only` |

Der Hook verwendet standardmäßig das Tagesintervall; der Helfer orientiert sich dabei am Tagesende. Dies ist kein automatisches Polling und keine garantierte maximale Aktualisierungsverzögerung. Manche Verbraucher überschreiben die Policy oder lösen `refetch` aus. Mehrere Startseitenbausteine abonnieren dafür das Ereignis `SVA_HOME_REFRESH`.

`globalSettings` wird gesondert beim App-Start geladen. Ausgangspunkt sind lokal gespeicherte Einstellungen beziehungsweise lokale Defaults. Serverdaten werden per Spread auf oberster Ebene darübergelegt und wieder gespeichert; dies ist kein rekursives Zusammenführen aller Unterstrukturen. Anschließend stellt der SettingsContext die Einstellungen bereit. Das Aktualisieren einzelner Startseitenbausteine bedeutet daher nicht automatisch, dass auch alle globalen Einstellungen neu geladen werden.

### Navigation und Darstellung

`MainTabNavigator` übersetzt `tabNavigation` in vorhandene oder dynamisch konfigurierte Tabs. `DrawerNavigator` verarbeitet `navigation`. Beide besitzen lokale Ausgangs- oder Ersatzkonfigurationen.

`ServiceTile` übernimmt `routeName` und `params` unmittelbar in `navigation.push(item.routeName, item.params)`. Diese Werte sind damit funktionale Verträge. Kachelseiten laden über `staticJsonName` weitere frei benannte JSONs nach. Die zusätzliche Quelle `<Name>Content` kann begleitende Inhalte liefern.

Bei aktivierter Personalisierung speichert die App Sichtbarkeit und Reihenfolge von Kacheln pro JSON-Name lokal. Die Zuordnung verwendet normalisierte Titel oder Accessibility-Beschriftungen. Eine serverseitige Änderung kann deshalb mit bereits gespeicherter Personalisierung zusammenwirken.

### Validierung und Fehlerverhalten

Die Prüfung unterscheidet sich je nach Verbraucher. Der zentrale Hook prüft keine vollständigen fachlichen Schemata für alle JSON-Typen. Einzelne Verbraucher bieten eigene Parser: `parseIntroSlides` prüft beispielsweise Einführungsfolien und filtert unbekannte Aktionen aus.

Fehlende oder nicht passende Inhalte können je nach Komponente zu ausgeblendeten Bereichen, Ersatzkonfigurationen oder Fehlerzuständen führen. Syntaktisch gültiges JSON allein beweist daher keine korrekte Darstellung oder Navigation.

## Enthaltene Webversion

Das Unterverzeichnis `webversion` nutzt dieselbe GraphQL-Quelle, verarbeitet die Inhalte jedoch mit eigenen API-Funktionen und Mappern. `parsePublicJsonContent` akzeptiert sowohl bereits strukturierte Daten als auch JSON-Strings und verwendet bei leeren oder nicht parsebaren Strings einen Ersatzwert.

Web-Routen und unterstützte Module werden eigens zugeordnet; die mobile Navigation wird nicht unverändert übernommen. Der GlobalSettingsProvider verwendet TanStack Query mit einer Stunde `staleTime` und 24 Stunden `gcTime`. Diese Werte sind Cache-Einstellungen und kein zugesichertes Pollingintervall.

## Bedeutung für weitere Studio-Arbeiten

- Änderungen müssen Kommune, JSON-Namen und Versionsvariante zusammen betrachten.
- JSON-Schlüssel, Routennamen und Parameter sind gegen die tatsächlich unterstützte App-Version zu prüfen.
- Die Auswahl eines passenden Versionseintrags und lokale Caches beeinflussen, welche Daten ein Client sieht.
- Globale Einstellungen, einzelne Inhaltsbausteine und lokale Personalisierung haben unterschiedliche Lebenszyklen.
- Mobile App und Webversion sind eigenständige Verbraucher mit teilweise unterschiedlicher Interpretation.
- Eine spätere Bearbeitungsfunktion benötigt Validierung pro unterstütztem JSON-Typ und einen geprüften Schreibvertrag. Daraus folgt hier noch kein festgelegter Implementierungsauftrag.

## Abgestimmte Studio-Menüstruktur und Plugin-Zuständigkeit

Festgehalten am 15. November 2026 auf Grundlage der Nutzerentscheidung. Dies beschreibt den vereinbarten Zuschnitt für die spätere Studio-Planung; Menüeinträge und Plugins wurden dadurch nicht implementiert. Die vorangehende Strukturerfassung bleibt davon unabhängig.

Unter **Anwendungen → App** gilt folgende Reihenfolge:

| Reihenfolge | Menüpunkt | Plugin-Zuschnitt |
| --- | --- | --- |
| 1 | Allgemein | Eigenes Studio-Plugin; enthält auch Karte und Standort |
| 2 | Design | Eigenes Studio-Plugin |
| 3 | Navigation | Eigenes Studio-Plugin |
| 4 | Module | Gemeinsame Menügruppe; jedes App-Modul entspricht einem Studio-Plugin |
| 5 | Suchen & Filtern | Eigenes Studio-Plugin |
| 6 | Profile | Eigenes Studio-Plugin |
| 7 | Analytics | Eigenes Studio-Plugin |

Die **Startseite ist ein App-Modul** und wird unter **Module** eingeordnet. Sie erhält keinen eigenen Menüpunkt auf der Ebene von Allgemein oder Navigation. **Karte und Standort** gehören zu **Allgemein**.

Für **Nachrichten, Events, Orte, Gutschein, Stellenanzeigen und Baustellen** bestehen laut Nutzer bereits Studio-Plugins. Die spätere App-Konfiguration wird dem jeweils vorhandenen zuständigen Plugin zugeordnet; dafür werden keine parallelen App-Einstellungsplugins vorgesehen. Technische Plugin-IDs, konkrete Erweiterungspunkte und Implementierungsumfang sind damit noch nicht festgelegt.

Die Studio-Inhaltstypen **FAQ, Cockpit Cards und Projects** gibt es laut Nutzer in der App nicht. Sie werden deshalb keiner App-Modulkonfiguration zugeordnet. Insbesondere ist die bisherige analytische Gruppe Beteiligung beziehungsweise ein App-Bezeichner mit „Project“ im Namen kein Beleg für eine Zuordnung zum Studio-Inhaltstyp Projects.

Für die weitere Einordnung sind drei Dimensionen getrennt zu halten:

- **Fachliche Modulzugehörigkeit:** Welche App-Funktion betrifft ein Schlüssel?
- **Position im App-Menü:** In welchem der sieben Bereiche wird die Einstellung bearbeitet?
- **Zuständiges Studio-Plugin:** Welches bestehende oder später zu implementierende Plugin verantwortet diesen Bereich?

Die 32 analytischen Module und Querschnittsbereiche des lokalen Katalogs werden nicht unverändert als 32 Menüeinträge oder neue Plugins übernommen. Diese Festlegung dokumentiert die spätere Bedienstruktur und Zuständigkeit; sie ist kein Auftrag, bereits jetzt Studio-Anbindung oder weitere technische Schichten anzulegen.

Die zugehörigen Plugin-Issues und der gemeinsame JSON-Abgleich sind inzwischen erfasst: [#2180 mit verlinkter Gesamtübersicht](https://github.com/smart-village-solutions/sva-studio/issues/2180). Der oben genannte Analysebericht dokumentiert die konkrete Zuordnung und die Feldmatrizen. Die Issue-Erfassung ersetzt keine Implementierung oder Produktivfreigabe.

## Bestätigte Zuständigkeit für den gemeinsamen Abgleich

Der Studio-Mainserver-Service führt den gemeinsamen JSON-Abgleich über den vorhandenen authentifizierten GraphQL-Pfad aus. Studio listet JSON-Dateien samt Varianten und lädt die ausdrücklich gewählte ID. Beim Speichern liest der Service die Variante frisch, prüft Feldänderungen und schreibt mit der erwarteten Mainserver-Revision. Ein eigener Abruf bestätigt das Ergebnis. Die Mainserver-Vertragsergänzungen sind unter [SVA-1787](https://tpwd.atlassian.net/browse/SVA-1787), [SVA-1788](https://tpwd.atlassian.net/browse/SVA-1788), [SVA-1789](https://tpwd.atlassian.net/browse/SVA-1789) und [SVA-1792](https://tpwd.atlassian.net/browse/SVA-1792) dokumentiert.

Die Zuständigkeit für den gemeinsamen Ablauf liegt in `@sva/sva-mainserver`. Studio prüft Mandantenkontext und die Rechte des App-Arbeitsbereichs. Beim Speichern werden nur die zulässigen Feldänderungen in das JSON eingespielt. Die Architekturentscheidung steht unter [Gemeinsamer Abgleich der App-Konfiguration](../architecture/08-cross-cutting-concepts.md#gemeinsamer-abgleich-der-app-konfiguration).

Der erste Editor stellt unter **Anwendungen → App → App-Konfiguration** die tatsächlichen Dateien und Varianten zur Auswahl. Für `globalSettings` bearbeitet er die alternative Standortwahl und die Zeilenzahl der Kacheltitel. Die gewählte ID steuert den Schreibvorgang auch bei unversionierten Einträgen. Berechtigte können Varianten vollständig kopieren und gezielt per ID löschen. Der [OpenSpec-Change](../../openspec/changes/add-shared-app-configuration/proposal.md) beschreibt den Gesamtumfang.

Neue Versionen entstehen als vollständige Kopie einer vom Redakteur gewählten vorhandenen Variante. Studio sendet dazu den vollständigen Rohtext der Vorlage. Bereits vorhandene Zielversionen werden abgewiesen. Die Namensnormalisierung beim Anlegen begrenzt die Funktion auf Namen, die der Mainserver unverändert übernimmt. Vorlage und andere vorhandene Varianten werden durch die Neuanlage nicht verändert.

„Speichern“ schreibt nach einer Änderungsvorschau direkt in den Mainserver. Ein dauerhaft gespeicherter Studio-Entwurf und eine separate Veröffentlichung sind nicht vorgesehen; die App besitzt hierfür keinen Entwurfsmodus. Ungespeicherte Formularänderungen bleiben lokal. Die tatsächliche App-Wirkung folgt weiterhin dem vorhandenen Lade- und Cacheverhalten.

App-Konfiguration erhält eigene Rechte je zuständigem Plugin, getrennt von den Rechten der Inhaltsredaktion. Die Zuweisung erfolgt über die bestehende Rollenverwaltung; der Host prüft die namespaced Konfigurationsrechte serverseitig. Inhaltsrechte allein erlauben weder das Lesen noch das Ändern der App-Konfiguration. Feldänderungen sind an die jeweiligen Plugin-Rechte gebunden; das Anlegen und Löschen ganzer Dokumentvarianten erfordert zusätzlich `integration.manage`. So darf ein reines Plugin-Feldrecht nicht die Entfernung einer `globalSettings`-Variante mit Einstellungen anderer Plugins erlauben.

Die getrennten Fachformulare für weitere Feldgruppen und Plugins gehören zum Gesamtentwurf. Der erste Editor nutzt die vorhandenen Rechte des App-Arbeitsbereichs.

## Code-Einstiegspunkte

Die Pfade sind relativ zum jeweils oben genannten Repository beziehungsweise SaaS-Worktree angegeben.

| Bereich | Dateien |
| --- | --- |
| Mainserver: Daten und Mandant | `app/models/static_content.rb`, `app/models/concerns/municipality_scope.rb`, `app/services/municipality_service.rb` |
| Mainserver: GraphQL | `app/graphql/types/query_type.rb`, `app/graphql/types/query_types/public_json_file_type.rb`, `app/graphql/mutations/create_or_update_static_content.rb` |
| Mainserver: Vorlagen | `app/models/default_static_content.rb`, `app/models/municipality.rb`, `app/services/default_static_content/instantiate_service.rb` |
| Mainserver: Verwaltung | `app/controllers/static_contents_controller.rb`, `app/views/static_contents/_form.html.erb`, `app/services/static_content/structure_service.rb` |
| Mainserver: Fachverbraucher | `app/jobs/waste_notification_job.rb`, `app/controllers/notification/wastes_controller.rb`, `app/jobs/gtfs_importer_job.rb`, `app/services/language_service.rb`, `app/mailers/` |
| App: Laden und Cache | `src/hooks/staticContent.ts`, `src/queries/publicJsonFiles.js`, `src/helpers/graphqlHelper.js`, `src/helpers/refreshIntervalHelper.js`, `src/hooks/TimeHooks.ts` |
| App: Globale Einstellungen | `src/index.js`, `src/SettingsProvider.js`, `src/ConfigurationsProvider.tsx` |
| App: Navigation und Kacheln | `src/navigation/MainTabNavigator.tsx`, `src/navigation/DrawerNavigator.tsx`, `src/components/screens/ServiceTile.tsx`, `src/components/screens/ServiceTiles.js`, `src/hooks/personalizedTiles.ts` |
| App: Aktualisierung und Einführung | `src/hooks/HomeRefresh.ts`, `src/components/HomeService.js`, `src/screens/AppIntroScreen.tsx`, `src/jsonValidation/appIntroValidator.ts` |
| Webversion | `webversion/src/lib/api/homeContentApi.ts`, `webversion/src/lib/api/publicContentApi.ts`, `webversion/src/lib/api/mappers/`, `webversion/src/contexts/GlobalSettingsContext.tsx` |

Zur Einordnung: [Referenzindex](./README.md) und [Dokumentationsübersicht](../README.md).
