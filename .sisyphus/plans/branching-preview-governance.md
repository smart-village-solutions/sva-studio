# Branching- und Preview-Governance ohne langlebigen Develop-Branch

## TL;DR

> **Quick Summary**: Wir stellen auf `Trunk + Stacked` um: `main` bleibt der einzige langlebige Integrationspfad, Zwischenstände laufen über kurze Feature-/Stack-Branches mit PR-basierten Preview-Umgebungen.
>
> **Deliverables**:
> - Verbindliche Branch- und PR-Governance (inkl. TTL, Stack-Tiefe, Merge-Gates)
> - Vergleichs- und Entscheidungsgrundlage `Vercel` vs. `Eigene Infrastruktur`
> - Rollout-Plan mit Pilot, Enforcement und Fallback
> - Agent-exekutierbare Verifikation (ohne menschliche Tests als Abnahmekriterium)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 Waves + Final Verification
> **Critical Path**: T1 -> T6 -> T11 -> T15 -> F1/F2/F3/F4

---

## Context

### Original Request
Strategie entwickeln, ob `develop` benötigt wird oder alternative Branch-Ebenen sinnvoller sind, um viele Zwischenstände eines eigenständig arbeitenden Entwicklers zu bündeln. Ziel ist, kein zentrales Staging-Flaschenhalsmodell aufzubauen, sondern pro Zwischenstand/PR eine eigene Staging-Umgebung zu haben.

### Interview Summary
**Key Discussions**:
- Zielmodell bestätigt: `Trunk + Stacked` statt dauerhaftem `develop`.
- Zwischenstände sollen reviewbar und lauffähig sein, idealerweise bereits im PR.
- Für Preview-Lösung sollen sowohl `Vercel` als auch `Eigene Infrastruktur` berücksichtigt und vergleichbar gemacht werden.

**Research Findings**:
- Branch- und Stack-Regeln existieren bereits in `DEVELOPMENT_RULES.md`.
- Branch-Namensregeln werden lokal über `.githooks/reference-transaction` erzwungen.
- CI-Gates existieren (`.github/workflows/test-coverage.yml`, `scripts/ci/coverage-gate.ts`).
- Preview-Target ist auf App-Ebene vorhanden (`apps/sva-studio-react/project.json`, `apps/sva-studio-react/package.json`).
- Es fehlt ein expliziter per-PR Preview-Deploy-Workflow und `/.github/CODEOWNERS`.

### Metis Review
**Identified Gaps** (addressed):
- Fehlende harte Grenzen für Stack-Tiefe/TTL -> wird als Governance-Kernregel geplant.
- Unklare Preview-Scope- und Kostenregeln -> wird als Lifecycle-Policy mit Budget-/TTL-Regeln geplant.
- Fehlende explizite Abnahmekriterien -> wird über agent-exekutierbare Checks pro Task gelöst.

---

## Work Objectives

### Core Objective
Ein belastbares, skalierbares Branch- und Integrationsmodell definieren, das parallele Entwicklung beschleunigt, große Integrations-Merges vermeidet und PR-basierte Preview-Umgebungen als Standard etabliert.

### Concrete Deliverables
- Aktualisierte Governance-Spezifikation für Branches, PRs und Merge-Flow.
- Vergleichsmatrix und Empfehlung für `Vercel` vs. `Eigene Infrastruktur`.
- Rollout-Plan inkl. Migrations- und Fallback-Pfad.
- Prüfkatalog mit konkreten Kommandos und erwarteten Ergebnissen.

### Definition of Done
- [ ] Governance dokumentiert, eindeutig und ohne offene Entscheidungslücken.
  - Muss eine explizite `IN Scope`- und `OUT Scope`-Liste enthalten, jeweils mit mindestens vier Punkten.
  - Muss die Invariante enthalten: `main` ist der einzige langlebige Integrationsbranch.
- [ ] Preview-Strategie enthält klare Trigger, TTL/Cleanup, Kosten- und Sicherheitsleitplanken.
  - Für jeden PR-Event (`opened`, `synchronize`, `closed`) ist genau ein Lifecycle-Schritt definiert.
  - Cleanup-Regel ist verpflichtend und enthält einen nachweisbaren Erfolgspfad sowie einen Failure-Pfad.
- [ ] Merge-/Review-Gates sind als durchsetzbare Checks spezifiziert.
  - Mindestanforderung: explizit benannte Required Checks und mindestens ein Required Review.
  - Bypass ist nur mit auditierbarer Ausnahmebegründung zulässig.
- [ ] Jede geplante Aufgabe enthält agent-exekutierbare QA-Szenarien (Happy + Failure).
  - Pro Aufgabe existieren genau zwei Szenarien mit Evidence-Pfad unter `.sisyphus/evidence/`.
  - Ein Task gilt ohne Evidence-Dateien als nicht abgeschlossen.

### Must Have
- **IN Scope (verbindlich):**
  - Kein dauerhafter `develop` als Sammelbranch; `develop` ist im Zielmodell nicht als Standard-Integrationspfad zulässig.
  - `main` bleibt der einzige langlebige Integrationsbranch für die laufende Integration.
  - Stacked-PR-Workflow ist Standard für abhängige Zwischenstände; PR-Target entspricht immer dem tatsächlichen Basisbranch.
  - PR-Preview ist Standard für jeden aktiven PR-Zwischenstand mit Lifecycle `opened/synchronize -> update`, `closed -> destroy`.
  - Vergleich von `Vercel` und `Eigene Infrastruktur` erfolgt mit gewichteter, nachvollziehbarer Entscheidungslogik.
- **Entscheidungsprinzipien (verbindlich):**
  - Durchsetzbarkeit vor Komfort: Regeln müssen per Check oder klarer Policy prüfbar sein.
  - Reproduzierbarkeit vor Einzelfallentscheidung: gleiche Eingabe führt zu gleicher Governance-Entscheidung.
  - Auditierbarkeit vor impliziter Teamabsprache: Ausnahmen benötigen explizite Dokumentation.

