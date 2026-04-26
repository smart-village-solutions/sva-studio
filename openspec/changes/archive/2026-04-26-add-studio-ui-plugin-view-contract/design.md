# Design: `@sva/studio-ui-react` als öffentliche React-UI-Basis

## Context

Die aktuelle Architektur trennt fachliche Kernlogik, Plugin-Metadaten und Host-Routing bereits über Zielpackages. Die UI liegt aber noch überwiegend in `apps/sva-studio-react`, während produktive Plugins eigene React-Views liefern können. Das Referenzplugin `@sva/plugin-news` definiert bereits eigene Klassen für Inputs und Buttons. Das ist ein frühes Drift-Signal.

Da kurzfristig mehrere Plugins mit eigenen Views erwartet werden, reicht ein rein host-rendered Metadatenmodell nicht aus. Das Studio braucht zusätzlich eine gemeinsame React-UI-Basis, die von App und Plugins importiert werden darf.

## Goals

- Einheitliche visuelle Sprache für Host- und Plugin-Seiten.
- Plugin-Custom-Views ermöglichen, ohne App-Interna zu importieren.
- shadcn/ui zentral kapseln und auf Studio-Konventionen normalisieren.
- Übersicht-, Detail-, Formular-, Tabellen- und State-Muster wiederverwendbar machen.
- Core- und Plugin-SDK-Grenzen nicht mit React-UI vermischen.

## Non-Goals

- Kein Runtime-Plugin-System.
- Keine Sandbox-Isolation für externe Plugins.
- Keine Verschiebung fachlicher Domänenlogik in `@sva/studio-ui-react`.
- Keine vollständige Form-DSL als Ersatz für Custom-Views.
- Keine Aufnahme von Plugin-Registry-, Routing- oder Guard-Logik in `@sva/studio-ui-react`.

## Package Boundary

`@sva/studio-ui-react` ist ein React-basiertes UI-Package mit shadcn/ui als technischer Basis. Der Name trägt die Framework-Bindung bewusst im Package-Namen, damit `@sva/core` und `@sva/plugin-sdk` framework-unabhängig bzw. framework-arm bleiben und der neutrale Name `@sva/studio-ui` für einen möglichen späteren UI-Vertrag ohne React-Bindung frei bleibt.

Das Package ist client-/browserorientiert und darf keine serverseitigen Runtime-Abhängigkeiten, DB-Zugriffe oder IAM-Fachlogik enthalten.

Erlaubte Abhängigkeiten:

- React und React-DOM als Peer Dependencies.
- shadcn/ui-Primitives bzw. deren lokale Source-Komponenten.
- Radix-/Lucide-/Tailwind-nahe UI-Abhängigkeiten, sofern sie bereits Bestandteil des Design-Systems sind oder explizit ergänzt werden.
- `@sva/plugin-sdk` nur für UI-nahe Typen oder i18n-Hilfen, falls notwendig und ohne zyklische Kopplung.

Nicht erlaubt:

- Runtime-Imports aus `apps/sva-studio-react`.
- Fachlogik aus `@sva/iam-*`, `@sva/auth-runtime`, `@sva/data-repositories` oder `@sva/instance-registry`.
- Server-Runtime-Imports.
- Eigene globale Theme- oder Shell-Verantwortung außerhalb der freigegebenen Tokens.

## Public API

Der erste öffentliche Umfang umfasst:

- Seiten-Templates:
  - `StudioOverviewPageTemplate`
  - `StudioDetailPageTemplate`
  - `StudioEditSurface`
- Struktur:
  - `StudioPageHeader`
  - `StudioResourceHeader`
  - `StudioSection`
  - `StudioDetailTabs`
  - `StudioActionMenu`
- States:
  - `StudioStateBlock`
  - `StudioLoadingState`
  - `StudioEmptyState`
  - `StudioErrorState`
  - `StudioForbiddenState`
  - `StudioNotFoundState`
- Form:
  - `StudioField`
  - `StudioFieldGroup`
  - `StudioFieldSet`
  - `StudioFormSummary`
  - shadcn-basierte Re-Exports oder Wrapper für `Input`, `Textarea`, `Select`, `Checkbox`, `Button`, `Badge`, `Dialog`, `Alert`, `Tabs`
- Listen:
  - `StudioDataTable`
  - Toolbar-, Pagination- und Bulk-Action-Bausteine

Spezialcontrols wie Rich-Text, Upload, Medienauswahl, Farbauswahl, Icon-Auswahl und Geo-Auswahl werden erst aufgenommen, wenn sie mindestens pluginübergreifend oder host/plugin-übergreifend benötigt werden.

## MVP Cut

Für den ersten Implementierungs-PR ist nicht der gesamte Public-API-Katalog verpflichtend. Der MVP muss die Boundary beweisen und einen realen Verbraucher migrieren:

