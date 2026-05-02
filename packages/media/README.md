# @sva/media

`@sva/media` ist ein kleines TypeScript-Library-Package für den gemeinsamen Medien-Domänenvertrag im Workspace. Es bündelt typsichere Modelle für Medien-Assets, Varianten und Referenzen sowie einfache Kernlogik für Presets und Löschentscheidungen.

## Architektur-Rolle

Das Package übernimmt die framework-agnostische Kernrolle für den Medienbereich. Es enthält keine React-Bindings, keine Infrastruktur-Anbindung und keine Persistenzlogik, sondern nur wiederverwendbare Domain-Typen und eine kleine Regel zur Beurteilung, ob ein Media-Asset gelöscht werden darf.

## Öffentliche API

Das Package exportiert ausschließlich das Root-Modul `@sva/media`.

Exportierte Typen:

- `MediaType`
- `MediaVisibility`
- `MediaUploadStatus`
- `MediaProcessingStatus`
- `MediaRole`
- `MediaFormat`
- `MediaFocusPoint`
- `MediaCrop`
- `MediaMetadata`
- `MediaTechnicalMetadata`
- `MediaAsset`
- `MediaVariant`
- `MediaReference`
- `MediaPreset`
- `MediaDeletionDecision`

Exportierte Werte und Funktionen:

- `defaultMediaPresets`
  Enthält die zentralen Standard-Presets `thumbnail`, `teaser` und `hero` als `webp`-Varianten.
- `canDeleteMediaAsset(input)`
  Bewertet, ob ein Asset gelöscht werden darf. Die Funktion blockiert bei aktiven Referenzen, bei `legalHold` oder solange Upload beziehungsweise Verarbeitung noch nicht abgeschlossen sind.

## Nutzung und Integration

Typische Verwendung ist der Import der Domain-Typen in andere Workspace-Packages, die Medien speichern, referenzieren oder validieren.

```ts
import {
  canDeleteMediaAsset,
  defaultMediaPresets,
  type MediaAsset,
  type MediaReference,
} from '@sva/media';

const asset: MediaAsset = {
  id: 'asset-1',
  instanceId: 'instance-1',
  storageKey: 'instance-1/originals/asset-1.jpg',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 1024,
  visibility: 'public',
  uploadStatus: 'processed',
  processingStatus: 'ready',
  metadata: {},
  technical: {},
};

const references: MediaReference[] = [];

const deletionDecision = canDeleteMediaAsset({
  asset,
  references,
});

const heroPreset = defaultMediaPresets.find((preset) => preset.key === 'hero');
```

Für Node-seitig konsumierende Packages gilt der normale Workspace-Vertrag des Repositories: Abhängigkeit über `workspace:*` deklarieren und das gebaute ESM-Entry `dist/index.js` konsumieren.

## Projektstruktur

```text
packages/media/
├── src/
│   ├── index.ts
│   ├── index.test.ts
│   └── index.type-test.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```

Wichtige Dateien:

- `src/index.ts`: gesamte öffentliche API des Pakets
- `src/index.test.ts`: Unit-Tests für Presets und Löschlogik
- `src/index.type-test.ts`: Typtest für die zentralen Domain-Modelle

## Nx-Konfiguration

Das Paket ist in Nx als Library `media` mit den Tags `scope:core` und `type:lib` registriert.

Vorhandene Targets aus `packages/media/project.json`:

- `build`: kompiliert das Paket mit `tsc -p packages/media/tsconfig.lib.json`
- `check:runtime`: prüft nach dem Build die Server-Runtime-Kompatibilität für das Package
- `lint`: lintet die Quelldateien unter `packages/media/src`
- `test:unit`: führt die Vitest-Unit-Tests des Pakets aus
- `test:types`: führt den TypeScript-Typcheck ohne Emit aus
- `test:coverage`: startet die Unit-Tests mit Coverage
- `test:integration`: gibt aktuell nur einen Hinweis aus, dass für `@sva/media` keine Integrationstests konfiguriert sind

## Verwandte Dokumentation

- [AGENTS.md](../../AGENTS.md)
- [DEVELOPMENT_RULES.md](../../DEVELOPMENT_RULES.md)
