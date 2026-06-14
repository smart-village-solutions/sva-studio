# Plugin-Entwicklung im Studio

Dieser Guide beschreibt den verbindlichen Entwicklungsweg für Studio-Plugins ab Plugin-Plattform v2.

Er beschreibt die verpflichtenden Regeln für Studio-Plugins sowie den kanonischen Dev-, Publish- und Installationspfad. Ein Plugin wird nicht mehr über harte Imports in `apps/sva-studio-react` registriert, sondern über Manifest plus Katalogeintrag in einen hostvalidierten Snapshot materialisiert.

## Zielbild

Studio-Plugins sind eigenständige Packages mit `scope:plugin`. Sie hängen fachlich vom öffentlichen Plugin-SDK-Vertrag ab, können gemeinsame React-UI aus `@sva/studio-ui-react` nutzen und werden vom Host über einen konfigurierten Plugin-Katalog geladen.

Der Host unterstützt zwei Betriebsmodi:

- `workspace`: Entwicklung direkt aus einem Workspace-Package ohne Core-Codeänderung
- `linked-package` oder `installed-distribution`: Laden eines lokal verlinkten oder installierten Pakets aus `node_modules`

Beide Wege verwenden denselben Katalogvertrag und denselben hostvalidierten Snapshot.

## Package-Regeln

- Package-Name: `@sva/plugin-<feature>`
- Nx-Tags: mindestens `scope:plugin`, `type:lib`
- Workspace-Abhängigkeiten: nur öffentliche Verträge, primär `@sva/plugin-sdk` und bei Custom-Views `@sva/studio-ui-react`
- React und Router bleiben Peer Dependencies
- Keine Direktimporte aus `apps/*`, `@sva/auth-runtime`, `@sva/iam-*`, `@sva/instance-registry`, `@sva/routing` oder anderen nicht öffentlichen Host-Interna
- Keine lokalen Basis-Control-Systeme für Button, Input, Select, Tabs, Dialog, Alert, Badge, Table oder DataTable

Zusätzlich für publishbare Plugins:

- jedes Plugin liefert ein `plugin.manifest.json` am Package-Root
- veröffentlichte Artefakte müssen mindestens `dist/` und `plugin.manifest.json` enthalten
- `package.json` exportiert zusätzlich `./plugin.manifest.json`

## Standard Path und Advanced Path

Der verbindliche Zielvertrag fuer Studio-Plugins unterscheidet zwei Pfade:

- `Standard Path` fuer typische fachliche Plugins mit deklarativen Beitraegen und optionalen React-Custom-Views
- `Advanced Path` fuer bewusst freigegebene Sonderfaelle, in denen der Host zusaetzliche Runtime- oder Integrationsvertraege oeffentlich macht

Beide Pfade gelten fuer interne und externe Plugins gleichermassen. Repository-Naehe, Teamzugehoerigkeit oder historischer Bestand erzeugen keinen stillschweigenden Sonderstatus.

### Standard Path

Der Standard Path ist der bevorzugte und review-arme Happy Path fuer neue Plugins.

Verbindliche Regeln:

- Workspace-Dependencies: `@sva/plugin-sdk`
- bei React-Custom-Views zusaetzlich `@sva/studio-ui-react`
- Peer Dependencies bleiben `react`, `react-dom`, `@tanstack/react-router`
- `src/index.ts` exportiert genau ein fuehrendes `PluginDefinition`-Objekt
- Plugins duerfen keine Workspace-Dependencies auf `@sva/core`, `@sva/auth-runtime`, `@sva/server-runtime`, `@sva/routing`, `@sva/iam-*`, `@sva/instance-registry`, `@sva/data`, `@sva/data-client`, `@sva/data-repositories`, `@sva/sva-mainserver`, `@sva/studio-module-iam`, `@sva/monitoring-client`, `@sva/media` oder App-Pfade einziehen
- Plugins duerfen keine Imports aus `apps/*` oder aus nicht als oeffentlicher Plugin-Vertrag dokumentierten Host-Packages verwenden

