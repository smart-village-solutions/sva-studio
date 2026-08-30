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
- Der konkrete Referenzscope wird dort ebenfalls explizit normiert: `/admin/users`, `/admin/roles` und der Host-Content-Flow als Referenzimplementierungen; `/account` nur unter der Default-Regel.
- Die betroffenen Spezifikationen präzisieren Architektur-, UI- und Testmuster für Host und Plugins als verbindliche Repo-Vorgabe.

## Reconciled Implementation State

Der Change wurde am 30. August 2026 gegen `origin/main` reconciliert. Die
Aufgabenliste stand formal bei 0/18, obwohl wesentliche Foundations bereits
produktiv vorhanden sind:

- ADR 043 und ADR 044 sind akzeptiert.
- Formularinventur und Foundation-Governance existieren.
- `@sva/studio-ui-react` stellt die Form-Bridge für Feldfehler und
  Summary-Fokus bereit.
- `tooling/testing` stellt das gemeinsame MSW-Setup einschließlich Node- und
  Browser-Einstieg, Handlern und Reset bereit.
- User-Create und Host-Content verwenden RHF mit `zodResolver` und besitzen
  MSW-basierte Referenztests.
- `admin-resource-search-params` und
  `waste-management-location-tour-pickup-date-import` besitzen erste
  `fast-check`-Properties.

Offen bleiben insbesondere die vollständige Inventur aller Plugin-Formulare,
die restlichen Admin-Referenzmigrationen einschließlich Rollen und User-Edit,
die vollständige Ablösung direkter HTTP-Stubs im Referenzscope sowie die
Properties für `route-search` und `input-readers`. Diese Restarbeiten sind ein
eigenständiger Foundation-Scope und kein pauschales Vorab-Gate für interne,
verhaltensneutrale Komponentenrefactors, die ihren äußeren Formular-,
Validierungs-, Submit- und HTTP-Vertrag unverändert lassen.

## Impact

- Affected specs: `monorepo-structure`, `account-ui`, `content-management`, `review-governance`
- Affected code: `apps/sva-studio-react`, `packages/studio-ui-react`, `packages/plugin-*`, `packages/core`, `packages/routing`, `tooling/testing`, `scripts/ci`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`
- Required migration artifact: `docs/development/studio-form-migrationsinventur.md` als vollständige Formularinventur für Host und Plugins mit Pfad, Zweck, heutigem Muster, Validierung, Submit-Pfad, Primitiven, Teststand, RHF-Bedarf, `msw`-Bedarf, `fast-check`-Eignung, Priorität, Risiko, Legacy-Ausnahme und Zielzustand
- Required governance artifact: `docs/development/studio-foundations-governance.md` mit Review-Kriterien, Ausnahmeregeln, Referenzscope und Exit-Nachweisen
- Governance-Zuordnung: `review-governance` normiert Review-/Exit-Mechanik für diesen Change, waehrend `monorepo-structure` die dafuer benoetigten Foundation- und Artefaktanforderungen beschreibt
- Required ADRs:
  - `ADR: Formular-Foundation mit react-hook-form und zodResolver`
  - `ADR: Frontend-Test-Foundation mit MSW und selektivem fast-check`