### Must NOT Have (Guardrails)
- **OUT Scope (ausgeschlossen):**
  - Kein Big-Bang-Integrationsbranch ohne TTL.
  - Kein dauerhafter Parallel-Integrationsbranch neben `main`.
  - Kein vollständiger CI/CD-Neubau außerhalb der Governance-Definition.
  - Keine Plattform-Festlegung auf `Vercel` oder `Eigene Infrastruktur` ohne Bewertungslogik.
- **Guardrails (verbindlich):**
  - Keine manuellen "User testet das später"-Abnahmen.
  - Keine Governance-Regel ohne messbares Akzeptanzkriterium.
  - Keine offene Entscheidungslücke in Must-Have- oder Must-NOT-Have-Bereichen.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - Verifikation wird vollständig durch Agenten ausgeführt.

### Test Decision
- **Infrastructure exists**: YES (CI-Workflows und Coverage-Gate sind vorhanden)
- **Automated tests**: Tests-after (Governance-Artefakte werden über Policy/Workflow-Checks validiert)
- **Framework**: GitHub Actions + `gh` API + bestehende Repo-Checks

### QA Policy
Jede Aufgabe enthält agent-exekutierbare Szenarien mit Evidence-Pfaden unter `.sisyphus/evidence/`.

- **Frontend/UI**: Nur falls Preview-UI verifiziert wird -> Playwright
- **CLI/TUI**: `interactive_bash` für reproduzierbare Kommandoausführung
- **API/Backend/Repo-Policy**: Bash + `gh api`, `pnpm`, `nx`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately - foundations, max parallel):
- T1 Governance-Baseline und Scope-Freeze
- T2 Branch-Taxonomie und Namenskonventionen finalisieren
- T3 Stack-Regeln (Tiefe, TTL, Rebase-Frequenz)
- T4 Merge-/Review-Gates modellieren
- T5 CODEOWNERS-Strategie festlegen

Wave 2 (After Wave 1 - preview strategy and controls):
- T6 Vergleichsmatrix Vercel vs Eigene Infrastruktur
- T7 Preview-Lifecycle-Policy (Create/Update/Destroy)
- T8 Kosten- und Kapazitätsleitplanken für Preview-Umgebungen
- T9 Security-/Compliance-Leitplanken für Preview-Secrets und Daten
- T10 Branch-Protection- und Merge-Queue-Policy

Wave 3 (After Wave 2 - rollout and codification):
- T11 Rollout-Plan in Phasen (Pilot -> Enforcement -> Standard)
- T12 Migrationspfad von bestehendem Flow auf Trunk+Stacked
- T13 Broken-Main-/Hotfix-SOP definieren
- T14 KPI- und Monitoring-Modell für Governance-Erfolg

Wave 4 (After Wave 3 - validation artifacts):
- T15 Agent-exekutierbaren Prüfkatalog erstellen
- T16 Evidence-Struktur und Abnahmeprotokoll definieren

Wave FINAL (After ALL tasks - independent parallel review):
- F1 Plan Compliance Audit (oracle)
- F2 Code/Policy Quality Review (unspecified-high)
- F3 Real QA Execution of all scenarios (unspecified-high)
- F4 Scope Fidelity Check (deep)

Critical Path: T1 -> T6 -> T11 -> T15 -> F1/F2/F3/F4
Parallel Speedup: ~65% gegenüber sequenzieller Abarbeitung
Max Concurrent: 5 (Wave 1/2)

### Dependency Matrix
- T1: None -> T6, T10, T11
- T2: None -> T12
- T3: None -> T11, T12
- T4: None -> T10, T13
- T5: None -> T10
- T6: T1 -> T7, T8, T9, T11
- T7: T6 -> T15
- T8: T6 -> T11, T15
- T9: T6 -> T13, T15
- T10: T1, T4, T5 -> T11, T15
- T11: T1, T3, T6, T8, T10 -> T14, T15, T16
- T12: T2, T3 -> T16
- T13: T4, T9 -> T16
- T14: T11 -> T16
- T15: T7, T8, T9, T10, T11 -> F1, F2, F3, F4
- T16: T11, T12, T13, T14 -> F1, F3, F4

### Agent Dispatch Summary
- Wave 1: 5 Tasks -> `deep` x4, `writing` x1
- Wave 2: 5 Tasks -> `deep` x4, `unspecified-high` x1
- Wave 3: 4 Tasks -> `writing` x2, `deep` x2
- Wave 4: 2 Tasks -> `deep` x1, `unspecified-high` x1
- Final: 4 Tasks -> `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

- [x] 1. Governance-Baseline und Scope-Freeze definieren

  **What to do**:
  - Endgültige Scope-Boundaries, Nicht-Ziele und Entscheidungsprinzipien dokumentieren.
  - Prüfkriterien für "kein dauerhafter develop" und "PR-Preview als Standard" verbindlich machen.

  **Must NOT do**:
  - Keine technischen Implementierungsdetails vorziehen.
  - Keine offenen Placeholder wie "wird später entschieden" belassen.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Strategische Grundsatzentscheidungen mit hohen Folgekosten.
  - **Skills**: [`monorepo-management`, `nx-workspace-patterns`]
    - `monorepo-management`: Governance muss auf Monorepo-Wirkung geprüft werden.
    - `nx-workspace-patterns`: Regeln müssen Nx- und affected-Workflows berücksichtigen.
  - **Skills Evaluated but Omitted**:
    - `github-actions-templates`: Für Baseline noch nicht nötig.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (mit T2, T3, T4, T5)
  - **Blocks**: T6, T10, T11
  - **Blocked By**: None

  **References**:
  - `DEVELOPMENT_RULES.md` - Enthält den aktuellen Branching-/PR-Referenzrahmen.
  - `.sisyphus/drafts/branching-strategie.md` - Enthält bestätigte Anforderungen aus dem Interview.

  **Acceptance Criteria**:
  - [ ] Scope-Definition enthält klare IN/OUT-Liste ohne offene Punkte.
  - [ ] Baseline benennt messbare Erfolgskriterien für das Zielmodell.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Scope baseline is complete
    Tool: Bash
    Preconditions: Plan file exists
    Steps:
      1. Read `.sisyphus/plans/branching-preview-governance.md`
      2. Verify sections `Must Have`, `Must NOT Have`, `Definition of Done` are present
      3. Assert no unresolved Entscheidungsmarker vorhanden sind
    Expected Result: All core guardrails are explicit
    Failure Indicators: Missing guardrails or unresolved placeholders
    Evidence: .sisyphus/evidence/task-1-scope-baseline.txt

  Scenario: Ambiguity detection
    Tool: Bash
    Preconditions: Same plan file
    Steps:
      1. Search for vage Formulierungen und unklare Policy-Sprache
      2. Assert each instance is either removed or converted to policy
    Expected Result: No policy-critical ambiguity remains in baseline
    Evidence: .sisyphus/evidence/task-1-ambiguity-check-error.txt
  ```