Der Standard Path ist auch dann massgeblich, wenn ein Plugin komplexe Fach-UI, Validierung, Search-Param-Modelle oder hostseitig persistierte CRUD-Flows beisteuert. Fachliche Tiefe rechtfertigt keine implizite Core- oder Host-Kopplung.

### Advanced Path

Der Advanced Path ist ein ausdruecklicher Escape Hatch fuer Sonderfaelle, aber kein freier Direktzugriff auf interne Host-Bausteine.

Verbindliche Regeln:

- Plugins duerfen erweiterte Faehigkeiten nur ueber explizite oeffentliche Host-Vertraege konsumieren, nie ueber zufaellige interne Packages
- `@sva/plugin-sdk` und `@sva/studio-ui-react` bleiben die einzigen erlaubten internen Plugin-Einstiegspunkte
- Browser-UI darf fachlich frei implementiert werden, solange die gemeinsame wiederverwendbare UI-Basis weiter `@sva/studio-ui-react` bleibt
- pluginseitige Server-, Job- und Integrationsbeitraege laufen nur in host-owned Execution-Contexts
- jede neue Advanced-Path-Faehigkeit braucht einen eigenen OpenSpec-Change oder eine explizite Erweiterung des fuehrenden Governance-Changes
- jede aktive Advanced-Path-Ausnahme wird als importkantenorientierter Eintrag in `config/plugin-architecture-allowlist.json` dokumentiert

Ein Advanced Path liegt nur dann vor, wenn der Host den dafuer benoetigten Vertrag bewusst als oeffentlichen Plugin-Eintrittspunkt beschreibt. Ein guenstiges Nx-Tag, ein historisches Package oder ein bereits vorhandener Importpfad zaehlt nicht als Freigabe.

## Standard-Content-Helfer aus dem Plugin-SDK

Standardisierte CRUD-Content-Plugins sollen gemeinsame technische Muster bevorzugt über `@sva/plugin-sdk` beziehen statt sie lokal oder pluginübergreifend zu duplizieren.

Bevorzugt:

- `createStandardContentPluginContribution(...)` für Navigation, Actions, Permissions, `moduleIam`, `contentTypes` und `adminResources`
- `createMainserverCrudClient(...)` für hostgeführte Mainserver-CRUD-Basis
- kleine UI-nahe Helfer wie Datetime- oder Media-Mapping aus `@sva/plugin-sdk`

Nicht erlaubt:

- Shared-Code in einem eigenen pluginübergreifenden Workspace-Package nur für News, Events und POI
- Direktimporte eines Plugins aus einem anderen Plugin
- generische Editor-Abstraktionen, die fachliche Feldmodelle oder Validierung aus den Plugins herausziehen

## Boundary-Governance

Die Architekturgrenze fuer Plugins wird nicht nur review-seitig, sondern auch maschinell erzwungen.

- `pnpm check:plugin-ui-boundary` prueft die gemeinsame UI-Basis gegen App-Importe und lokale Basis-Control-Duplikate
- `pnpm check:plugin-architecture-boundary` laeuft im ersten Rollout warn-only fuer `packages/plugin-*`
- der Check bewertet direkte, relative, Runtime-, Type- und Re-Export-Kanten sowie Host-Package-Nutzung in `packages/plugin-*`
- bekannte importbezogene Altlasten stehen in `config/plugin-architecture-allowlist.json`

Bestandsfaelle werden nicht stillschweigend akzeptiert. Wenn ein bestehendes Plugin noch nicht auf dem Zielvertrag liegt, muss die konkrete Importkante in `config/plugin-architecture-allowlist.json` stehen. Die Allowlist bildet heute nur importorientierte Guard-Ausnahmen ab und ersetzt historische Baseline-Klassen wie Workspace-Dependencies oder Path-Signals nicht eins zu eins. `docs/reports/plugin-architecture-boundary-baseline.md` bleibt nur als Brownfield-Historie und Verweis auf die primaeren Governance-Dokumente erhalten. Der JSON-Vertrag unterstuetzt aktuell:

- `plugin`
- `sourceFile`
- `importSpecifier`
- `resolvedTarget`
- `kind`
- `reason`
- optional `ticket`

