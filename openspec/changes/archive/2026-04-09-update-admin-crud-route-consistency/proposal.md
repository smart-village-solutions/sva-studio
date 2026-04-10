# Change: CRUD-Routenmuster für Admin-Ressourcen vereinheitlichen

## Why
Die Studio-Admin-Oberfläche mischt aktuell seitenbasierte und modalbasierte CRUD-Flows. Das erschwert Deep Links, konsistente Navigation, Berechtigungsprüfung pro Zielroute und eine erwartbare UX.

## What Changes
- Führt für CRUD-artige Admin-Ressourcen das verbindliche Muster Liste, Neu und Detail unter eigener URL ein.
- Ersetzt modalbasierte Create/Edit-Flows für `users`, `organizations`, `groups` und `legal-texts` durch eigenständige Seiten.
- Ergänzt neue Guard- und Router-Einträge für `/new`- und `/$id`-Routen.
- Vereinheitlicht Listenaktionen auf Router-Navigation statt lokalem Dialog-State.

## Impact
- Affected specs: `account-ui`
- Affected code:
  - `apps/sva-studio-react/src/routes/-core-routes.tsx`
  - `apps/sva-studio-react/src/routes/admin/**`
  - `packages/routing/src/account-ui.routes.ts`
  - `apps/sva-studio-react/src/i18n/resources.ts`
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