- [x] 2. Branch-Taxonomie und Namensmodell finalisieren

  **What to do**:
  - Endgültige Branch-Klassen definieren (`feature`, `fix`, `chore`, `stack`, ggf. `epic` mit TTL).
  - Abgleich mit bestehender Hook-Validierung und Dokumentationsregeln herstellen.

  **Must NOT do**:
  - Keine unbeschränkten Integrationsbranches ohne Zeitlimit.
  - Keine nicht validierbaren Namensmuster einführen.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Governance-Änderung wirkt auf alle Entwicklerpfade.
  - **Skills**: [`git-master`, `monorepo-management`]
    - `git-master`: Branch- und Merge-Modell mit sauberem Fluss.
    - `monorepo-management`: Konsistenz über mehrere Projekte.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Nicht relevant für Branching-Policy.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T12
  - **Blocked By**: None

  **References**:
  - `.githooks/reference-transaction` - Aktuelle branch_pattern-/prefix-Regeln.
  - `DEVELOPMENT_RULES.md` - Aktuelle Branch-Präfix- und Base-Branch-Regeln.

  **Acceptance Criteria**:
  - [ ] Branch-Klassen enthalten erlaubte und verbotene Muster.
  - [ ] TTL-Regel für `stack/` und `epic/` ist explizit dokumentiert.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Branch naming policy matches hook constraints
    Tool: Bash
    Preconditions: Policy draft updated
    Steps:
      1. Parse policy section for allowed prefixes
      2. Compare with `.githooks/reference-transaction` prefixes
      3. Assert mismatch list is empty or explicitly migration-marked
    Expected Result: Naming policy and enforcement are aligned
    Failure Indicators: Prefix drift without migration note
    Evidence: .sisyphus/evidence/task-2-prefix-alignment.txt

  Scenario: Invalid branch class blocked by policy
    Tool: Bash
    Preconditions: Branch class table exists
    Steps:
      1. Check policy for explicit disallowed examples
      2. Assert at least one invalid example per class category is documented
    Expected Result: Policy can reject malformed branches deterministically
    Evidence: .sisyphus/evidence/task-2-invalid-branch-error.txt
  ```

- [x] 3. Stack-Regeln (Tiefe, TTL, Rebase-Frequenz) festlegen

  **What to do**:
  - Maximal zulässige Stack-Tiefe definieren.
  - Verbindliche Rebase-/Sync-Frequenz und Stale-Policy festlegen.

  **Must NOT do**:
  - Keine unbegrenzte PR-Kettenlänge erlauben.
  - Keine Regeln ohne Durchsetzungsmechanismus.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Reduziert Integrationsrisiken in abhängigen PR-Ketten.
  - **Skills**: [`git-master`, `deployment-pipeline-design`]
    - `git-master`: Stacked-PR-Lebenszyklus.
    - `deployment-pipeline-design`: Regel muss CI-gesteuert überprüfbar sein.
  - **Skills Evaluated but Omitted**:
    - `secrets-management`: Für Stack-TTL nicht primär.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T11, T12
  - **Blocked By**: None

  **References**:
  - `DEVELOPMENT_RULES.md` - Enthält Stacked-Branch-Hinweise und Retargeting.
  - `.github/workflows/test-coverage.yml` - Dient als Basis für mögliche Stale/Queue-Automation.

  **Acceptance Criteria**:
  - [ ] Max Stack-Tiefe als Zahl definiert.
  - [ ] TTL und Rebase-SLA mit Eskalation bei Verstoß definiert.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Stack limits are explicit and machine-checkable
    Tool: Bash
    Preconditions: Stack policy section exists
    Steps:
      1. Locate `max depth`, `TTL`, `rebase cadence` entries
      2. Assert each has numeric value and owner/action on violation
    Expected Result: Rules are enforceable without interpretation
    Failure Indicators: Qualitative-only language
    Evidence: .sisyphus/evidence/task-3-stack-limits.txt

  Scenario: Missing rebase cadence fails policy quality
    Tool: Bash
    Preconditions: Policy draft available
    Steps:
      1. Remove/ignore rebase cadence in dry validation logic
      2. Assert validation marks policy incomplete
    Expected Result: Incomplete stack policy is rejected
    Evidence: .sisyphus/evidence/task-3-rebase-cadence-error.txt
  ```

