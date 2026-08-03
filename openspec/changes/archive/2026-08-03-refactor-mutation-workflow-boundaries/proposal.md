# Change: Typsicheren Mutation-Workflow und harte Boundary-Gates einziehen

## Why

Die serverseitigen Mutationspfade duplizieren aktuell denselben Ablauf für Guards, CSRF, Autorisierung, Idempotency, Parsing, Ausführung und Fehlermapping über mehrere Pakete. Diese Drift mischt Transportcode, Orchestrierung und Fachlogik, erschwert Reviews und unterläuft die Zielgrenzen zwischen `@sva/server-runtime`, `@sva/auth-runtime`, `@sva/iam-admin`, `@sva/instance-registry`, `@sva/sva-mainserver` und `apps/sva-studio-react`.

## What Changes

- führt in `@sva/server-runtime` einen framework-agnostischen, typsicheren Mutation-Workflow für `prepare -> csrf -> authorize -> idempotency -> parse -> execute -> mapError -> respond` ein
- reduziert paketlokale Mutationshandler auf kleine Adapter über den gemeinsamen Workflow-Kern
- startet die Migration in `@sva/instance-registry` als kanonischen Referenzschnitt für scoped Mutationen
- härtet ESLint- und Fallow-Boundaries für App-, Integrations- und Serverpakete gegen interne `src`-Imports und unerwünschte Transport-Handler-Abhängigkeiten
- verankert den neuen Ownership-Schnitt in den Specs für Monorepo-Struktur, IAM-Server-Modularisierung und Mainserver-Integration

## Impact

- Affected specs: `monorepo-structure`, `iam-server-modularization`, `sva-mainserver-integration`
- Affected code: `packages/server-runtime`, `packages/instance-registry`, `eslint.config.mjs`, `.fallowrc.json`, Root-Skripte