- Package-Setup mit `@sva/studio-ui-react`, Nx-Targets, Path-Mapping, Package-Exports und Peer-Dependency-Grenzen.
- Basiscontrols: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Badge`, `Alert`, `Dialog`, `Tabs`.
- Struktur und States: `StudioPageHeader`, `StudioOverviewPageTemplate`, `StudioDetailPageTemplate`, `StudioField`, `StudioFieldGroup`, `StudioFormSummary`, `StudioStateBlock`, `StudioLoadingState`, `StudioEmptyState`, `StudioErrorState`.
- Eine Referenzmigration, bevorzugt `packages/plugin-news`, weil dort frühe lokale Button-/Input-/Layout-Drift sichtbar ist. Falls `plugin-news` durch parallele PRs blockiert ist, wird eine kleine Host-Übersichts- oder Detailfläche als Referenz genutzt.
- Boundary-Check gegen App-Internal-Imports aus Plugins.

Nicht im MVP enthalten sind vollständige Tabellenmigration, Bulk-Action-Kompositionen, Spezialcontrols, Storybook-/Showcase-Ausbau und flächendeckende Host-Migration. Diese folgen als separate Tasks oder Folgechanges.

## Host-Rendered Default

CRUD-artige Admin-Ressourcen bleiben bevorzugt host-rendered. Plugins deklarieren über `AdminResourceDefinition`, welche Views und Capabilities sie bereitstellen. Der Host rendert Navigation, Toolbar, Listenrahmen, Detailrahmen, Zustände und Aktionen aus den validierten Metadaten.

Dieser Standard verhindert, dass jedes Plugin Search, Filter, Bulk-Actions, Revisionen, Detailnavigation und Fehlerzustände selbst implementiert.

## Custom-View Escape Hatch

Plugin-Custom-Views sind zulässig, wenn die Fachoberfläche nicht sinnvoll deklarativ abbildbar ist. Beispiele:

- komplexe Rich-Text- oder Layout-Editoren
- Medienverwaltung
- Karten- oder Geo-Auswahl
- stark fachspezifische Freigabe- oder Prüfworkflows
- spezielle Vorschau- oder Simulationserlebnisse

Custom-Views müssen `@sva/studio-ui-react` für Seitenstruktur, Formularfelder, Aktionen, Zustände und Feedback verwenden. Direkte App-Komponentenimporte bleiben verboten.

## Enforcement

Der Change führt Boundary-Regeln ein:

- Plugins dürfen `@sva/plugin-sdk` und `@sva/studio-ui-react` als Workspace-Dependencies deklarieren.
- Plugins dürfen nicht aus `apps/sva-studio-react/src/**` importieren.
- Plugins dürfen keine lokalen Basiscontrols wie `Button`, `Input`, `Select`, `Tabs`, `Dialog`, `Table` als eigenes visuelles System einführen.
- App-interne shadcn/ui-Komponenten werden entweder nach `@sva/studio-ui-react` migriert oder nur noch als Übergangsadapter genutzt.
- `tsconfig.base.json`, Nx-Tags und ESLint-Dep-Constraints bilden die erlaubten Importkanten ab.

### Basis-Control-Duplikate

Verboten sind lokale, wiederverwendbare visuelle Basiscontrols in Plugins, wenn sie denselben Zweck wie freigegebene Studio-UI-Komponenten erfüllen. Dazu zählen insbesondere exportierte oder mehrfach verwendete Plugin-Komponenten mit Namen oder Rolle wie `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Tabs`, `Dialog`, `Alert`, `Badge`, `Table` oder `DataTable`.

Erlaubt bleiben fachliche Wrapper und domänenspezifische Kompositionen, wenn sie `@sva/studio-ui-react` intern verwenden und keine parallelen Tokens, Focus-/ARIA-Regeln oder Button-/Formular-Stile etablieren. Beispiele:

- erlaubt: `NewsStatusField`, das `StudioField`, `Select` und fachliche Optionen komponiert.
- erlaubt: `NewsPublishAction`, das `Button` und fachliche Mutation/Feedback-Logik kapselt.
- verboten: ein eigenes Plugin-`Button` mit abweichenden Varianten, Focus-Ring, Größen oder Farbsemantik.
- verboten: eine eigene Plugin-`DataTable`, solange die benötigte Listenstruktur mit `StudioDataTable` oder den freigegebenen Tabellenprimitives abbildbar ist.

Enforcement darf anfangs statisch über Importverbote, Nx-Dep-Constraints und gezielte `rg`-/ESLint-basierte Checks erfolgen. Review-Regeln decken Fälle ab, die statisch nicht zuverlässig erkennbar sind.

## Migration Strategy

1. `@sva/studio-ui-react` mit Nx-Generator als Library anlegen.
2. MVP-Controls und Studio-Primitives bereitstellen.
3. Einen Referenzverbraucher migrieren und daraus fehlende Props/Accessibility-Anforderungen ableiten.
4. Boundary-Regel gegen Plugin-Imports aus `apps/sva-studio-react/src/**` verbindlich machen.
5. App-interne shadcn/ui-Source-Komponenten schrittweise in das Package verschieben oder dort neu exportieren.
6. Tabellen-, Toolbar-, Bulk-Action- und Spezialeditor-Primitives nur aufnehmen, wenn Host oder mindestens ein Plugin sie konkret benötigt.
7. Weitere Plugins nur noch mit `@sva/studio-ui-react`-Custom-Views zulassen.

## Risks

- `@sva/studio-ui-react` kann zu groß werden, wenn fachliche Speziallogik hineingezogen wird.
- Re-Exports von shadcn/ui können zu instabil werden, wenn upstream-Komponenten stark angepasst werden.
- Zu viele freie Custom-Views können trotz gemeinsamer Komponenten zu UX-Drift führen.
- Paketmigration kann kurzfristig viele Imports und Tests berühren.

Mitigation:

- Public API klein halten.
- Fachliche Speziallogik im Plugin lassen; nur generische UI-Kompositionen in `@sva/studio-ui-react`.
- Story-/Showcase-Seite und visuelle Review-Gates für neue Studio-Komponenten.
- Boundary-Regeln und Review-Checklisten erzwingen.