- [x] 4. Merge- und Review-Gates als Standardmodell definieren

  **What to do**:
  - Pflicht-Checks, Mindest-Reviewanzahl, Merge-Methode und Merge-Queue-Einsatz definieren.
  - "Broken main"-Vorgehen als verpflichtende Betriebsregel ergänzen.

  **Must NOT do**:
  - Keine unspezifischen "grüne CI"-Aussagen ohne konkrete Job-Namen.
  - Keine ungeklärten Bypass-Regeln.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Fehlerhafte Gate-Definition bricht gesamtes Modell.
  - **Skills**: [`github-actions-templates`, `git-master`]
    - `github-actions-templates`: Abgleich mit realistischen Workflow-Gates.
    - `git-master`: Merge-Queue- und Review-Fidelity.
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: Nicht relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T10, T13
  - **Blocked By**: None

  **References**:
  - `.github/workflows/test-coverage.yml` - Bestehende Gate-Jobs und Trigger.
  - `docs/reports/PR_CHECKLIST.md` - Bereits etablierte Pflichtchecks.
  - `.github/workflows/pr-auto-assignment.yml` - Relevanz für Review-Automatisierung.

  **Acceptance Criteria**:
  - [ ] Gate-Matrix enthält explizite Required Checks.
  - [ ] Merge-Queue-Policy enthält Aktivierungskriterium und Fallback.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Gate matrix is complete
    Tool: Bash
    Preconditions: Gate section documented
    Steps:
      1. Validate list includes lint, unit, types, coverage und eine e2e-Regel mit expliziter Aktivierungsbedingung
      2. Validate review minimum and merge method are explicit
    Expected Result: Merge gate policy is fully testable
    Failure Indicators: Missing check names or review counts
    Evidence: .sisyphus/evidence/task-4-gate-matrix.txt

  Scenario: Broken-main SOP negative path
    Tool: Bash
    Preconditions: SOP section present
    Steps:
      1. Simulate failed required check state in policy validation
      2. Assert SOP defines owner, rollback action, and max response time
    Expected Result: Broken-main path is actionable
    Evidence: .sisyphus/evidence/task-4-broken-main-error.txt
  ```

- [ ] 5. CODEOWNERS-Strategie und Pfadverantwortung festlegen

  **What to do**:
  - Entscheiden, welche Verzeichnisse zwingende Owner-Reviews benötigen.
  - Mindestmodell für kritische Pfade (App, Core, CI, Security-relevante Ordner) definieren.

  **Must NOT do**:
  - Keine globale "alle reviewen alles"-Regel ohne Verantwortungsgrenzen.
  - Keine Owner-Lücken auf kritischen Pfaden.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Policy-Design und Team-Operating-Model.
  - **Skills**: [`git-master`, `monorepo-management`]
    - `git-master`: PR-Owner-Governance und Branch-Protection-Kopplung.
    - `monorepo-management`: Pfadverantwortung im Workspace.
  - **Skills Evaluated but Omitted**:
    - `tanstack-router-best-practices`: Nicht relevant für Review-Ownership.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T10
  - **Blocked By**: None

  **References**:
  - `.github/` - Zielort und bestehende PR-Automation.
  - `packages/` - Kritische Kernmodule für Ownership-Schnitt.
  - `apps/` - App-spezifische Verantwortungsgrenzen.

  **Acceptance Criteria**:
  - [ ] Ownership-Matrix benennt Owner je kritischem Pfad.
  - [ ] Review-Gates referenzieren diese Matrix explizit.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Ownership coverage is complete
    Tool: Bash
    Preconditions: CODEOWNERS policy draft exists
    Steps:
      1. Check that critical directories are mapped to owners
      2. Assert no critical path is uncovered
    Expected Result: Ownership is enforceable by path
    Failure Indicators: Unassigned critical directory
    Evidence: .sisyphus/evidence/task-5-ownership-coverage.txt

  Scenario: Missing owner for critical path triggers failure
    Tool: Bash
    Preconditions: Same draft
    Steps:
      1. Run policy validation without owner entry for CI path
      2. Assert validation fails
    Expected Result: Policy rejects incomplete ownership mapping
    Evidence: .sisyphus/evidence/task-5-owner-gap-error.txt
  ```

