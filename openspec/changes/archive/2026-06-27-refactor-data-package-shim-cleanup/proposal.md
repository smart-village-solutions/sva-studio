# Change: Refactor data package shim cleanup

## Why
`@sva/data` und `@sva/data-repositories` tragen weiterhin überlappende Persistenzverantwortung. Die Doppelpflege erzeugt Duplication, unklare Ownership und widerspricht der dokumentierten Zielarchitektur.

## What Changes
- `@sva/data-repositories` wird als einzige führende Repository-Schicht festgezogen.
- `@sva/data` wird auf Migrationen, Seeds, DB-Skripte/-Operationen und dokumentierte Kompatibilitäts-Re-Exports bzw. Delegation begrenzt.
- Gedoppelte Implementierungen und breite Spiegeltests in `packages/data/src/**` werden entfernt oder in Shims überführt.
- Guardrails verhindern neue fachliche Ownership in `@sva/data`.

## Impact
- Affected specs: `architecture-documentation`, `monorepo-structure`
- Affected code: `packages/data`, `packages/data-repositories`, `docs/architecture/*`, `tooling/testing` (falls Guardrail-Tests zentralisiert werden)
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`
