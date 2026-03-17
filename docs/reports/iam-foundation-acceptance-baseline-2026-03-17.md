# Verifikationsbericht: IAM Foundation Acceptance Baseline

## Kontext

Dieser Bericht dokumentiert den initialen Implementierungsstand des Changes `update-iam-foundation-acceptance-hardening`. Er belegt die eingeführten Runner-, Workflow- und Dokumentationsartefakte. Ein echter Acceptance-Lauf gegen die vereinbarte Testumgebung war in dieser Implementierungssitzung nicht möglich, weil keine gültigen Runtime-Secrets für Keycloak und die Zielumgebung bereitstanden.

## Ausgeführte Prüfungen

### Script- und Vertragsprüfung

- `node --test --import tsx scripts/ci/iam-acceptance.test.ts`
  - Ergebnis: grün
  - Fokus: Pflicht-Env, Defaulting, Berichtszusammenfassung und Markdown-Rendering
- `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
  - Ergebnis: grün
  - Fokus: Acceptance-Runner, Report-Helper und bestehende Script-Checks

### Beobachtete Repository-Blocker außerhalb dieses Changes

- `pnpm test:types`
  - Ergebnis: rot
  - Ursache: bestehender Fehler in `packages/routing/src/auth.routes.server.test.ts`
- `pnpm nx run sva-studio-react:typecheck`
  - Ergebnis: rot
  - Ursache: bestehende Fehler in `apps/sva-studio-react/src/routes/-core-routes.test.tsx`

## Gelieferte Artefakte

- Neuer Acceptance-Runner unter `scripts/ci/run-iam-acceptance.ts`
- Typisierte Helper für Env-/Report-Vertrag unter `scripts/ci/iam-acceptance.ts`
- Separater Nx-/Root-Vertrag:
  - `pnpm nx run sva-studio-react:test:acceptance`
  - `pnpm test:acceptance:iam`
- Separater GitHub-Workflow:
  - `.github/workflows/iam-acceptance.yml`
- Runbook für Setup, Testdatenkontrakt und Failure-Codes:
  - `docs/guides/iam-acceptance-runbook.md`

## Einschränkungen

- Der echte Acceptance-Lauf gegen Keycloak, Redis und Datenbank wurde in dieser Sitzung nicht ausgeführt.
- Die roten Type-Checks stammen aus bereits vorhandenen Testdateien außerhalb des neuen Acceptance-Pfads und blockieren aktuell den globalen Type-Status.
