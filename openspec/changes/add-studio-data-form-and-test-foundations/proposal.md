# Change: Studio-Daten-, Formular- und Test-Foundations als Repo-Standard schärfen

## Why

Das Studio hat bereits einen starken Zod-/Nx-Unterbau, aber noch keinen verbindlichen repo-weiten Standard für formularzentrierte UI-Workflows und netzwerknahe Frontend-Tests. Dadurch entstehen leicht divergierende Formular- und Mocking-Muster zwischen Host und Plugins.

Zusätzlich fehlen für kritische Kernlogik systematische generative Tests sowie eine belastbare Governance, wann neue Standards verpflichtend, optional oder unzulässig abweichend sind. Das erhöht das Risiko, dass Randfälle in Validatoren, Guards und Transformationslogik erst spät auffallen und Migrationen inkonsistent verlaufen.

## What Changes

- `react-hook-form` und `@hookform/resolvers` werden als verbindlicher Default-Standard für neue oder grundlegend überarbeitete Studio-Formulare mit `zod`-basierter Validierung festgelegt.
- `msw` wird als verbindlicher Default-Standard für neue oder grundlegend überarbeitete HTTP-nahe Frontend-Unit- und Integrations-Tests festgelegt.
- `fast-check` wird für kritische, framework-agnostische Kernlogik als gezielt zu prüfender Property-based-Testing-Baustein festgelegt.
- Zulässige Ausnahmen werden explizit auf rein lokale Logik ohne HTTP-Bezug, unveränderte Legacy-Flows und dokumentierte Spezialfälle begrenzt.
- Eine vollständige Formular-Migrationsinventur für Host und Plugins wird als Pflichtartefakt des Changes verankert.
- Governance-, Review- und Exit-Kriterien werden so verschärft, dass Referenzpiloten den Standard validieren, aber keine optionale Pilot-Sonderzone begründen.
- Die betroffenen Spezifikationen präzisieren Architektur-, UI- und Testmuster für Host und Plugins als verbindliche Repo-Vorgabe.

## Impact

- Affected specs: `monorepo-structure`, `account-ui`, `content-management`, `test-coverage-governance`
- Affected code: `apps/sva-studio-react`, `packages/studio-ui-react`, `packages/plugin-*`, `packages/core`, `packages/routing`, `tooling/testing`, `scripts/ci`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`
- Required migration artifact: vollständige Formularinventur für Host und Plugins mit Ausnahmen, Prioritäten und Zielzustand
- Required review gates:
  - verpflichtende Prüfung, ob neue oder grundlegend überarbeitete Formular-Flows den RHF-/Resolver-Standard einhalten
  - verpflichtende Prüfung, ob HTTP-nahe Frontend-Tests `msw` statt Implementierungsdetail-Stubs verwenden
  - verpflichtende Begründung pro oder contra `fast-check` für kritische Kernlogik-Hotspots
- Required ADRs:
  - `ADR: Formular-Foundation mit react-hook-form und zodResolver`
  - `ADR: Frontend-Test-Foundation mit MSW und selektivem fast-check`
