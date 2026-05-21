# Change: Studio-Daten-, Formular- und Test-Foundations als Repo-Standard schärfen

## Why

Das Studio hat bereits einen starken Zod-/Nx-Unterbau, aber noch keinen verbindlichen repo-weiten Standard für formularzentrierte UI-Workflows und netzwerknahe Frontend-Tests. Dadurch entstehen leicht divergierende Formular- und Mocking-Muster zwischen Host und Plugins.

Zusätzlich fehlen für kritische Kernlogik systematische generative Tests sowie eine belastbare Governance, wann neue Standards verpflichtend, optional oder unzulässig abweichend sind. Das erhöht das Risiko, dass Randfälle in Validatoren, Guards und Transformationslogik erst spät auffallen und Migrationen inkonsistent verlaufen.

## What Changes

- `react-hook-form` und `@hookform/resolvers` werden als verbindlicher Default-Standard für neue oder grundlegend überarbeitete Studio-Formulare mit `zod`-basierter Validierung festgelegt.
- `msw` wird als verbindlicher Default-Standard für neue oder grundlegend überarbeitete HTTP-nahe Frontend-Unit- und Integrations-Tests festgelegt.
- `fast-check` wird für kritische, framework-agnostische Kernlogik als gezielt zu prüfender Property-based-Testing-Baustein festgelegt.
- Zulässige Ausnahmen werden für Formular-Foundations explizit auf unveränderte Legacy-Flows, sehr kleine Interaktionen ohne eigenständige Formularorchestrierung und dokumentierte Spezialfälle begrenzt; MSW-Ausnahmen bleiben davon getrennt auf nicht-HTTP-nahe Tests beschränkt.
- Eine vollständige Formular-Migrationsinventur für Host und Plugins wird als Pflichtartefakt des Changes verankert.
- Die Governance-, Review- und Exit-Mechanik wird in `review-governance` verankert, sodass Referenzpiloten den Standard validieren, aber keine optionale Pilot-Sonderzone begründen.
- Die betroffenen Spezifikationen präzisieren Architektur-, UI- und Testmuster für Host und Plugins als verbindliche Repo-Vorgabe.

## Impact

- Affected specs: `monorepo-structure`, `account-ui`, `content-management`, `review-governance`
- Affected code: `apps/sva-studio-react`, `packages/studio-ui-react`, `packages/plugin-*`, `packages/core`, `packages/routing`, `tooling/testing`, `scripts/ci`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`
- Required migration artifact: `docs/development/studio-form-migrationsinventur.md` als vollständige Formularinventur für Host und Plugins mit Pfad, Zweck, heutigem Muster, Validierung, Submit-Pfad, Primitiven, Teststand, RHF-Bedarf, `msw`-Bedarf, `fast-check`-Eignung, Priorität, Risiko, Legacy-Ausnahme und Zielzustand
- Required governance artifact: `docs/development/studio-foundations-governance.md` mit Review-Kriterien, Ausnahmeregeln, Referenzscope und Exit-Nachweisen
- Governance-Quelle: `review-governance` normiert Review-Gates, Ausnahmebehandlung und Exit-Bedingungen für diesen Change
- Required ADRs:
  - `ADR: Formular-Foundation mit react-hook-form und zodResolver`
  - `ADR: Frontend-Test-Foundation mit MSW und selektivem fast-check`