- [x] 6. Vergleichsmatrix Vercel vs Eigene Infrastruktur erstellen

  **What to do**:
  - Beide Optionen anhand gewichteter Kriterien vergleichen (Setup, DX, Isolation, Security, Kosten, Betrieb).
  - Klare Entscheidungssystematik formulieren, ohne finale Plattform hart festzulegen.

  **Must NOT do**:
  - Kein rein qualitatives "kommt drauf an" ohne Bewertungslogik.
  - Keine Vermischung von Plattformbewertung und Migrationsausführung.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Multi-Kriterien-Architekturentscheidung.
  - **Skills**: [`deployment-pipeline-design`, `secrets-management`]
    - `deployment-pipeline-design`: Lifecycle- und Deployment-Reifegradvergleich.
    - `secrets-management`: Sicherheits- und Secret-Handling-Bewertung.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Nicht entscheidend für Plattformgovernance.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (Start nach T1)
  - **Blocks**: T7, T8, T9, T11
  - **Blocked By**: T1

  **References**:
  - `apps/sva-studio-react/package.json` - Vorhandene Preview-Command-Basis.
  - `apps/sva-studio-react/project.json` - Nx Target-Struktur für Preview.
  - `docs/architecture/07-deployment-view.md` - Zielumgebungen und Deployment-Rahmen.

  **Acceptance Criteria**:
  - [ ] Matrix enthält Gewichtung pro Kriterium.
  - [ ] Entscheidungspfad enthält "wann Vercel" und "wann Eigene Infrastruktur".

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Comparison matrix is decision-ready
    Tool: Bash
    Preconditions: Matrix section created
    Steps:
      1. Verify criteria list includes cost, security, SLA, ops burden, setup speed
      2. Verify each criterion has a weight and score logic
    Expected Result: Matrix supports objective decision
    Failure Indicators: Missing weights or scoring method
    Evidence: .sisyphus/evidence/task-6-matrix-readiness.txt

  Scenario: Tie-case handling
    Tool: Bash
    Preconditions: Matrix completed
    Steps:
      1. Simulate equal weighted score scenario
      2. Assert tie-breaker rule exists (e.g., compliance first)
    Expected Result: Decision remains deterministic in edge case
    Evidence: .sisyphus/evidence/task-6-tie-breaker-error.txt
  ```

- [x] 7. Preview-Lifecycle-Policy (Create/Update/Destroy) definieren

  **What to do**:
  - Trigger für PR opened/synchronize/closed definieren.
  - Lebenszyklus-Events inklusive URL-Publishing, TTL, Cleanup dokumentieren.

  **Must NOT do**:
  - Kein Preview ohne automatische Entsorgung.
  - Keine undokumentierten Sonderwege pro Teammitglied.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Lifecycle-Design ist zentral für Stabilität und Kosten.
  - **Skills**: [`github-actions-templates`, `deployment-pipeline-design`]
    - `github-actions-templates`: Event-getriebene PR-Automation.
    - `deployment-pipeline-design`: Umgebungs-Lifecycle sauber modellieren.
  - **Skills Evaluated but Omitted**:
    - `wcag-audit-patterns`: Keine Relevanz für Deployment-Lifecycle.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (mit T8, T9, T10)
  - **Blocks**: T15
  - **Blocked By**: T6

  **References**:
  - `.github/workflows/` - Vorhandene Workflow-Muster.
  - `apps/sva-studio-react/project.json` - Preview-Target als technische Basis.

  **Acceptance Criteria**:
  - [ ] Für jeden PR-Event existiert genau ein Lifecycle-Schritt.
  - [ ] TTL- und Close-Cleanup-Regeln sind eindeutig.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: PR open creates preview path
    Tool: Bash
    Preconditions: Lifecycle policy documented
    Steps:
      1. Check policy for `opened` event handling
      2. Assert output includes preview URL publication in PR context
    Expected Result: Create flow is explicit and reproducible
    Failure Indicators: Missing URL publication or missing create step
    Evidence: .sisyphus/evidence/task-7-create-preview.txt

  Scenario: PR close destroys preview
    Tool: Bash
    Preconditions: Same policy
    Steps:
      1. Check policy for `closed` event destroy action
      2. Assert cleanup includes resources + metadata cleanup
    Expected Result: No zombie preview environments remain
    Evidence: .sisyphus/evidence/task-7-destroy-preview-error.txt
  ```

- [x] 8. Kosten- und Kapazitätsleitplanken für Previews festlegen

  **What to do**:
  - Concurrent-Preview-Limit, Inaktivitäts-Timeout und Budget-Cap definieren.
  - Regeln für priorisierte PRs und ggf. Label-basiertes Provisioning festlegen.

  **Must NOT do**:
  - Keine unbegrenzte Parallelität ohne Budgetkontrolle.
  - Keine nicht messbaren FinOps-Ziele.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: FinOps + Plattformbetrieb + Governance-Schnitt.
  - **Skills**: [`deployment-pipeline-design`, `monorepo-management`]
    - `deployment-pipeline-design`: Kapazitäts- und Queue-Steuerung.
    - `monorepo-management`: Einfluss auf viele parallele PRs im Monorepo.
  - **Skills Evaluated but Omitted**:
    - `tanstack-query-best-practices`: Keine Relevanz für FinOps-Richtlinien.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T11, T15
  - **Blocked By**: T6

  **References**:
  - `docs/staging/2026-02/staging-todos.md` - Bestehende operative Readiness-Perspektive.
  - `docs/architecture/07-deployment-view.md` - Umgebungsrahmen für Kapazitätsgrenzen.

  **Acceptance Criteria**:
  - [ ] Budget-Cap als messbarer Wert definiert.
  - [ ] Auto-Cleanup bei Inaktivität und PR-Close beschrieben.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Preview concurrency guardrail
    Tool: Bash
    Preconditions: Cost policy section exists
    Steps:
      1. Verify `max active previews` value exists
      2. Verify behavior for over-cap condition is defined
    Expected Result: System behavior under load is deterministic
    Failure Indicators: No over-cap handling
    Evidence: .sisyphus/evidence/task-8-concurrency-cap.txt

  Scenario: Idle preview cleanup failure path
    Tool: Bash
    Preconditions: Timeout policy exists
    Steps:
      1. Validate inactivity timeout is numeric and bounded
      2. Validate failure handling if cleanup job fails
    Expected Result: Zombie previews are prevented by retry/escalation rule
    Evidence: .sisyphus/evidence/task-8-idle-cleanup-error.txt
  ```

- [x] 9. Security- und Compliance-Leitplanken fuer Preview-Umgebungen definieren

  **What to do**:
  - Regeln fuer Secret-Handling, Zugriffsschutz, PII-Schutz und Datenquellen in Preview festlegen.
  - Plattformneutral formulieren, aber Unterschiede Vercel vs eigene Infrastruktur explizit benennen.

  **Must NOT do**:
  - Keine Produktivdaten ohne Sanitization in Preview erlauben.
  - Keine unklaren Verantwortlichkeiten bei Secret-Leaks.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Security-Risiko ist unternehmenskritisch.
  - **Skills**: [`secrets-management`, `deployment-pipeline-design`]
    - `secrets-management`: Kern fuer sichere Preview-Setups.
    - `deployment-pipeline-design`: Sicherheitsregeln in Lifecycle integrieren.
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: Nicht relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T13, T15
  - **Blocked By**: T6

  **References**:
  - `DEVELOPMENT_RULES.md` - Security/PII-Grundsaetze im Projektkontext.
  - `docs/architecture/07-deployment-view.md` - Umgebungstrennung und Sicherheitsbezug.

  **Acceptance Criteria**:
  - [ ] Secret- und Datenklassen sind eindeutig nach Umgebung geregelt.
  - [ ] Zugriff auf Preview-Umgebungen ist standardisiert (auth/policy).

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Secret handling policy completeness
    Tool: Bash
    Preconditions: Security section exists
    Steps:
      1. Verify rules for secret source, rotation, and scope are present
      2. Verify policy explicitly forbids hardcoded credentials
    Expected Result: Secret handling is auditable and enforceable
    Failure Indicators: Missing secret ownership or rotation rule
    Evidence: .sisyphus/evidence/task-9-secrets-policy.txt

  Scenario: PII leak prevention negative test
    Tool: Bash
    Preconditions: Data policy documented
    Steps:
      1. Validate preview data rules require sanitization/anonymization
      2. Validate violation response is defined
    Expected Result: PII leakage path is blocked by policy
    Evidence: .sisyphus/evidence/task-9-pii-error.txt
  ```

