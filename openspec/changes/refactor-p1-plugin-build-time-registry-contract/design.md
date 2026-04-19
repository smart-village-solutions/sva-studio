## Kontext

Die bestehende Plugin-Integration besitzt bereits die Bausteine eines Build-time-Modells: Workspace-Packages exportieren `PluginDefinition`-Objekte, der App-Host importiert sie statisch über `studioPlugins`, und aus denselben Definitionen werden Registry, Routen, Navigation, Content-Typen und Übersetzungen abgeleitet. Diese Kette ist aber noch nicht als kanonischer Vertrag spezifiziert.

Für die nächsten P1/P2-Änderungen braucht das Studio einen eindeutigen Ausgangspunkt, damit Admin-Ressourcen, weitere Content-Typen und Guardrails nicht an mehreren Stellen separat verdrahtet werden.

## Entscheidungen

### 1. Der Host führt genau eine kanonische Build-time-Pluginliste

Der Studio-Host definiert eine statische Pluginliste, die zur Build-Zeit aus Workspace-Packages importiert wird. Laufzeit-Discovery, dynamisches Nachladen und plugin-eigene Selbstregistrierung außerhalb dieser Liste sind nicht Teil des Vertrags.

### 2. `PluginDefinition` bleibt die einzige öffentliche Beitragsoberfläche

Plugins liefern ausschließlich deklarative Beiträge über `@sva/sdk`: Routen, Navigation, Content-Typen, Aktionen und Übersetzungen. Host-Interessen wie Guard-Anwendung, Route-Materialisierung, i18n-Merge und Registry-Fail-Fast bleiben Host-Verantwortung.

Der Vertrag ist dabei bewusst erweiterbar: spätere P1/P2-Folgeschritte DÜRFEN zusätzliche deklarative Beitragstypen wie Admin-Ressourcen, Suchmetadaten oder Audit-relevante Registrierungsmetadaten an `PluginDefinition` oder eng gekoppelte SDK-Verträge anfügen, solange diese Erweiterungen denselben kanonischen Build-time-Registry-Pfad nutzen.

### 3. Der Host materialisiert alle Projektionen aus derselben Quelle

Aus der kanonischen Pluginliste erzeugt der Host deterministisch:
- Plugin-Registry für Identität und Validierung
- Action-Registry für namespace-sichere Aktionen
- Route-Definitionen für `@sva/routing`
- Navigationseinträge für die Shell
- Content-Type-Definitionen für Content-UI und Validierung
- i18n-Ressourcen und Translator-Initialisierung

Weitere deklarative Projektionen aus Folge-Changes wie Admin-Ressourcen, Suchkonfiguration oder Audit-Metadaten sind nur zulässig, wenn sie als zusätzliche Projektion derselben kanonischen Pluginliste modelliert werden.

Es darf keinen zweiten app-lokalen Parallelpfad geben, der einzelne Plugin-Beiträge separat inventarisiert oder plugin-spezifisch verdrahtet.

### 4. `@sva/routing` konsumiert Plugin-Beiträge nur als Host-Projektion

`@sva/routing` bekommt Plugin-Definitionen ausschließlich über den Host-Einstieg und materialisiert daraus den Route-Baum. Routing kennt keine plugin-spezifischen Sonderpfade außerhalb dieser Materialisierung.

## Nicht-Ziele

- Kein Runtime-Plugin-Marketplace
- Kein externes Nachladen von Plugin-Manifests
- Keine neue Plugin-API jenseits von `PluginDefinition`

## Auswirkungen

- P1-Folgeänderungen können Admin-Ressourcen und Guardrails auf denselben Registry-Vertrag aufsetzen.
- P1/P2-Folgeänderungen für Admin-Ressourcen, Lifecycle-Phasen, Namespacing und Host-Standards erweitern den Registry-Vertrag nur additiv; sie dürfen keinen zweiten Registrierungsmechanismus einführen.
- Review und Tests können auf eine einzige Host-Quelle prüfen statt auf mehrere lose Integrationspunkte.
- Die bestehende statische Architektur wird explizit festgeschrieben, statt implizit weiter mitzuschwimmen.
