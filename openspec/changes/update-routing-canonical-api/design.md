## Context

Die bisherige Routing-Architektur kombiniert einen kleinen file-based Anteil mit app-lokalen code-based Factories, serverseitigen Auth-Factories aus `@sva/routing` und einer separaten Plugin-Materialisierung im App-Router. Zusätzlich waren Demo-Routen Teil des regulären Route-Baums.

## Decisions

- Produktive Seitenrouten werden vollständig über `@sva/routing` bereitgestellt.
- Die App hält Seiten-Komponenten physisch lokal und injiziert sie über `appRouteBindings`.
- File-based Routing bleibt nur für `__root.tsx` und die TanStack-Start-Typintegration erhalten.
- Demo-Routen werden entfernt statt mitmigriert.
- Plugin-Routen werden zentral im Routing-Paket materialisiert.

## Risks / Trade-offs

- Der Refactor berührt viele Tests und Doku-Stellen gleichzeitig.
- Die App besitzt weiterhin eine Bindungsschicht für Seiten-Komponenten; das ist bewusst kein zweiter Routing-Quellort.
- `routeTree.gen.ts` bleibt technisch generiert, auch wenn es keine fachlichen Seitenrouten mehr trägt.
