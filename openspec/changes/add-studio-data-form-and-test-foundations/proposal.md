# Change: Studio-Daten-, Formular- und Test-Foundations einführen

## Why

Das Studio hat bereits einen starken TanStack-/Zod-/Nx-Unterbau, aber noch keinen verbindlichen Standard für wiederverwendbaren Server-State, formularzentrierte UI-Workflows und netzwerknahe Frontend-Tests. Dadurch entstehen leicht divergierende Datenlade-, Mutations-, Formular- und Mocking-Muster zwischen Host und Plugins.

Zusätzlich fehlen für kritische Kernlogik systematische generative Tests. Das erhöht das Risiko, dass Randfälle in Validatoren, Guards und Transformationslogik erst spät auffallen.

## What Changes

- `@tanstack/react-query` wird als Standard für clientseitig wiederverwendeten Server-State, Mutationen und Invalidation im Studio eingeführt.
- `react-hook-form` und `@hookform/resolvers` werden als Standard für Studio-Formulare mit `zod`-basierter Validierung eingeführt.
- `msw` wird als verbindlicher HTTP-Level-Mocking-Standard für Frontend-Unit- und Integrations-Tests eingeführt.
- `fast-check` wird für kritische, framework-agnostische Kernlogik als Property-based-Testing-Baustein eingeführt.
- Die betroffenen Spezifikationen präzisieren Architektur-, UI- und Testmuster für Host und Plugins.

## Impact

- Affected specs: `monorepo-structure`, `account-ui`, `content-management`, `test-coverage-governance`
- Affected code: `apps/sva-studio-react`, `packages/studio-ui-react`, `packages/plugin-*`, `packages/core`, `packages/routing`, `packages/auth-runtime`, `tooling/testing`, `scripts/ci`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`
