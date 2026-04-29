## Kontext

Im aktuellen Repo existieren drei sich überlappende Verträge für pluginbezogene UI:

- `PluginDefinition.routes` für freie Plugin-Seiten unter `/plugins/...`
- `AdminResourceDefinition` für host-owned CRUD-artige Admin-Routen unter `/admin/...`
- `ContentTypeDefinition` für fachliche Content-Metadaten wie Anzeige, Actions und Payload-Validierung

Für die bestehenden Content-Plugins `news`, `events` und `poi` wird das produktive CRUD-UI derzeit noch über freie Plugin-Routen materialisiert, obwohl der Host bereits einen generischen Admin-Ressourcenpfad besitzt. Dadurch bleibt unklar, welche Content-Plugins dem Standardpfad folgen sollen und wann freie Plugin-Routen architektonisch zulässig sind.

## Zielbild

Der Change führt keinen vierten Parallelvertrag ein. Stattdessen schärft er die vorhandenen Verträge zu einem dreistufigen Modell:

1. **Standardpfad**
   - CRUD-artige Content-Plugins verwenden kanonisch den host-owned `adminResources`-Pfad.
   - Der Host besitzt Routebaum, Shell, Guard-Auswertung, globale Actions, Save-Ownership und Fallback-States.
2. **Spezialisierungspfad**
   - Innerhalb dieses Standardpfads dürfen Plugins spezialisierte List-, Detail- und Editor-Views registrieren.
   - Diese Spezialisierung ersetzt nur die fachliche Arbeitsfläche, nicht die Host-Verantwortung.
3. **Ausnahme-Pfad**
   - Freie `plugin.routes` bleiben erlaubt, aber nur für dokumentierte Nicht-CRUD-Sonderfälle wie Wizard, Dashboard oder domänenspezifische Zusatzarbeitsflächen.

## Architekturentscheidung

Die geeignete Einhängestelle für die Spezialisierung ist nicht `ContentTypeDefinition`, sondern der bestehende `AdminResourceDefinition`-Pfad.

Begründung:

- `contentTypes` beschreiben heute fachliche Semantik, nicht Routing- oder Seitenmaterialisierung.
- `adminResources` sind bereits der kanonische Host-Vertrag für CRUD-artige Admin-Flächen.
- `plugin.routes` sind bewusst frei und sollten nicht zum Standardpfad für normales CRUD werden.

Deshalb wird der gemeinsame Vertrag so geschärft:

- `ContentTypeDefinition` bleibt für fachliche Semantik, Actions und Validierung zuständig.
- `AdminResourceDefinition` wird um spezialisierte pluginfähige View-Bindings erweitert.
- `plugin.routes` bleiben als Ausnahmevertrag bestehen.

## Konkrete Folgen für bestehende Plugins

`@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi` werden als Referenzmenge auf diesen Standardpfad migriert.

Das bedeutet:

- produktive List-, Create- und Detailpfade laufen kanonisch über host-owned Admin-Routen
- bestehende spezialisierte React-Seiten werden nicht verworfen, sondern als Spezialisierungs-Bindings weiterverwendet
- Mainserver-backed Datenpfade bleiben unverändert
- freie Plugin-Routen bleiben nur dann bestehen, wenn sie einen echten Nicht-CRUD-Sonderfall abbilden

## Validierungs- und Ablehnungsregeln

- Ein normales CRUD-Plugin darf den Ausnahme-Pfad nicht als produktiven Hauptpfad für Liste, Erstellen und Detail nutzen.
- Ein spezialisierter Binding darf keine Host-Verantwortung für Guard, Shell, globale Actions, Persistenz oder Lifecycle-Semantik übernehmen.
- Fehlende Spezialisierungen führen nicht zum Ausfall, sondern zum host-owned Fallback.
- Echte Nicht-CRUD-Sonderrouten bleiben zulässig, müssen aber explizit dokumentierbar sein.

## Kosten-Nutzen-Bewertung

Der gewählte Zuschnitt ist bewusst breiter als eine Einzelreferenzmigration, weil im aktuellen frühen Entwicklungsstadium bereits drei nahezu gleichartige Content-Plugins existieren. Eine sofortige gemeinsame Migration reduziert spätere Parallelpfade und verhindert, dass sich drei leicht unterschiedliche CRUD-Integrationsmuster verfestigen.

Der Mehraufwand ist vertretbar, weil:

- die drei Plugins bereits dieselbe Grundstruktur besitzen
- der Host bereits `adminResources` und gemeinsame Studio-Templates besitzt
- die Änderung vor allem Vertrags- und Materialisierungsschichten schärft, nicht drei voneinander unabhängige Facharchitekturen einführt