Review- oder Prozessmetadaten wie Owner, Folgechange oder Abbauplanung gehoeren bei Bedarf in PR-, Ticket- oder Architekturkontext, nicht in den aktuellen JSON-Vertrag.

## Pflicht-Export

Jedes Plugin exportiert genau ein `PluginDefinition`-Objekt.

```ts
import type { PluginDefinition } from '@sva/plugin-sdk';

export const pluginNews: PluginDefinition = {
  id: 'news',
  displayName: 'News',
  routes: [],
  navigation: [],
  permissions: [],
  contentTypes: [],
  adminResources: [],
  auditEvents: [],
  translations: {},
};
```

## Manifest- und Katalogvertrag

Jedes publishbare Plugin liefert ein serialisierbares Manifest:

```json
{
  "pluginId": "news",
  "version": "0.0.1",
  "sdkVersion": "0.0.1",
  "hostCompatibility": {
    "studioVersionRange": "^0.0.1",
    "requiredCapabilities": ["routing", "navigation", "iam"]
  },
  "entryPoints": {
    "browser": "./dist/index.js"
  }
}
```

Der Host bindet Plugins über `apps/sva-studio-react/plugin-catalog.json` ein. Ein Katalogeintrag enthält nur Aktivierungs- und Quellinformationen; das Manifest wird anschließend aus dem referenzierten Package gelesen.

Beispiel:

```json
[
  {
    "pluginId": "news",
    "sourceType": "workspace",
    "enabled": true,
    "sourceRef": "packages/plugin-news"
  },
  {
    "pluginId": "weather",
    "sourceType": "installed-distribution",
    "enabled": false,
    "sourceRef": "@vendor/plugin-weather"
  }
]
```

`enabled: false` hält ein Plugin bewusst außerhalb von Routing, Navigation, IAM und Job-Registrierung. Inkompatible Plugins werden zusätzlich fail-closed verworfen und als Katalogproblem protokolliert.

## Lokaler Dev-Workflow

Neues oder geändertes Plugin im Workspace:

1. Plugin als `packages/plugin-<feature>/` anlegen.
2. `plugin.manifest.json` am Package-Root anlegen.
3. `src/index.ts` muss das führende `PluginDefinition` exportieren.
4. Plugin in `apps/sva-studio-react/plugin-catalog.json` mit `sourceType: "workspace"` aufnehmen.
5. Studio starten, ohne `apps/sva-studio-react/src/lib/plugins.ts` oder andere Core-Pakete anzupassen.

Lokal verlinktes Plugin außerhalb des Monorepos:

1. Package lokal bauen, sodass `dist/` und `plugin.manifest.json` vorhanden sind.
2. Package per `pnpm link` oder äquivalent nach `node_modules` verlinken.
3. Katalogeintrag mit `sourceType: "linked-package"` und `sourceRef` als Package-Name ergänzen.
4. Studio neu starten; der Host lädt Manifest und Browser-Entry aus dem verlinkten Package.

## Publish- und Installationsworkflow

Für veröffentlichte Plugins gilt der kanonische Artefaktvertrag:

1. `pnpm nx run <plugin>:build` erzeugt `dist/`.
2. Das NPM-Artefakt enthält mindestens `dist/` und `plugin.manifest.json`.
3. Der Operator installiert das Package in die Host-Umgebung.
4. Der Operator ergänzt oder ändert den Katalogeintrag mit `sourceType: "installed-distribution"` und `sourceRef` als Paketname.
5. Beim nächsten Host-Start oder Build liest der Host zuerst das Manifest und aktiviert das Plugin nur bei erfolgreicher Kompatibilitätsprüfung.

Der Publish-/Installationspfad führt keinen unvalidierten Plugin-Code vor dem Manifest-Check aus.

## Kompatibilitätsprüfung und fail-closed Verhalten

Vor der Aktivierung prüft der Host mindestens:

- exakte SDK-Version (`sdkVersion`)
- unterstützte Studio-Version (`hostCompatibility.studioVersionRange`)
- deklarierte Host-Capabilities (`requiredCapabilities`)
- vorhandenen Browser-Entry-Point
- Übereinstimmung zwischen `manifest.pluginId` und exportierter `PluginDefinition.id`

