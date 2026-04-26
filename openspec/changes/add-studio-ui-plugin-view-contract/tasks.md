## 1. Specification

- [ ] 1.1 OpenSpec-Deltas für `account-ui`, `monorepo-structure`, `architecture-documentation` und `routing` finalisieren
- [ ] 1.2 Wechselwirkung mit `refactor-p3-content-ui-specialization-boundaries` und `add-p2-admin-resource-host-standards` prüfen
- [x] 1.3 MVP-Scope, Basis-Control-Duplikat-Regeln und Umsetzungsreihenfolge dokumentieren
- [x] 1.4 `pnpm openspec validate add-studio-ui-plugin-view-contract --strict` ausführen

## 2. Architecture Documentation

- [x] 2.1 `docs/architecture/package-zielarchitektur.md` um `@sva/studio-ui-react` als Zielpackage ergänzen
- [ ] 2.2 `docs/architecture/04-solution-strategy.md` um UI-Boundary und Plugin-Custom-View-Regel ergänzen
- [ ] 2.3 `docs/architecture/05-building-block-view.md` um Baustein `packages/studio-ui-react` ergänzen
- [ ] 2.4 `docs/architecture/06-runtime-view.md` um Laufzeitfluss für Plugin-Custom-Views mit `@sva/studio-ui-react` ergänzen
- [ ] 2.5 `docs/architecture/08-cross-cutting-concepts.md` um Design-Tokens, shadcn-Kapselung und UI-Boundary ergänzen
- [ ] 2.6 `docs/architecture/10-quality-requirements.md` und `11-risks-and-technical-debt.md` um UI-Drift- und Boundary-Risiken ergänzen

## 3. Package Setup

- [x] 3.1 `packages/studio-ui-react` als Nx-Library mit Importpfad `@sva/studio-ui-react` anlegen
- [x] 3.2 `package.json`, `project.json`, `tsconfig` und Path-Mapping für `@sva/studio-ui-react` konfigurieren
- [x] 3.3 React, React-DOM und UI-Primitive als Peer-/Dependency-Grenzen sauber deklarieren
- [x] 3.4 Build-, Unit-Test-, Type-Test- und Lint-Targets in Nx integrieren

## 4. MVP UI Components

- [x] 4.1 shadcn/ui-Basiscontrols für Button, Input, Textarea, Select, Checkbox, Badge, Alert, Dialog, AlertDialog und Tabs in `@sva/studio-ui-react` bereitstellen
- [x] 4.2 `StudioPageHeader`, `StudioOverviewPageTemplate` und `StudioDetailPageTemplate` implementieren
- [x] 4.3 `StudioField`, `StudioFieldGroup` und `StudioFormSummary` für konsistente Formulare implementieren
- [x] 4.4 `StudioStateBlock` und spezifische Loading-, Empty- und Error-States implementieren
- [x] 4.5 Accessibility-Verhalten für Label-/Description-/Error-Verknüpfung und `aria-invalid` testen

## 5. Reference Migration

- [x] 5.1 Einen Referenzverbraucher migrieren, bevorzugt `packages/plugin-news`, alternativ eine kleine Host-Übersichts- oder Detailfläche
- [x] 5.2 Lokale Button-/Input-/Layout-Klassen des Referenzverbrauchers durch `@sva/studio-ui-react` ersetzen
- [x] 5.3 Referenzverbraucher gegen Detail-, Formular-, State-, i18n- und Accessibility-Vorgaben testen
- [ ] 5.4 App-interne Komponenten nur als Übergangsadapter behalten oder entfernen, soweit sie im Referenzpfad betroffen sind

## 6. Follow-up UI Surface

- [x] 6.1 `StudioResourceHeader`, `StudioDetailTabs`, `StudioSection`, `StudioEditSurface` und `StudioActionMenu` nach Bedarf ergänzen
- [x] 6.2 `StudioDataTable` oder Tabellen-/Listenbasis erst nach konkretem Host- oder Plugin-Bedarf in `@sva/studio-ui-react` bereitstellen
- [x] 6.3 Toolbar-, Pagination- und Bulk-Action-Bausteine mit `add-p2-admin-resource-host-standards` abstimmen
- [ ] 6.4 Spezialcontrols wie Rich-Text, Upload, Medienauswahl, Farbe, Icon und Geo-Auswahl nur bei pluginübergreifendem Bedarf aufnehmen

## 7. Enforcement

- [x] 7.1 Nx-Tags und `depConstraints` für `scope:studio-ui-react`, `scope:app` und `scope:plugin` ergänzen
- [x] 7.2 ESLint-Regel oder CI-Check gegen Plugin-Imports aus `apps/sva-studio-react/src/**` ergänzen
- [ ] 7.3 CI-Check gegen lokale Basis-Control-Duplikate in `packages/plugin-*` ergänzen
- [x] 7.4 Erlaubte fachliche Wrapper dokumentieren und Review-Regeln für statisch schwer erkennbare UI-Duplikate ergänzen
- [ ] 7.5 `pnpm check:file-placement`, `pnpm test:types`, `pnpm test:unit` und `pnpm test:eslint` zielgerichtet ausführen
- [ ] 7.6 Vor PR nach Möglichkeit `pnpm test:pr` ausführen

## 8. Documentation

- [x] 8.1 `docs/development/studio-uebersichts-und-detailseiten-standard.md` mit finalem Public-API-Stand abgleichen
- [x] 8.2 `docs/development/studio-list-page-standard.md` auf `@sva/studio-ui-react` verweisen
- [ ] 8.3 Plugin-Entwicklungsleitfaden um `@sva/studio-ui-react`-Importregeln und Custom-View-Beispiele ergänzen
- [x] 8.4 Doku-Links relativ zu `docs/` halten und `pnpm check:file-placement` ausführen