- [x] 10. Branch-Protection- und Merge-Queue-Policy finalisieren

  **What to do**:
  - Definieren, welche Branch-Protection-Regeln verpflichtend sind.
  - Merge-Queue Einfuehrung (sofort oder phasenweise) mit klaren Kriterien festlegen.

  **Must NOT do**:
  - Keine Regel ohne messbare Bedingung (z. B. "bei Bedarf").
  - Keine offenen Bypass-Rechte ohne Audit-Logik.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Schluessel fuer stabiles trunk-basiertes Modell.
  - **Skills**: [`github-actions-templates`, `git-master`]
    - `github-actions-templates`: Kompatible Workflow-/Check-Strategie.
    - `git-master`: Merge-Disziplin und Queue-Flow.
  - **Skills Evaluated but Omitted**:
    - `web-design-guidelines`: Nicht relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T11, T15
  - **Blocked By**: T1, T4, T5

  **References**:
  - `.github/workflows/test-coverage.yml` - Required-Check-Kandidaten.
  - `docs/reports/PR_CHECKLIST.md` - Bereits geforderte Check-Bausteine.

  **Acceptance Criteria**:
  - [ ] Pflicht-Checks und Required Reviews sind konkret benannt.
  - [ ] Queue-Policy definiert Aufnahmebedingungen und Fehlerbehandlung.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Branch protection rule set completeness
    Tool: Bash (gh api)
    Preconditions: Repo access configured
    Steps:
      1. Run `gh api repos/<org>/<repo>/branches/main/protection`
      2. Assert required checks and review count match policy
    Expected Result: Protection matches governance policy
    Failure Indicators: Missing required check/review guard
    Evidence: .sisyphus/evidence/task-10-branch-protection.json

  Scenario: Merge queue failure handling
    Tool: Bash
    Preconditions: Merge queue policy written
    Steps:
      1. Validate queue failure path for flaky/failed checks
      2. Assert retry/eject/escalation behavior is defined
    Expected Result: Queue deadlock risk is mitigated by policy
    Evidence: .sisyphus/evidence/task-10-merge-queue-error.txt
  ```

- [x] 11. Rollout-Plan (Pilot -> Enforcement -> Standard) erstellen

  **What to do**:
  - Phasen mit Eintritts-/Exit-Kriterien und Verantwortlichen definieren.
  - Risikoarme Einfuehrung fuer Team und Prozesse beschreiben.

  **Must NOT do**:
  - Keine sofortige harte Umstellung ohne Pilot.
  - Keine Phase ohne messbare Erfolgsmetrik.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Klare Operationalisierung der Umstellung.
  - **Skills**: [`monorepo-management`, `deployment-pipeline-design`]
    - `monorepo-management`: Breitenwirkung im Repository.
    - `deployment-pipeline-design`: Realistische Rollout-Gates.
  - **Skills Evaluated but Omitted**:
    - `playwright`: Nicht erforderlich fuer Governance-Rollout.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: T14, T15, T16
  - **Blocked By**: T1, T3, T6, T8, T10

  **References**:
  - `.sisyphus/drafts/branching-strategie.md` - Entscheidungsstand und Nutzerziele.
  - `docs/staging/2026-02/staging-todos.md` - Operative Reife als Vorbild fuer Stufenplan.

  **Acceptance Criteria**:
  - [ ] Jede Phase hat Owner, Terminlogik und Exit-Kriterium.
  - [ ] Fallback fuer gescheiterte Pilotphase ist beschrieben.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Rollout phase completeness
    Tool: Bash
    Preconditions: Rollout section written
    Steps:
      1. Verify phases Pilot, Transition, Enforcement exist
      2. Verify each phase has KPIs and rollback trigger
    Expected Result: Rollout is operationally executable
    Failure Indicators: Missing owner/KPI/rollback in any phase
    Evidence: .sisyphus/evidence/task-11-rollout-phases.txt

  Scenario: Pilot failure path
    Tool: Bash
    Preconditions: Same section
    Steps:
      1. Validate condition for halting rollout on quality regression
      2. Validate fallback path to previous branch policy
    Expected Result: Rollout can fail safely
    Evidence: .sisyphus/evidence/task-11-pilot-failure-error.txt
  ```