Fehlschläge führen zu stabilen Ablehnungsgründen wie:

- `plugin_incompatible_sdk_version`
- `plugin_incompatible_studio_version`
- `plugin_missing_host_capability`
- `plugin_missing_browser_entry`
- `plugin_module_missing`
- `plugin_module_mismatch`

Ein abgelehntes Plugin erscheint nicht teilweise im Snapshot.

## UI-Boundary

Plugin-Custom-Views sind zulässig, wenn sie die Host-Shell, hostseitige Guards und den Routing-Vertrag respektieren. Wiederverwendbare Studio-UI kommt ausschließlich aus `@sva/studio-ui-react`.

Erlaubt:

```tsx
import {
  Button,
  Input,
  StudioDetailPageTemplate,
  StudioField,
  StudioFormSummary,
} from '@sva/studio-ui-react';
```

Nicht erlaubt:

```tsx
import { Button } from '../../../apps/sva-studio-react/src/components/ui/button';
```

Fachspezifische Wrapper sind erlaubt, wenn sie Studio-Primitives komponieren und keine eigene visuelle Sprache, keine eigenen Basisvarianten und keine abweichende ARIA-Semantik einführen. Beispiele sind `NewsStatusBadge`, `NewsPublicationField` oder später ein fachlich eingegrenzter `MediaReferencePicker`.

Spezialcontrols wie Rich-Text, Upload, Medienauswahl, Farbe, Icon und Geo-Auswahl werden erst in `@sva/studio-ui-react` aufgenommen, wenn mindestens ein pluginübergreifender Bedarf besteht. Bis dahin bleiben sie schmale fachliche Wrapper.

## Medien-Extension-Points

Plugins binden Medien ausschließlich über den hostseitigen Media-Picker-Vertrag an.

Erlaubt:

- deklarative Picker-Definitionen über `@sva/plugin-sdk`
- UI-Bindings über `@sva/studio-ui-react`, zum Beispiel `MediaReferenceField`
- hostseitige Referenzverwaltung über die Media-HTTP-Fassade

Nicht erlaubt:

- direkte MinIO-/S3-Clients im Plugin
- Bucket-Namen, Object-Keys, ETags oder presigned URLs als Plugin-Vertrag
- direkte Importe aus `@sva/auth-runtime` oder anderen Host-Storage-Interna
- neue URL-basierte Storage-Artefakte als führendes Persistenzmodell

Plugins deklarieren Rollen, Medientypen und optional Preset-Anforderungen, erhalten aber keine technischen Storage-Details zurück.

Beispielhaft verwendet:

- News: `teaser_image`, `header_image`
- Events: `header_image`
- POI: `teaser_image`

## Vertragselemente

### `routes`

- Enthält die plugin-eigenen Seiten
- Der Host übernimmt die tatsächliche Guard-Anwendung
- Plugins deklarieren nur die fachliche Anforderung über `guard`
- Produktive Fachplugins verwenden plugin-spezifische Guards aus `permissions`, zum Beispiel `news.read`

Legacy-Guards aus dem generischen Content-Vertrag sind nur noch für hosteigene oder historische Core-Content-Pfade zulässig. Produktive Fachplugins dürfen keine `content.*`-Guards mehr deklarieren.

### `permissions`

- Beschreibt die autorisierbaren Rechte, die ein Plugin fachlich bereitstellt
- Permission-IDs verwenden das Format `<pluginId>.<actionName>`
- Der Namespace muss exakt der `PluginDefinition.id` entsprechen
- Reservierte Namespaces wie `content`, `iam`, `admin`, `core`, `system` und `platform` sind für Plugins gesperrt
- Routen, Navigation und Actions dürfen nur eigene, registrierte Permission-IDs referenzieren
- `requiredAction` bleibt der kanonische Mapping-Pfad; Action-ID und Permission-ID dürfen identisch sein

Beispiel:

