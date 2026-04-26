# Change: Package-Zielarchitektur als harter Schnitt

## Why

Die aktuelle Package-Struktur bündelt zu viele fachlich unterschiedliche Verantwortlichkeiten in wenigen großen Packages, besonders in `@sva/auth`, `@sva/data` und `@sva/sdk`. Das erschwert Reviews, Tests, Ownership und sichere Weiterentwicklung von IAM-, Instanz-, Plugin- und Runtime-Funktionalität.

Der bestehende Zielarchitektur-Entwurf unter `docs/architecture/package-zielarchitektur.md` beschreibt die gewünschten Grenzen. Dieser Change macht daraus einen verbindlichen, harten Transition-Plan: neue Funktionalität soll nicht mehr in die alten Sammelbereiche wachsen, sondern in die Zielpackages geschnitten werden.

## What Changes

- **BREAKING**: Die Zielpackages `@sva/auth-runtime`, `@sva/iam-core`, `@sva/iam-admin`, `@sva/iam-governance`, `@sva/instance-registry`, `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/data-client` und `@sva/data-repositories` werden als verbindliche Package-Grenzen eingeführt.
- **BREAKING**: Alte Sammelimporte aus `@sva/auth`, `@sva/data` und `@sva/sdk` werden nach einer kurzen Umstellungsphase entfernt, nicht dauerhaft als Kompatibilitätsschicht erhalten.
- `@sva/iam-core` wird einziger Ort für zentrale Autorisierungsentscheidungen (`authorize()`); IAM-Fachpackages konsumieren diesen Vertrag.
- PII-Verarbeitung wird pro Package klassifiziert; nur explizit autorisierte Fachpackages dürfen personenbezogene Daten im Klartext verarbeiten.
- App und Plugins konsumieren Fachlogik nur über öffentliche Verträge oder Server-Funktionen; direkte Browser-Imports aus IAM-, Repository- oder Runtime-Implementierungen werden verboten.
- Nx-Tags, `depConstraints`, Package-Exports, ESM-Runtime-Checks und Test-Gates werden an den neuen Grenzen ausgerichtet.
- Architektur- und OpenSpec-Dokumentation werden zur verbindlichen Entscheidungsgrundlage für Folgechanges.

## Impact

- Affected specs: `monorepo-structure`, `iam-server-modularization`, `architecture-documentation`, `routing`
- Affected code: `packages/auth`, `packages/core`, `packages/data`, `packages/sdk`, `packages/routing`, `packages/sva-mainserver`, `packages/plugin-*`, `apps/sva-studio-react`, `nx.json`, `tsconfig.base.json`, `eslint.config.*`, Package-Exports und CI-Scripts
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`, `package-zielarchitektur.md`, `iam-service-architektur.md`, `iam-datenklassifizierung.md`
- Operational impact: CI wird strenger; alte Importpfade brechen bewusst, sobald die Migration abgeschlossen ist.
