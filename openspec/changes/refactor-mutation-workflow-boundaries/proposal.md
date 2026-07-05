# Change: Typsicheren Mutation-Workflow und harte Boundary-Gates einziehen

## Why

Die serverseitigen Mutationspfade duplizieren aktuell denselben Ablauf fuer Guards, Autorisierung, CSRF, Idempotency, Parsing, Ausfuehrung und Fehlermapping ueber mehrere Pakete. Diese Drift mischt Transportcode, Orchestrierung und Fachlogik, erschwert Reviews und unterlaeuft die Zielgrenzen zwischen `@sva/server-runtime`, `@sva/auth-runtime`, `@sva/iam-admin`, `@sva/instance-registry`, `@sva/sva-mainserver` und `apps/sva-studio-react`.

## What Changes

- fuehrt in `@sva/server-runtime` einen framework-agnostischen, typsicheren Mutation-Workflow fuer `prepare -> authorize -> csrf -> idempotency -> parse -> execute -> mapError -> respond` ein
- reduziert paketlokale Mutationshandler auf kleine Adapter ueber den gemeinsamen Workflow-Kern
- startet die Migration in `@sva/instance-registry` als kanonischen Referenzschnitt fuer scoped Mutationen
- haertet ESLint- und Fallow-Boundaries fuer App-, Integrations- und Serverpakete gegen interne `src`-Imports und unerwuenschte Transport-Handler-Abhaengigkeiten
- verankert den neuen Ownership-Schnitt in den Specs fuer Monorepo-Struktur, IAM-Server-Modularisierung und Mainserver-Integration

## Impact

- Affected specs: `monorepo-structure`, `iam-server-modularization`, `sva-mainserver-integration`
- Affected code: `packages/server-runtime`, `packages/instance-registry`, `eslint.config.mjs`, `.fallowrc.json`, Root-Skripte
