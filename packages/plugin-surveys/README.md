# @sva/plugin-surveys

`@sva/plugin-surveys` ist das normale Content-Plugin fuer die Survey-Verwaltung im SVA Studio.

## Architektur-Rolle

Das Paket ist eine fachliche Plugin-Bibliothek im Scope `scope:plugin`. Es registriert den Inhaltstyp `surveys.survey`, haengt sich in den hostgeführten Standard-Content-Pfad ein und erweitert diesen nur um Survey-spezifische Moderations- und Exportrechte.

Boundaries:

- Browser- und Plugin-Code bleiben auf `@sva/plugin-sdk` und `@sva/studio-ui-react` beschraenkt.
- Direkte GraphQL-, Keycloak-, IAM- oder Host-Interna-Imports sind im Plugin nicht zulaessig.
- Der Zugriff auf den SVA Mainserver erfolgt ausschliesslich ueber hostgeführte Fassaden und typed Adapter.

## Fachlicher Zuschnitt

Das Plugin bildet Surveys als normale Inhalte mit denselben Hauptschritten wie andere Content-Plugins ab:

- Sichtbarkeit in der gemischten Inhaltsliste unter `/admin/content`
- Auswahl als weiterer Typ im Flow `Neuer Inhalt`
- gemeinsamer Editor-Rahmen fuer Create und Edit
- Freitext-Moderation, Ergebnisse, Export und Historie innerhalb derselben Detailoberflaeche

Das im Studio gefuehrte Survey-Zielmodell verwendet nur:

- `DRAFT`
- `ACTIVE`
- `ARCHIVED`

Zeitliche Wirkung wird ueber `startAt` und `endAt` modelliert. `SCHEDULED`, `ENDED` und eine redaktionelle Option `allowsMultipleSubmissionsPerDevice` gehoeren nicht zum Studio-Vertrag.

## Oeffentliche API

Der Einstiegspunkt ist [`src/index.ts`](./src/index.ts). Exportiert werden:

- `pluginSurveys` als `PluginDefinition`
- `SURVEYS_CONTENT_TYPE` als kanonischer Content-Type
- Survey-spezifische Action- und Permission-Definitionen
- die Create-/Edit-Seiten fuer hostmaterialisierte Content-Bindings
- die Mainserver-CRUD-Fassade fuer Liste, Detail und Delete
- Survey-Grundtypen fuer Listen- und Detailmodelle

## Nutzung und Integration

Die Integration erfolgt ueber die Plugin-Definition und die hostseitigen Standard-Content-Bindings:

```ts
import { pluginSurveys } from '@sva/plugin-surveys';
```

Das Paket nutzt:

- `createStandardContentPluginContribution(...)` fuer Navigation, Actions, Permissions, `moduleIam`, `contentTypes` und `adminResources`
- `createMainserverCrudClient(...)` fuer die hostgeführte Mainserver-Basis
- `fetchIamContentHistory(...)` fuer den read-only Historien-Tab

## Rechte und Actions

Standard-Content-Rechte werden durch zwei Survey-spezifische Rechte ergaenzt:

- `surveys.moderate` fuer Freitext-Freigabe und Freitext-Loeschung
- `surveys.export` fuer Ergebnisexporte

Die zugehoerigen Actions bleiben Survey-namespaced:

- `surveys.moderate`
- `surveys.export`

## UI-Struktur

Der Editor nutzt in Create und Edit denselben stabilen Rahmen mit fuenf Tabs:

1. `Basis`
2. `Inhalt`
3. `Moderation`
4. `Ergebnisse`
5. `Historie`

Wichtige UI-Regeln:

- keine Card-Verschachtelung
- keine innere Tab-Navigation
- wiederholende Elemente als flache Abschnitte innerhalb derselben Fach-Card
- plugin-lokale Kompositionen fuer Frageneditor, Moderation, Ergebnisse und Historie

Tab-Zuschnitt:

- `Basis`: Identitaet, Laufzeit, Zielgebiet, Metadaten
- `Inhalt`: Beschreibung, Teilnahme und Sichtbarkeit, Hinweise, Fragen
- `Moderation`: gruppierte Freitextantworten pro Frage mit Freigabe und Loeschung
- `Ergebnisse`: Kennzahlen, Frageergebnisse, read-only Freitexte, Export mit und ohne Freitexte
- `Historie`: read-only Content-Historie ueber den hostgeführten History-Client

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
- Freitext-Loeschung
- Ergebnisabruf als JSON-Basis fuer Studio-seitige Exportformate

Die Exportumwandlung nach `CSV`, `JSON`, `Excel` und `XML` ist Aufgabe des Studios, nicht des GraphQL-Vertrags.

## Projektstruktur

```text
packages/plugin-surveys/
├── src/
│   ├── index.ts
│   ├── plugin.tsx
│   ├── plugin.translations.ts
│   ├── surveys.api.ts
│   ├── surveys.constants.ts
│   ├── surveys.detail-basis-tab.tsx
│   ├── surveys.detail-content-model.ts
│   ├── surveys.detail-content-tab.tsx
│   ├── surveys.detail-history-tab.tsx
│   ├── surveys.detail-moderation-tab.tsx
│   ├── surveys.detail-results-tab.tsx
│   ├── surveys.editor.tsx
│   ├── surveys.history.ts
│   ├── surveys.pages.tsx
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
