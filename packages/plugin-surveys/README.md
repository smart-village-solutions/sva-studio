# @sva/plugin-surveys

`@sva/plugin-surveys` ist das normale Content-Plugin für die Survey-Verwaltung im SVA Studio.

## Architektur-Rolle

Das Paket ist eine fachliche Plugin-Bibliothek im Scope `scope:plugin`. Es registriert den Inhaltstyp `surveys.survey`, hängt sich in den hostgeführten Standard-Content-Pfad ein und erweitert diesen nur um Survey-spezifische Moderations- und Exportrechte.

Boundaries:

- Browser- und Plugin-Code bleiben auf `@sva/plugin-sdk` und `@sva/studio-ui-react` beschränkt.
- Direkte GraphQL-, Keycloak-, IAM- oder Host-Interna-Imports sind im Plugin nicht zulässig.
- Der Zugriff auf den SVA Mainserver erfolgt ausschließlich über hostgeführte Fassaden und typed Adapter.

## Fachlicher Zuschnitt

Das Plugin bildet Surveys als normale Inhalte mit denselben Hauptschritten wie andere Content-Plugins ab:

- Sichtbarkeit in der gemischten Inhaltsliste unter `/admin/content`
- Auswahl als weiterer Typ im Flow `Neuer Inhalt`
- gemeinsamer Editor-Rahmen für Create und Edit
- Freitext-Moderation, Ergebnisse, Export und Historie innerhalb derselben Detailoberfläche

Das im Studio geführte Survey-Zielmodell verwendet nur:

- `DRAFT`
- `ACTIVE`
- `ARCHIVED`

Zeitliche Wirkung wird über `startAt` und `endAt` modelliert. `SCHEDULED`, `ENDED` und eine redaktionelle Option `allowsMultipleSubmissionsPerDevice` gehören nicht zum Studio-Vertrag.

## Öffentliche API

Der Einstiegspunkt ist [`src/index.ts`](./src/index.ts). Exportiert werden:

- `pluginSurveys` als `PluginDefinition`
- `SURVEYS_CONTENT_TYPE` als kanonischer Content-Type
- Survey-spezifische Action- und Permission-Definitionen
- die Create-/Edit-Seiten für hostmaterialisierte Content-Bindings
- die Mainserver-CRUD-Fassade für Liste, Detail und Delete
- Survey-Grundtypen für Listen- und Detailmodelle

## Nutzung und Integration

Die Integration erfolgt über die Plugin-Definition und die hostseitigen Standard-Content-Bindings:

```ts
import { pluginSurveys } from '@sva/plugin-surveys';
```

Das Paket nutzt:

- `createStandardContentPluginContribution(...)` für Navigation, Actions, Permissions, `moduleIam`, `contentTypes` und `adminResources`
- `createMainserverCrudClient(...)` für die hostgeführte Mainserver-Basis
- `fetchIamContentHistory(...)` für den read-only Historien-Tab

## Rechte und Actions

Standard-Content-Rechte werden durch zwei Survey-spezifische Rechte ergänzt:

- `surveys.moderate` für Freitext-Freigabe und Freitext-Löschung
- `surveys.export` für Ergebnisexporte

Die zugehörigen Actions bleiben Survey-namespaced:

- `surveys.moderate`
- `surveys.export`

## UI-Struktur

Der Editor nutzt in Create und Edit denselben stabilen Rahmen mit fünf Tabs:

1. `Basis`
2. `Inhalt`
3. `Moderation`
4. `Ergebnisse`
5. `Historie`

Wichtige UI-Regeln:

- keine Card-Verschachtelung
- keine innere Tab-Navigation
- wiederholende Elemente als flache Abschnitte innerhalb derselben Fach-Card
- plugin-lokale Kompositionen für Frageneditor, Moderation, Ergebnisse und Historie

Tab-Zuschnitt:

- `Basis`: Identität, Laufzeit, Zielgebiet, Metadaten
- `Inhalt`: Beschreibung, Teilnahme und Sichtbarkeit, Hinweise, Fragen
- `Moderation`: gruppierte Freitextantworten pro Frage mit Freigabe und Löschung
- `Ergebnisse`: Kennzahlen, Frageergebnisse, read-only Freitexte, Export mit und ohne Freitexte
- `Historie`: read-only Content-Historie über den hostgeführten History-Client

## Mainserver- und Host-Integration

Das Plugin spricht den Mainserver nie direkt. Der Vertragsweg ist:

1. Browser-UI im Plugin
2. hostgeführte HTTP-Fassade in `apps/sva-studio-react`
3. typed Mainserver-Adapter in `packages/sva-mainserver`
4. GraphQL gegen den SVA Mainserver

Fachlich relevante Survey-Pfade:

- Liste und Detail
- Upsert/Create-or-Update
- Freitext-Freigabe
- Freitext-Löschung
- Ergebnisabruf als JSON-Basis für Studio-seitige Exportformate

Die Exportumwandlung nach `CSV`, `JSON`, `Excel` und `XML` ist Aufgabe des Studios, nicht des GraphQL-Vertrags.

## Projektstruktur

```text
packages/plugin-surveys/
├── src/
│   ├── index.ts
│   ├── plugin.tsx
│   ├── plugin.translations.ts
│   ├── plugin.translations.content.ts
│   ├── plugin.translations.content.en.ts
│   ├── plugin.translations.meta.ts
│   ├── plugin.translations.meta.en.ts
│   ├── plugin.translations.structure.ts
│   ├── plugin.translations.structure.en.ts
│   ├── surveys.api.ts
│   ├── surveys.constants.ts
│   ├── surveys.detail-card.tsx
│   ├── surveys.detail-basis-tab.tsx
│   ├── surveys.detail-content-model.ts
│   ├── surveys.detail-content-tab.tsx
│   ├── surveys.detail-history-tab.tsx
│   ├── surveys.detail-moderation-tab.tsx
│   ├── surveys.detail-results-tab.tsx
│   ├── surveys.editor.tsx
│   ├── surveys.history.ts
│   ├── surveys.moderation-model.ts
│   ├── surveys.moderation-sections.tsx
│   ├── surveys.pages.tsx
│   ├── surveys.question-editor.shared.ts
│   ├── surveys.question-list-editor.tsx
│   ├── surveys.question-options-editor.tsx
│   └── surveys.types.ts
├── tests/
│   ├── surveys.detail-basis-tab.test.tsx
│   ├── surveys.detail-content-model.test.ts
│   ├── surveys.detail-content-tab.test.tsx
│   ├── surveys.detail-history-tab.test.tsx
│   ├── surveys.detail-moderation-tab.test.tsx
│   ├── surveys.detail-results-tab.test.tsx
│   ├── surveys.pages.test.tsx
│   ├── plugin.test.ts
│   └── index.type-test.ts
├── package.json
├── plugin.manifest.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```

## Relevante Doku

- [OpenSpec-Change](../../openspec/changes/add-plugin-surveys-content-plugin/proposal.md)
- [Plugin-Guide](../../docs/guides/plugin-development.md)
- [Content-Core-Vertrag](../../docs/guides/content-management-core-contract.md)
- [Runbook SVA Mainserver](../../docs/development/runbook-sva-mainserver.md)