```ts
import { definePluginPermissions, type PluginDefinition } from '@sva/plugin-sdk';

const newsPermissions = definePluginPermissions('news', [
  { id: 'news.read', titleKey: 'news.permissions.read' },
  { id: 'news.create', titleKey: 'news.permissions.create' },
  { id: 'news.update', titleKey: 'news.permissions.update' },
  { id: 'news.delete', titleKey: 'news.permissions.delete' },
]);

export const pluginNews: PluginDefinition = {
  id: 'news',
  displayName: 'News',
  permissions: newsPermissions,
  routes: [{ id: 'news.list', path: '/plugins/news', guard: 'news.read', component: NewsListPage }],
  navigation: [{ id: 'news.navigation', to: '/plugins/news', titleKey: 'news.navigation.title', requiredAction: 'news.read' }],
  translations: {},
};
```

### `navigation`

- Navigationspunkte werden deklarativ beschrieben
- Der sichtbare Text kommt immer über `titleKey`
- Die Shell ordnet den Punkt über `section` in bestehende Bereiche ein

### `contentTypes`

- Beschreibt die fachlichen Inhaltstypen, die das Plugin im UI repräsentiert
- Die serverseitige Validierung bleibt davon getrennt und muss im jeweiligen Server-Package registriert werden
- Plugin-`contentType`s müssen fully-qualified im Format `<pluginId>.<name>` definiert werden
- Der Namespace muss der `PluginDefinition.id` entsprechen
- Core-Typen wie `generic` und `legal` bleiben Host-Identifier und werden nicht von Plugins registriert

### `adminResources`

- Plugin-beigestellte Admin-Ressourcen verwenden eine `resourceId` im Format `<pluginId>.<name>`
- `resourceId` und `basePath` bleiben global kollisionsfrei
- Host-Ressourcen wie `content` bleiben unverändert und fallen nicht unter die Plugin-Namespace-Pflicht

### `auditEvents`

- Plugin-spezifische Audit-Event-Typen verwenden das Format `<pluginId>.<eventName>`
- Plugins dürfen nur Audit-Events im eigenen Namespace deklarieren
- Bestehende hosteigene Audit-Event-Typen bleiben unverändert

### `translations`

- Plugin-Ressourcen werden pro Locale im Plugin mitgeliefert
- Schlüssel folgen der Konvention `<pluginId>.*`
- Plugin-Komponenten verwenden `usePluginTranslation(pluginId)`

## Host-Integration

Die App liest den Katalog, lädt Manifeste und Module abhängig vom `sourceType` und erzeugt daraus genau einen validierten Snapshot für:

- Plugin-Registry
- Plugin-Routen
- Plugin-Navigation
- Plugin-Content-Typen
- gemergte i18n-Ressourcen
- Job-, Import- und IAM-Registries

Plugins registrieren sich weiterhin nicht selbst zur Laufzeit. Die Aktivierung bleibt hostowned.

## Routing

Empfohlene Pfadkonvention:

- Liste: `/plugins/<plugin-id>`
- Neu-Anlage: `/plugins/<plugin-id>/new`
- Detail/Bearbeitung: `/plugins/<plugin-id>/$id`

Der Host setzt `document.title`, Breadcrumbs und Fokus-Management konsistent für Plugin-Routen um. Plugins sollen ihre Seiten mit einer klaren Heading-Hierarchie beginnen.

## Content-Typen

Wenn ein Plugin einen spezialisierten `contentType` nutzt:

1. UI-seitig im Plugin `contentTypes` deklarieren.
2. Serverseitig im generischen Content-Write-Pfad ein Payload-Schema registrieren.
3. Bei HTML-Feldern serverseitig sanitizen.
4. Rechte weiter über die bestehenden Core-Aktionen anwenden.

Das News-Plugin ist die Referenz dafür und verwendet dafür den kanonischen Typ `news.article`.

Fachplugins dürfen ihre UI und clientseitige Validierung im Plugin halten, Persistenzgrenzen bleiben aber hostgeführt. Wenn ein Plugin Daten aus einem externen Fachdienst benötigt, stellt der Host eine schmale HTTP- oder SDK-Fassade bereit. Das Plugin importiert dabei keine App-Module, keine serverseitigen Auth-Runtime-Module und keine serverseitigen Fachadapter.

