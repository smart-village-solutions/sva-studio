# Plugin-Entwicklung im Studio

Dieser Guide beschreibt den verbindlichen Entwicklungsweg für Studio-Plugins ab Plugin-SDK-Vertrag v1.

Er beschreibt die verpflichtenden Regeln für Studio-Plugins. Eine ergänzende Schritt-für-Schritt-Anleitung zum Anlegen neuer Plugins im Monorepo wird separat dokumentiert und ist nicht Teil dieses verbindlichen Guides.

## Zielbild

Studio-Plugins sind eigenständige Workspace-Packages mit `scope:plugin`. Sie hängen fachlich vom öffentlichen Plugin-SDK-Vertrag ab und können gemeinsame React-UI aus `@sva/studio-ui-react` nutzen. Plugins werden statisch im App-Bundle registriert.

## Package-Regeln

- Package-Name: `@sva/plugin-<feature>`
- Nx-Tags: mindestens `scope:plugin`, `type:lib`
- Workspace-Abhängigkeiten: nur öffentliche Verträge, primär `@sva/plugin-sdk` und bei Custom-Views `@sva/studio-ui-react`
- React und Router bleiben Peer Dependencies
- Keine Direktimporte aus `apps/*`, `@sva/auth-runtime`, `@sva/iam-*`, `@sva/instance-registry`, `@sva/routing` oder anderen nicht öffentlichen Host-Interna
- Keine lokalen Basis-Control-Systeme für Button, Input, Select, Tabs, Dialog, Alert, Badge, Table oder DataTable

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
  navigation: [{ id: 'news.navigation', path: '/plugins/news', titleKey: 'news.navigation.title', requiredAction: 'news.read' }],
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

Die App registriert Plugins statisch in einer zentralen Liste und erzeugt daraus:

- Plugin-Registry
- Plugin-Routen
- Plugin-Navigation
- Plugin-Content-Typen
- gemergte i18n-Ressourcen

Plugins registrieren sich in v1 nicht selbst zur Laufzeit.

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
- Die App-Fassade prüft Session, Instanzkontext und lokale Content-Primitive.
- `@sva/sva-mainserver/server` kapselt OAuth2, GraphQL und Mapping.
- Das News-Modell nutzt dedizierte Mainserver-Felder; `contentBlocks` sind der führende Langinhalt.
- Legacy-`payload` wird nur beim Lesen alter Datensätze in Editorfelder überführt und bei Create/Update nicht geschrieben.
- Lokale Altinhalte werden nicht als produktiver Fallback gelesen.

Events und POI verwenden dasselbe Muster als getrennte Fachplugins:

- `@sva/plugin-events` registriert Namespace `events`, Routen unter `/plugins/events` und den Content-Type `events.event-record`.
- `@sva/plugin-poi` registriert Namespace `poi`, Routen unter `/plugins/poi` und den Content-Type `poi.point-of-interest`.
- Events sprechen `/api/v1/mainserver/events`; POI sprechen `/api/v1/mainserver/poi`.
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
