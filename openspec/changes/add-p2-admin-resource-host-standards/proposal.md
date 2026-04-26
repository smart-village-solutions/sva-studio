# Change: Host-Standards für Suche, Filter, Bulk-Actions und Revisionen im Admin definieren

## Why

Ein CMS-Admin skaliert schlecht, wenn jedes Fachpackage Suche, Filter, Bulk-Actions, Historie und Revisionen neu erfindet. Das Studio hat mit `AdminResourceDefinition`, generiertem Admin-Routing, `StudioDataTable`, Content-History und Activity-Logs bereits die passenden Anker, aber noch keinen deklarativen Vertrag für diese Querschnittsfähigkeiten. Das Studio braucht dafür hostseitige Standards, die von Packages nur konfiguriert und nicht jeweils neu gebaut werden.

Heute ist die Trennung unscharf: Ressourcen deklarieren Views und Guards, aber Listenverhalten, Search-Params, Filter-UI, Pagination, Bulk-Actions und History/Revision-Affordances entstehen in einzelnen Seiten oder Hooks. Dadurch werden neue Admin-Ressourcen teuer, die UX driftet auseinander, und ungültige Plugin-Deklarationen werden erst spät sichtbar.

## What Changes

- Definition kanonischer Host-Fähigkeiten für Suche, Filter, Bulk-Actions, Historie und Revisionen in Admin-Ressourcen
- Erweiterung des Admin-Ressourcenvertrags in `packages/plugin-sdk` um deklarative Capability-Konfigurationen für Listen- und Detailfähigkeiten
- Abbildung von Search, Filter, Sortierung und Pagination auf typisierte TanStack-Router-Search-Params statt rein lokaler Komponenten-State
- Klärung, welche Teile dieser Funktionen hostgeführt und welche pluginseitig konfigurierbar sind
- Vereinheitlichung der Erwartungen an Listen- und Detailseiten im Admin auf Basis der bestehenden `StudioDataTable`- und Admin-Route-Bausteine
- Vorbereitung wiederverwendbarer Standards für neue Content- und Verwaltungsressourcen
- Ausrichtung des Admin-Backbones auf CMS-typische Querschnittsfähigkeiten statt auf einzelne Sonderflächen
- Standardisierte Diagnostik für unzulässige oder vom Host nicht unterstützte Capability-Deklarationen
- Auditing-Erwartungen für hostgeführte Bulk-Actions, History-Zugriffe und Revision-Restores

## Host vs. Package Boundary

- Der Host besitzt Rendering, Search-Param-Normalisierung, Pagination-State, Auswahl-State, Bulk-Action-Orchestrierung, History/Revision-Affordances, Diagnostik und Audit-Hooks.
- Packages deklarieren nur unterstützte Fähigkeiten, Felder, Filteroptionen, Labels, erlaubte Actions und Datenadapter-/Binding-Referenzen.
- Packages dürfen keine alternativen Basis-Komponenten für Suche, Filter, Pagination oder Bulk-Selection einführen, solange die gewünschte Funktion durch den Host-Standard abbildbar ist.
- Fachlogik bleibt in den jeweiligen Packages oder Servermodulen: Datenabfrage, Mutation, Autorisierung und fachliche Validierung werden nicht in den UI-Host verschoben.

## Non-Goals

- Keine vollständige Ablösung aller bestehenden Admin-Seiten in einem Schritt.
- Keine neue Tabellenbibliothek; bestehende `StudioDataTable`-/TanStack-Table-Bausteine bleiben der UI-Anker.
- Keine generische Low-Code-Form-Engine für Create/Edit-Formulare.
- Keine Migration von Plugin-Routen außerhalb des Admin-Resource-Vertrags, außer wenn sie direkt für die Pilotressource notwendig ist.

## Migration Strategy

- Zuerst wird der Vertrag rückwärtskompatibel erweitert: bestehende Ressourcen ohne Capability-Deklaration behalten ihr aktuelles Verhalten.
- `content` dient als Pilotressource, weil dort lokale Search-/Filter-States, Content-History und Content-Access bereits sichtbar sind.
- Danach können `adminUsers` und weitere IAM-Ressourcen schrittweise auf deklarierte Host-Standards wechseln.
- Ungültige neue Capability-Deklarationen sollen im Registry-/Build-Time-Pfad fehlschlagen; Legacy-Ressourcen ohne Deklaration sollen nicht brechen.

## Impact

- Affected specs:
  - `account-ui`
  - `content-management`
  - `iam-auditing`
- Affected code:
  - `packages/plugin-sdk/src/admin-resources.ts`
  - `packages/plugin-sdk/src/plugins.ts`
  - `packages/plugin-sdk/src/build-time-registry.ts`
  - `apps/sva-studio-react/src/routes/admin`
  - `apps/sva-studio-react/src/routes/content`
  - `apps/sva-studio-react/src/components/StudioDataTable.tsx`
  - `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
  - `packages/routing/src/admin-resource-routes.ts`
  - `packages/routing/src/route-search.ts`
  - `packages/sdk`
  - `packages/auth-runtime`, `packages/iam-admin`, `packages/iam-governance` und `packages/instance-registry`
  - `packages/plugin-news`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
