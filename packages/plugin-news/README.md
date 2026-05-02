# @sva/plugin-news

`@sva/plugin-news` ist ein Plugin-Paket für die News-Verwaltung im SVA Studio. Es bündelt die Plugin-Definition, die CRUD-Anbindung an den Mainserver, formularnahe Validierung sowie React-Seiten für Listen-, Erstell- und Bearbeitungsansichten von News-Inhalten.

## Architektur-Rolle

Das Paket ist eine fachliche Plugin-Bibliothek im Scope `scope:plugin`. Es registriert den Inhaltstyp `news.article`, stellt die zugehörigen Aktionen, Berechtigungen, Übersetzungen und Media-Picker bereit und verbindet diese Definition mit UI- und API-Bausteinen für das Studio-Backend.

Die Kernrolle des Pakets ist die Integration eines standardisierten Content-Plugins auf Basis von `@sva/plugin-sdk`. Die eigentliche Einbindung in eine Host-Anwendung erfolgt über die exportierte Plugin-Definition `pluginNews`.

## Öffentliche API

Der Einstiegspunkt ist [`src/index.ts`](./src/index.ts). Exportiert werden aktuell:

- `pluginNews` als vollständige `PluginDefinition` für die Registrierung im Plugin-System
- `NEWS_CONTENT_TYPE` mit dem konstanten Inhaltstyp `news.article`
- `NewsCreatePage`, `NewsEditPage` und `NewsListPage` als React-Seiten für die Studio-Oberfläche
- `validateNewsForm` und `validateNewsPayload` für fachliche Eingabevalidierung
- die Typen `NewsContentItem`, `NewsFormInput`, `NewsPayload` und `NewsStatus`

Ergänzend kapselt [`src/news.api.ts`](./src/news.api.ts) die Mainserver-Kommunikation für Listen-, Detail-, Erstell-, Änderungs- und Löschoperationen sowie die domänenspezifische Fehlerklasse `NewsApiError`.

## Nutzung und Integration

Für die Integration in das Studio wird das Paket als Workspace-Abhängigkeit eingebunden und die Plugin-Definition registriert:

```ts
import { pluginNews } from '@sva/plugin-news';

const plugins = [pluginNews];
```

Die Laufzeit setzt React sowie `@tanstack/react-router` als Peer Dependencies voraus. Intern nutzt das Paket `@sva/plugin-sdk` für Plugin- und Mainserver-Abstraktionen und `@sva/studio-ui-react` für die Studio-Oberfläche.

Fachlich deckt das Paket derzeit insbesondere folgende Integrationspunkte ab:

- standardisierte Content-Aktionen und Berechtigungen für das Plugin `news`
- zweckgebundene Media-Picker für Teaser- und Header-Bilder
- CRUD-Zugriffe auf `/api/v1/mainserver/news`
- formularnahe Validierung für Datumswerte, Kategorien, HTTPS-URLs und Inhaltsblöcke

## Projektstruktur

```text
packages/plugin-news/
├── src/
│   ├── index.ts
│   ├── plugin.tsx
│   ├── news.api.ts
│   ├── news.constants.ts
│   ├── news.pages.tsx
│   ├── news.types.ts
│   └── news.validation.ts
├── tests/
│   ├── news.api.test.ts
│   ├── news.pages.test.tsx
│   ├── news.validation.test.ts
│   └── plugin.test.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```

- `src/plugin.tsx` definiert Plugin-Metadaten, Aktionen, Berechtigungen, Übersetzungen und Media-Picker.
- `src/news.pages.tsx` enthält die React-Seiten für Listen- und Detailbearbeitung im Studio.
- `src/news.api.ts` bündelt die Mainserver-CRUD-Logik.
- `src/news.types.ts` beschreibt die fachlichen Datenstrukturen für Formulare, Inhalte und Pagination.
- `src/news.validation.ts` kapselt die fachlichen Prüfregeln.
- `tests/` deckt Plugin-Definition, API, Seitenlogik und Validierung ab.

## Nx-Konfiguration

Die Nx-Projektdefinition liegt in [`project.json`](./project.json). Das Paket ist als `library` mit den Tags `scope:plugin` und `type:lib` konfiguriert.

Vorhandene Targets:

- `build`: TypeScript-Build über `tsc -p packages/plugin-news/tsconfig.lib.json`
- `lint`: ESLint für Quellcode und Tests
- `test:unit`: Vitest-Ausführung für die Paket-Tests
- `test:coverage`: Vitest mit Coverage-Ausgabe
- `test:integration`: Platzhalter-Target ohne konfigurierte Integrationstests

Die paketlokale Testkonfiguration liegt in [`vitest.config.ts`](./vitest.config.ts) und nutzt `happy-dom` mit Aliasen auf Workspace-Quellpakete.

## Verwandte Dokumentation

Dedizierte Fachdokumentation für dieses Paket liegt aktuell nicht im Paketverzeichnis vor. Für die Arbeit am Plugin sind vor allem diese paketnahen Referenzen relevant:

- [`package.json`](./package.json) für Abhängigkeiten, Exporte und Peer Dependencies
- [`project.json`](./project.json) für Nx-Targets und Projektmetadaten
- [`tests/plugin.test.ts`](./tests/plugin.test.ts) als kompakte Referenz für die erwartete Plugin-Definition
- [`tests/news.validation.test.ts`](./tests/news.validation.test.ts) für die fachlichen Validierungsregeln