- [x] 12. Migrationspfad auf Trunk+Stacked definieren

  **What to do**:
  - Schrittfolge fuer Ablösung von develop-zentrierten Gewohnheiten dokumentieren.
  - Regeln fuer bestehende offene Branches/PRs waehrend der Umstellung festlegen.

  **Must NOT do**:
  - Keine Migration ohne Uebergangsregeln fuer laufende Arbeit.
  - Keine implizite Pflicht zur grossen Rebase-Aktion in einem Schritt.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Prozessmigration muss teamtauglich formuliert sein.
  - **Skills**: [`git-master`, `monorepo-management`]
    - `git-master`: Sichere Uebergangslogik fuer aktive Branches.
    - `monorepo-management`: Koordination ueber mehrere Packages/Teams.
  - **Skills Evaluated but Omitted**:
    - `context7`: Keine API-Dokumentation erforderlich.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (mit T13, T14)
  - **Blocks**: T16
  - **Blocked By**: T2, T3

  **References**:
  - `DEVELOPMENT_RULES.md` - Ist-Zustand fuer Branching-/PR-Prozess.
  - `.githooks/reference-transaction` - Enforcement-Sicht fuer Branchnamen.

  **Acceptance Criteria**:
  - [ ] Migration behandelt neue und bereits offene PRs getrennt.
  - [ ] Uebergangszeitraum und Endzustand sind explizit beschrieben.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Migration path covers open and new work
    Tool: Bash
    Preconditions: Migration section completed
    Steps:
      1. Validate branch handling rules for existing open PRs
      2. Validate branch rules for newly created work
    Expected Result: No workflow gap during transition
    Failure Indicators: One of both cases missing
    Evidence: .sisyphus/evidence/task-12-migration-coverage.txt

  Scenario: Transition deadline enforcement
    Tool: Bash
    Preconditions: Same section
    Steps:
      1. Check for explicit cutoff date/condition for old model
      2. Check for escalation if old model persists
    Expected Result: Migration has enforceable completion criteria
    Evidence: .sisyphus/evidence/task-12-cutover-error.txt
  ```

- [x] 13. Broken-Main- und Hotfix-SOP spezifizieren

  **What to do**:
  - Standardablauf bei rotem `main` definieren (Owner, Revert/Forward-Fix, Zeitgrenzen).
  - Hotfix-Flow definieren, der Trunk-Prinzipien nicht aushebelt.

  **Must NOT do**:
  - Keine unklaren Eskalationsketten.
  - Keine Hotfix-Ausnahmen ohne Auditability.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Betriebsstabilitaet und Incident-Faehigkeit.
  - **Skills**: [`git-master`, `deployment-pipeline-design`]
    - `git-master`: Revert-/Hotfix-Flow diszipliniert abbilden.
    - `deployment-pipeline-design`: Incident-Reaktion als Prozess.
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: Kein Bezug.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T16
  - **Blocked By**: T4, T9

  **References**:
  - `.github/workflows/test-coverage.yml` - Gate-Fehlerkontext fuer Incident-Pfade.
  - `docs/reports/PR_CHECKLIST.md` - Qualitaetsanforderungen als Grundlage fuer Revert-Entscheidung.

  **Acceptance Criteria**:
  - [ ] SOP nennt klare Reaktionszeit und Verantwortungsrolle.
  - [ ] Hotfix-Prozess ist mit Branch-Protection kompatibel beschrieben.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Broken main response path
    Tool: Bash
    Preconditions: SOP documented
    Steps:
      1. Validate runbook has detection -> owner -> mitigation -> verification chain
      2. Validate each step has max response time
    Expected Result: Incident response is deterministic
    Failure Indicators: Missing owner or timing budget
    Evidence: .sisyphus/evidence/task-13-broken-main-sop.txt

  Scenario: Hotfix auditability
    Tool: Bash
    Preconditions: Hotfix section present
    Steps:
      1. Verify hotfix bypass conditions are explicitly constrained
      2. Verify post-hotfix audit step is mandatory
    Expected Result: Emergency path remains traceable
    Evidence: .sisyphus/evidence/task-13-hotfix-audit-error.txt
  ```

- [x] 14. KPI- und Monitoring-Modell fuer Governance-Erfolg definieren

  **What to do**:
  - KPI-Set fuer Merge-Zeit, Konfliktrate, Queue-Stabilitaet, Preview-Kosten und Branch-Staleness festlegen.
  - Erhebungsrhythmus und Owner je KPI benennen.

  **Must NOT do**:
  - Keine KPIs ohne Messquelle.
  - Keine Metriken ohne Zielwert oder Grenzbereich.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Erfolgsmessung entscheidet ueber Governance-Akzeptanz.
  - **Skills**: [`deployment-pipeline-design`, `monorepo-management`]
    - `deployment-pipeline-design`: Betriebsmetriken auf Pipeline-/Deploy-Ebene.
    - `monorepo-management`: Teamweite Aussagekraft in Multi-Projekt-Kontext.
  - **Skills Evaluated but Omitted**:
    - `tanstack-start-best-practices`: Nicht relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T16
  - **Blocked By**: T11

  **References**:
  - `README.md` - Environment/Observability-Kontext.
  - `docs/development/monitoring-stack.md` - Monitoring-Perspektive als KPI-Grundlage.

  **Acceptance Criteria**:
  - [ ] Jeder KPI hat Definition, Zielwert und Messquelle.
  - [ ] Eskalationsschwellen fuer Fehlentwicklung sind festgelegt.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: KPI definition integrity
    Tool: Bash
    Preconditions: KPI section written
    Steps:
      1. Validate every KPI includes metric formula and source
      2. Validate every KPI has target and alert threshold
    Expected Result: KPI system is operationally usable
    Failure Indicators: KPI without target or source
    Evidence: .sisyphus/evidence/task-14-kpi-integrity.txt

  Scenario: Missing source negative test
    Tool: Bash
    Preconditions: Same section
    Steps:
      1. Simulate KPI entry without data source
      2. Assert validation flags entry invalid
    Expected Result: Non-measurable KPIs are rejected
    Evidence: .sisyphus/evidence/task-14-kpi-source-error.txt
  ```

- [x] 15. Agent-exekutierbaren Governance-Pruefkatalog erstellen

  **What to do**:
  - Konkrete Verifikationskommandos fuer Branch-Protection, Reviews, Checks und Preview-Lifecycle definieren.
  - Erwartete Pass/Fail-Ausgaben pro Check festlegen.

  **Must NOT do**:
  - Keine manuellen Abnahmeanweisungen ohne Tool-basierten Nachweis.
  - Keine generischen "verify works"-Formulierungen.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Uebersetzt Governance in pruefbare Automatismen.
  - **Skills**: [`git-master`, `github-actions-templates`, `webapp-testing`]
    - `git-master`: Git-/PR-bezogene Nachweise.
    - `github-actions-templates`: Workflow-/Statuscheck-Verifikation.
    - `webapp-testing`: Preview-Verhalten als lauffaehige Szenarien.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Nicht benoetigt.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: T7, T8, T9, T10, T11

  **References**:
  - `.github/workflows/test-coverage.yml` - Check-/Event-Validierung.
  - `scripts/ci/coverage-gate.ts` - Coverage-Gate-Verhalten.
  - `docs/reports/PR_CHECKLIST.md` - Pflichtcheck-Basis.

  **Acceptance Criteria**:
  - [ ] Pro Governance-Claim existiert mindestens ein Tool-basierter Check.
  - [ ] Jeder Check hat erwarteten Output und Failure-Interpretation.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Required check verification via GitHub API
    Tool: Bash (gh api)
    Preconditions: GitHub auth available
    Steps:
      1. Run `gh api repos/<org>/<repo>/branches/main/protection`
      2. Assert required status checks list matches policy
    Expected Result: Branch protection policy is objectively verified
    Failure Indicators: Diverging check lists
    Evidence: .sisyphus/evidence/task-15-required-checks.json

  Scenario: Preview lifecycle check failure path
    Tool: Bash
    Preconditions: Preview workflow policy defined
    Steps:
      1. Validate existence of open/sync/close lifecycle checks in policy
      2. Assert fallback exists when destroy action fails
    Expected Result: Lifecycle validation includes resilience path
    Evidence: .sisyphus/evidence/task-15-preview-lifecycle-error.txt
  ```

