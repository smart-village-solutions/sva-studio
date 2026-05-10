# Standard-Content-Plugins auf Plugin-Plattform-v2-Kompatibilität geprüft

## Zweck

Dieser Report dokumentiert den Abgleich für Task `6.3` des Changes `refactor-plugin-platform-for-external-publishable-plugins`.

Geprüft wurden die bestehenden Standard-Content-Plugins:

- `@sva/plugin-news`
- `@sva/plugin-events`
- `@sva/plugin-poi`

## Prüfkriterien

Für jedes Plugin wurde geprüft:

- eigenes `plugin.manifest.json` vorhanden
- Katalogeintrag in `apps/sva-studio-react/plugin-catalog.json` vorhanden
- Snapshot-Materialisierung über den kanonischen Loader möglich
- Package enthält publishbare Artefaktdefinition über `files` plus `exports["./plugin.manifest.json"]`
- keine plugin-spezifische Sonderverdrahtung für Jobs oder Host-Runner erforderlich

## Ergebnis

### `@sva/plugin-news`

- Katalogeintrag vorhanden als `workspace`-Quelle
- Manifest vorhanden unter `packages/plugin-news/plugin.manifest.json`
- Browser-Entry wird über den kanonischen Loader aufgelöst
- Publish-Artefakte sind über `dist/` und `plugin.manifest.json` definiert
- kein `jobs`-Entry-Point notwendig

Bewertung: katalog- und snapshot-kompatibel

### `@sva/plugin-events`

- Katalogeintrag vorhanden als `workspace`-Quelle
- Manifest vorhanden unter `packages/plugin-events/plugin.manifest.json`
- Browser-Entry wird über den kanonischen Loader aufgelöst
- Publish-Artefakte sind über `dist/` und `plugin.manifest.json` definiert
- kein `jobs`-Entry-Point notwendig

Bewertung: katalog- und snapshot-kompatibel

### `@sva/plugin-poi`

- Katalogeintrag vorhanden als `workspace`-Quelle
- Manifest vorhanden unter `packages/plugin-poi/plugin.manifest.json`
- Browser-Entry wird über den kanonischen Loader aufgelöst
- Publish-Artefakte sind über `dist/` und `plugin.manifest.json` definiert
- kein `jobs`-Entry-Point notwendig

Bewertung: katalog- und snapshot-kompatibel

## Einordnung

Die drei Standard-Content-Plugins erfüllen damit den Mindestzuschnitt für die Plugin-Plattform v2:

- sie können über denselben Katalogvertrag wie externe Plugins beschrieben werden
- sie werden über denselben Snapshot-Loader wie andere Workspace-Plugins materialisiert
- sie benötigen keine app-lokale Sonderregistrierung mehr in `apps/sva-studio-react/src/lib/plugins.ts`

Nicht Teil dieses Abgleichs war eine vollständige Migration auf getrennte serverseitige Plugin-Entry-Points, weil diese Plugins aktuell keine eigenen Job- oder Server-Beiträge deklarieren.

## Restpunkte

- Für einen späteren echten `installed-distribution`-Pfad außerhalb des Monorepos sollten Installations-Smoke-Tests mit gepackten Artefakten ergänzt werden.
- Falls eines der Standard-Content-Plugins künftig eigene Job- oder Server-Beiträge erhält, muss zusätzlich ein `jobs`- oder `server`-Entry-Point nach dem Vorbild von `plugin-waste-management` ergänzt werden.
