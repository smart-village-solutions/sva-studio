## 1. Specification

- [ ] 1.1 OpenSpec-Deltas für `account-ui`, `monorepo-structure`, `architecture-documentation` und `routing` finalisieren
- [ ] 1.2 Wechselwirkung mit `refactor-p3-content-ui-specialization-boundaries` und `add-p2-admin-resource-host-standards` prüfen
- [ ] 1.3 `pnpm openspec validate add-studio-ui-plugin-view-contract --strict` ausführen

## 2. Architecture Documentation

- [ ] 2.1 `docs/architecture/package-zielarchitektur.md` um `@sva/studio-ui-react` als Zielpackage ergänzen
- [ ] 2.2 `docs/architecture/04-solution-strategy.md` um UI-Boundary und Plugin-Custom-View-Regel ergänzen
- [ ] 2.3 `docs/architecture/05-building-block-view.md` um Baustein `packages/studio-ui-react` ergänzen
- [ ] 2.4 `docs/architecture/06-runtime-view.md` um Laufzeitfluss für Plugin-Custom-Views mit `@sva/studio-ui-react` ergänzen
- [ ] 2.5 `docs/architecture/08-cross-cutting-concepts.md` um Design-Tokens, shadcn-Kapselung und UI-Boundary ergänzen
- [ ] 2.6 `docs/architecture/10-quality-requirements.md` und `11-risks-and-technical-debt.md` um UI-Drift- und Boundary-Risiken ergänzen

## 3. Package Setup

- [ ] 3.1 `packages/studio-ui-react` als Nx-Library mit Importpfad `@sva/studio-ui-react` anlegen
- [ ] 3.2 `package.json`, `project.json`, `tsconfig` und Path-Mapping für `@sva/studio-ui-react` konfigurieren
- [ ] 3.3 React, React-DOM und UI-Primitive als Peer-/Dependency-Grenzen sauber deklarieren
- [ ] 3.4 Build-, Unit-Test-, Type-Test- und Lint-Targets in Nx integrieren

## 4. UI Components

- [ ] 4.1 shadcn/ui-Basiscontrols für Button, Input, Textarea, Select, Checkbox, Badge, Alert, Dialog, AlertDialog und Tabs in `@sva/studio-ui-react` bereitstellen
- [ ] 4.2 `StudioPageHeader`, `StudioOverviewPageTemplate`, `StudioDetailPageTemplate`, `StudioResourceHeader`, `StudioDetailTabs`, `StudioSection`, `StudioEditSurface` und `StudioActionMenu` implementieren
- [ ] 4.3 `StudioField`, `StudioFieldGroup`, `StudioFieldSet` und `StudioFormSummary` für konsistente Formulare implementieren
- [ ] 4.4 `StudioStateBlock` und spezifische Loading-, Empty-, Error-, Forbidden-, Not-Found- und Read-only-States implementieren
- [ ] 4.5 `StudioDataTable` oder eine erste Tabellen-/Listenbasis für Admin-Übersichten bereitstellen

## 5. Host Migration

- [ ] 5.1 App-interne UI-Imports in `apps/sva-studio-react` schrittweise auf `@sva/studio-ui-react` umstellen
- [ ] 5.2 Bestehende Übersichtsseiten mit `StudioOverviewPageTemplate` und Tabellen-/Toolbar-Bausteinen abgleichen
- [ ] 5.3 Bestehende Detailseiten mit `StudioDetailPageTemplate`, `StudioResourceHeader`, `StudioEditSurface` und Formularbausteinen abgleichen
- [ ] 5.4 App-interne Komponenten nur als Übergangsadapter behalten oder entfernen

## 6. Plugin Migration

- [ ] 6.1 `packages/plugin-news` um `@sva/studio-ui-react` als Workspace-Dependency ergänzen
- [ ] 6.2 Lokale Button-/Input-/Layout-Klassen in `plugin-news` durch `@sva/studio-ui-react` ersetzen
- [ ] 6.3 Plugin-Custom-Views gegen Detail-, Formular-, State- und Action-Vorgaben testen
- [ ] 6.4 Referenzmuster für neue Plugins dokumentieren

## 7. Enforcement

- [ ] 7.1 Nx-Tags und `depConstraints` für `scope:studio-ui-react`, `scope:app` und `scope:plugin` ergänzen
- [ ] 7.2 ESLint-Regel oder CI-Check gegen Plugin-Imports aus `apps/sva-studio-react/src/**` ergänzen
- [ ] 7.3 CI-Check gegen lokale Basis-Control-Duplikate in `packages/plugin-*` ergänzen
- [ ] 7.4 `pnpm check:file-placement`, `pnpm test:types`, `pnpm test:unit` und `pnpm test:eslint` zielgerichtet ausführen
- [ ] 7.5 Vor PR nach Möglichkeit `pnpm test:pr` ausführen

## 8. Documentation

- [ ] 8.1 `docs/development/studio-uebersichts-und-detailseiten-standard.md` mit finalem Public-API-Stand abgleichen
- [ ] 8.2 `docs/development/studio-list-page-standard.md` auf `@sva/studio-ui-react` verweisen
- [ ] 8.3 Plugin-Entwicklungsleitfaden um `@sva/studio-ui-react`-Importregeln und Custom-View-Beispiele ergänzen
- [ ] 8.4 Doku-Links relativ zu `docs/` halten und `pnpm check:file-placement` ausführen

