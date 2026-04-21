# Change: Routing auf kanonische Paket-API vereinheitlichen

## Why

Das Routing-Wissen ist derzeit zwischen App, Routing-Package, Demo-Routen und Plugin-Materialisierung verteilt. Das erschwert Weiterentwicklung, Review und KI-gestützte Änderungen und führt zu mehreren konkurrierenden Wahrheiten über Pfade, Guards und Route-Komposition.

## What Changes

- `@sva/routing` wird zur einzigen öffentlichen Routing-Schnittstelle der Anwendung
- Produktive Seitenrouten werden vollständig code-based und zentral im Routing-Package definiert
- Die App liefert nur noch Root-Shell, Context-Wiring, Plugin-Liste und Seiten-Bindings
- Demo-Routen werden aus dem kanonischen Produkt-Routing entfernt
- Doku, OpenSpec und E2E-Smoke werden auf den neuen Zielzustand umgestellt

## Impact

- Affected specs: `routing`, `app-e2e-integration-testing`
- Affected code: `packages/routing/src/*`, `apps/sva-studio-react/src/router.tsx`, `apps/sva-studio-react/src/routing/app-route-bindings.tsx`, `apps/sva-studio-react/e2e/smoke.spec.ts`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