- [x] 16. Evidence-Struktur und Abnahmeprotokoll finalisieren

  **What to do**:
  - Standardisierte Evidence-Dateinamen und Ablagehierarchie definieren.
  - Regel fuer Task-Abschluss nur bei vorhandener Evidence festlegen.

  **Must NOT do**:
  - Keine Aufgaben als erledigt markieren ohne nachvollziehbare Evidence.
  - Keine inkonsistenten Dateibenennungen.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Qualitaets- und Audit-Schnitt ueber alle Tasks.
  - **Skills**: [`deployment-pipeline-design`, `monorepo-management`]
    - `deployment-pipeline-design`: Prozessuale Durchsetzbarkeit.
    - `monorepo-management`: Einheitliche Evidence-Regeln ueber alle Teilprojekte.
  - **Skills Evaluated but Omitted**:
    - `mcp-builder`: Nicht relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1, F3, F4
  - **Blocked By**: T11, T12, T13, T14

  **References**:
  - `.sisyphus/plans/branching-preview-governance.md` - Zielstruktur fuer Evidence-Bezug.
  - `.sisyphus/evidence/` - Geplanter Nachweisort.

  **Acceptance Criteria**:
  - [ ] Einheitliches Dateinamensschema fuer alle Szenarien definiert.
  - [ ] Abschlussregel `no evidence -> no done` ist explizit dokumentiert.

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: Evidence naming standard validation
    Tool: Bash
    Preconditions: Naming convention documented
    Steps:
      1. Validate required pattern `task-{N}-{scenario-slug}.{ext}`
      2. Validate extension guidance per artifact type
    Expected Result: Evidence naming is deterministic
    Failure Indicators: Ambiguous or conflicting naming rules
    Evidence: .sisyphus/evidence/task-16-evidence-naming.txt

  Scenario: Missing evidence blocks completion
    Tool: Bash
    Preconditions: Completion rule exists
    Steps:
      1. Simulate task marked done without evidence file
      2. Assert protocol rejects completion status
    Expected Result: Completion is strictly evidence-driven
    Evidence: .sisyphus/evidence/task-16-missing-evidence-error.txt
  ```

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** - `oracle`
  Prüfe jedes Must-Have/Must-NOT-Have gegen die finalen Artefakte und Evidence-Dateien.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [ ] F2. **Code Quality Review** - `unspecified-high`
  Prüfe Konsistenz, Nachvollziehbarkeit, fehlende Gate-Definitionen und unklare Formulierungen.
  Output: `Policy Quality [PASS/FAIL] | Ambiguities [N] | VERDICT`

- [ ] F3. **Real QA** - `unspecified-high`
  Führe alle QA-Szenarien aus dem Prüfkatalog aus und sammle Evidence.
  Output: `Scenarios [N/N] | Evidence [N files] | VERDICT`

- [ ] F4. **Scope Fidelity Check** - `deep`
  Stelle sicher, dass nur angeforderter Scope adressiert ist und keine unbeauftragten Erweiterungen enthalten sind.
  Output: `Scope [CLEAN/ISSUES] | Unaccounted [N] | VERDICT`

---

## Commit Strategy

- **1**: `docs(branching): define trunk-stacked governance baseline`
- **2**: `docs(preview): compare vercel and self-hosted preview models`
- **3**: `docs(rollout): add migration, SOP and verification pack`

---

## Success Criteria

### Verification Commands
```bash
gh api repos/<org>/<repo>/branches/main/protection
gh api repos/<org>/<repo>/pulls/<pr-number>/reviews
pnpm nx affected --target=test:unit
pnpm nx affected --target=test:types
pnpm nx affected --target=test:eslint
```

### Final Checklist
- [ ] Alle Must-Haves erfüllt
- [ ] Alle Must-NOT-Haves eingehalten
- [ ] Governance-Regeln sind durchsetzbar und auditierbar
- [ ] Preview-Entscheidungsgrundlage Vercel vs Eigene Infrastruktur ist vollständig
