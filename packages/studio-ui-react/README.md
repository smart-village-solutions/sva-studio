# @sva/studio-ui-react

React-UI-Bibliothek für Studio-Oberflächen im SVA-Workspace. Das Paket bündelt wiederverwendbare Formular-, Dialog- und Tabellenbausteine sowie Studio-spezifische Seiten- und Surface-Komponenten für Verwaltungs- und Detailansichten.

## Architektur-Rolle

`@sva/studio-ui-react` ist eine UI-Library auf React-Ebene. Sie kapselt präsentationsorientierte Bausteine für Studio-Anwendungen, damit Oberflächen konsistent aufgebaut werden können, ohne Seitenlogik, Datenzugriff oder Routing in die Komponenten selbst zu mischen.

Die Bibliothek sitzt damit oberhalb framework-agnostischer Kernlogik und stellt React-Bindings für:

- allgemeine UI-Primitives wie Buttons, Inputs, Dialoge und Tabs,
- Studio-spezifische Layout- und Statusbausteine,
- tabellarische Datenansichten mit Auswahl-, Sortier- und Bulk-Action-Unterstützung,
- einfache Medienreferenz-Auswahl für Formulare.

## Öffentliche API

Das Paket exportiert seine API zentral über `src/index.ts`. Die Oberfläche gliedert sich in vier Gruppen:

- Basisbausteine: `Alert`, `AlertDialog`, `Badge`, `Button`, `Checkbox`, `Dialog`, `Input`, `Select`, `Tabs`, `Textarea`
- Hilfsfunktion: `cn` zum Zusammenführen von Klassen
- Studio-Primitives: `StudioPageHeader`, `StudioOverviewPageTemplate`, `StudioDetailPageTemplate`, `StudioField`, `StudioFieldGroup`, `StudioFormSummary`, `StudioStateBlock`, `StudioLoadingState`, `StudioEmptyState`, `StudioErrorState`
- Studio-Surfaces und Datenkomponenten: `StudioResourceHeader`, `StudioSection`, `StudioEditSurface`, `StudioDetailTabs`, `StudioActionMenu`, `StudioDataTable`, `MediaReferenceField`

Zusätzlich werden die zugehörigen Prop- und Daten-Typen exportiert, unter anderem:

- `BadgeProps`, `ButtonProps`
- `MediaReferenceFieldOption`, `MediaReferenceFieldProps`
- `StudioBulkAction`, `StudioColumnDef`, `StudioDataTableLabels`, `StudioDataTableProps`
- `StudioActionMenuItem`, `StudioDetailTab` sowie die jeweiligen `...Props`-Typen der Studio-Komponenten

## Nutzung und Integration

Die Bibliothek ist als ESM-Paket veröffentlicht (`type: module`) und exportiert ihren Einstiegspunkt ausschließlich über `dist/index.js` und `dist/index.d.ts`.

Für die Integration relevant:

- Laufzeitvoraussetzungen: `react` und `react-dom` als Peer Dependencies in Version `^19.2.0`
- Externe UI-Grundlagen: Radix-Dialoge/-Tabs, `@tanstack/react-table`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- Styling-Annahme: Die Komponenten verwenden Utility-Klassen wie `border-border`, `bg-card`, `text-muted-foreground` und erwarten damit passende Design-Token bzw. eine kompatible Tailwind/CSS-Konfiguration im konsumierenden Projekt

Die Komponenten sind bewusst zustandsarm gehalten. Fachlogik, Datenladen, Übersetzungen und Routing bleiben in den konsumierenden Apps oder Feature-Paketen.

## Projektstruktur

```text
packages/studio-ui-react/
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── alert.tsx
    ├── alert-dialog.tsx
    ├── badge.tsx
    ├── button.tsx
    ├── checkbox.tsx
    ├── dialog.tsx
    ├── input.tsx
    ├── select.tsx
    ├── tabs.tsx
    ├── textarea.tsx
    ├── media-reference-field.tsx
    ├── studio-data-table.tsx
    ├── studio-primitives.tsx
    ├── studio-surfaces.tsx
    ├── utils.ts
    └── *.test.tsx
```

Wichtige interne Schwerpunkte:

- `src/index.ts` definiert die vollständige öffentliche API
- `src/studio-primitives.tsx` enthält grundlegende Studio-Seiten-, Feld- und Statusbausteine
- `src/studio-surfaces.tsx` bündelt größere Oberflächenstrukturen wie Header, Sections, Tabs und Aktionsleisten
- `src/studio-data-table.tsx` implementiert die generische Studio-Tabelle mit Sortierung, Selektion und Bulk Actions
- `src/*.test.tsx` deckt Rendering, Accessibility-Semantik und Interaktionsverhalten zentraler Komponenten ab

## Nx-Konfiguration

Das Paket ist im Workspace als Library-Projekt `studio-ui-react` registriert und verwendet folgende Targets aus `project.json`:

- `build`: kompiliert das Paket mit `tsc -p packages/studio-ui-react/tsconfig.lib.json` nach `dist/`
- `lint`: prüft Quell- und Testdateien unter `src/` beziehungsweise `tests/`
- `test:unit`: führt die Vitest-Tests im Paket mit `happy-dom` aus
- `test:types`: validiert die TypeScript-Typen ohne Emit
- `test:coverage`: führt die Unit-Tests mit Coverage-Ausgabe nach `packages/studio-ui-react/coverage/` aus

Die Projekt-Tags lauten `scope:studio-ui-react` und `type:lib`.

## Verwandte Dokumentation

- Workspace-Metadaten: `packages/studio-ui-react/package.json` und `packages/studio-ui-react/project.json`
- API-Einstiegspunkt: `packages/studio-ui-react/src/index.ts`
- Verhaltens- und Accessibility-Beispiele: `packages/studio-ui-react/src/studio-primitives.test.tsx` und `packages/studio-ui-react/src/media-reference-field.test.tsx`
- Übergreifende Entwicklungsregeln im Repository: `DEVELOPMENT_RULES.md`