Das News-Plugin nutzt dieses Muster für Mainserver-News:

- UI, Routen, Aktionen und Übersetzungen liegen in `@sva/plugin-news`.
- Datenzugriff läuft über `/api/v1/mainserver/news`.
- Die technische CRUD-Basis kann über `createMainserverCrudClient(...)` aus `@sva/plugin-sdk` bezogen werden.
- Die App-Fassade prüft Session, Instanzkontext und lokale Content-Primitive.
- `@sva/sva-mainserver/server` kapselt OAuth2, GraphQL und Mapping.
- Das News-Modell nutzt dedizierte Mainserver-Felder; `contentBlocks` sind der führende Langinhalt.
- Legacy-`payload` wird nur beim Lesen alter Datensätze in Editorfelder überführt und bei Create/Update nicht geschrieben.
- Lokale Altinhalte werden nicht als produktiver Fallback gelesen.

Events und POI verwenden dasselbe Muster als getrennte Fachplugins:

- `@sva/plugin-events` registriert Namespace `events`, Routen unter `/plugins/events` und den Content-Type `events.event-record`.
- `@sva/plugin-poi` registriert Namespace `poi`, Routen unter `/plugins/poi` und den Content-Type `poi.point-of-interest`.
- Events sprechen `/api/v1/mainserver/events`; POI sprechen `/api/v1/mainserver/poi`.
- Wiederholte Standard-Metadaten und HTTP-Basislogik sollen auch hier über `@sva/plugin-sdk` zentralisiert werden, nicht über Plugin-Querimporte.
- Eine Event-zu-POI-Auswahl läuft über die POI-Fassade des Hosts. Das Events-Plugin importiert das POI-Plugin nicht.
- Delete nutzt in Phase 1 `destroyRecord` mit den Mainserver-Record-Types `EventRecord` und `PointOfInterest`.

## i18n

- Keine harten UI-Strings
- Navigation, CTA, Fehlertexte und Statusmeldungen immer als Übersetzungsschlüssel
- Plugin-Komponenten verwenden `usePluginTranslation('<pluginId>')`

Beispiel:

```ts
const pt = usePluginTranslation('news');
pt('navigation.title');
pt('messages.saveError');
```

## Accessibility

Plugins müssen die bestehenden Projektregeln aus `DEVELOPMENT_RULES.md` einhalten:

- programmatische Labels
- Pflichtfelder mit `required`
- feldbezogene Fehlertexte per `aria-describedby`
- Statusfeedback über `role="status"` oder `aria-live`
- vollständige Tastaturbedienbarkeit

## Tests

Mindestumfang für neue Plugins:

- Unit-Tests für den Plugin-Vertrag und kritische UI-Flows
- Type-Tests für öffentliche Exporte
- Host-Integrationstests für Navigation und Guards
- bei serverseitigen Erweiterungen zusätzliche API-/Mutations-Tests

Zusätzlich gilt:

- `pnpm nx run <plugin>:test:unit`
- `pnpm check:plugin-ui-boundary`
- `pnpm test:types`
- `pnpm lint`

Vor einem Push bevorzugt:

- `pnpm test:pr`

## Referenzen

- [arc42 Bausteinsicht](../architecture/05-building-block-view.md)
- [arc42 Laufzeitsicht](../architecture/06-runtime-view.md)
- [Studio-Übersichts- und Detailseiten-Standard](../development/studio-uebersichts-und-detailseiten-standard.md)
- [Migration auf namespaced Plugin-Action-IDs](./plugin-action-migration.md)
- [ADR-034: Plugin-SDK-Vertrag v1](../adr/ADR-034-plugin-sdk-vertrag-v1.md)
- [ADR-041: Plugin-Plattform v2 für externe Distribution](../adr/ADR-041-plugin-plattform-v2-fuer-externe-distribution.md)
- [ADR-039: Medienmanagement als Host-Capability](../adr/ADR-039-medienmanagement-host-capability-und-storage-vertrag.md)
