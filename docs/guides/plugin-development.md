# Plugin-Entwicklung im Studio

Dieser Guide beschreibt den verbindlichen Entwicklungsweg für Studio-Plugins ab Plugin-SDK-Vertrag v1.

> TODO: Diesen Guide um eine eigene Schritt-fuer-Schritt-Anleitung zum Anlegen eines neuen Plugins im Monorepo erweitern, inklusive Workspace-Setup, Paketstruktur, Host-Registrierung und Abgrenzung zwischen verpflichtenden Regeln und optionalen Beispielen.

## Zielbild

Studio-Plugins sind eigenständige Workspace-Packages mit `scope:plugin`. Sie hängen fachlich nur vom öffentlichen SDK-Vertrag ab und werden statisch im App-Bundle registriert.

## Package-Regeln

- Package-Name: `@sva/plugin-<feature>`
- Nx-Tags: mindestens `scope:plugin`, `type:lib`
- Workspace-Abhängigkeiten: nur öffentliche Verträge, primär `@sva/sdk`
- React und Router bleiben Peer Dependencies
- Keine Direktimporte aus `apps/*`, `@sva/auth`, `@sva/routing` oder anderen nicht öffentlichen Host-Interna

## Pflicht-Export

Jedes Plugin exportiert genau ein `PluginDefinition`-Objekt.

```ts
import type { PluginDefinition } from '@sva/sdk';

export const pluginNews: PluginDefinition = {
  id: 'news',
  displayName: 'News',
  routes: [],
  navigation: [],
  contentTypes: [],
  adminResources: [],
  auditEvents: [],
  translations: {},
};
```

## Vertragselemente

### `routes`

- Enthält die plugin-eigenen Seiten
- Der Host übernimmt die tatsächliche Guard-Anwendung
- Plugins deklarieren nur die fachliche Anforderung über `guard`

Zulässige Guards in v1:

- `content.read`
- `content.create`
- `content.write`

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
- `pnpm test:types`
- `pnpm lint`

Vor einem Push bevorzugt:

- `pnpm test:pr`

## Referenzen

- [arc42 Bausteinsicht](../architecture/05-building-block-view.md)
- [arc42 Laufzeitsicht](../architecture/06-runtime-view.md)
- [Migration auf namespaced Plugin-Action-IDs](./plugin-action-migration.md)
- [ADR-034: Plugin-SDK-Vertrag v1](../adr/ADR-034-plugin-sdk-vertrag-v1.md)
