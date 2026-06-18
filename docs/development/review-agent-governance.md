# Review-Agent-Governance

## Ziel

Dieses Dokument beschreibt die Review-Governance für Proposal- und PR-Reviews mit spezialisierten Agents.

## Kanonischer PR-Intake

Fuer die lokale Diagnose eines aktiven Pull Requests ist `pnpm exec tsx scripts/ci/pr-review-intake.ts` der kanonische Einstieg.

- `snapshot` kombiniert PR-Metadaten, offene/resolved Review-Threads sowie failing/pending Checks in einem konsolidierten Snapshot.
- `threads` liefert den thread-aware Review-Stand gezielt fuer Abarbeitung offener Kommentare.
- `checks` liefert problematische GitHub-Checks inklusive Log-Aufloesung fuer failing Actions-Jobs.
- Explizites `--repo <owner/repo> --pr <nummer>` hat Vorrang vor lokaler Branch-Erkennung.
- Ohne explizite Parameter faellt der Intake auf die PR des aktuellen Branches zurueck.
- `gh auth status` wird genau einmal zu Beginn des CLI-Laufs geprueft.
- Externe GitHub-Plugin- oder Cache-Skills bleiben zulaessiger Fallback, sind fuer lokale PR-Diagnose aber nicht mehr der Primaerpfad.

Empfohlene Aufrufe:

- `pnpm exec tsx scripts/ci/pr-review-intake.ts snapshot --json`
- `pnpm exec tsx scripts/ci/pr-review-intake.ts snapshot --repo smart-village-solutions/sva-studio --pr 602 --json`
- `pnpm exec tsx scripts/ci/pr-review-intake.ts threads --repo smart-village-solutions/sva-studio --pr 602 --json`
- `pnpm exec tsx scripts/ci/pr-review-intake.ts checks --repo smart-village-solutions/sva-studio --pr 602 --json`

## Bot-Kommentar-Gate

Fuer Bot-Kommentare von `Copilot` und `chatgpt-codex-connector[bot]` gilt zusaetzlich ein blockierendes PR-Gate.

- Review-Threads auf Diffs gelten nur dann als bearbeitet, wenn ein Maintainer im selben Thread mit einem standardisierten Marker antwortet und der Thread anschliessend als resolved markiert ist.
- Normale PR-Konversationskommentare gelten nur dann als bearbeitet, wenn spaeter eine Maintainer-Antwort mit standardisiertem Marker und passender `bot-comment-id` existiert.
- Zulaessige Abschlusszustaende sind `accepted`, `rejected` und `resolved`.
- `rejected` und `resolved` brauchen eine kurze technische oder fachliche Begruendung; aus Governance-Sicht sollten aber alle Marker-Kommentare eine echte Antwort statt nur des Markers enthalten.

Verbindliche Marker:

- Review-Thread:
  `<!-- bot-comment-status: accepted -->`
- Review-Thread:
  `<!-- bot-comment-status: rejected -->`
- Review-Thread:
  `<!-- bot-comment-status: resolved -->`
- Normaler PR-Kommentar:
  `<!-- bot-comment-status: accepted; bot-comment-id: 123456789 -->`
- Normaler PR-Kommentar:
  `<!-- bot-comment-status: rejected; bot-comment-id: 123456789 -->`
- Normaler PR-Kommentar:
  `<!-- bot-comment-status: resolved; bot-comment-id: 123456789 -->`

Die maschinelle Auswertung laeuft ueber `pnpm check:bot-comment-handling` im Workflow `Bot Comment Governance` (`.github/workflows/bot-comment-governance.yml`).

## Agenten-Inventar

| Agent | Zweck | Primärer Einsatz |
|------|-------|------------------|
| `proposal-review-orchestrator.agent.md` | konsolidiert Proposal-Reviews | OpenSpec-Changes |
| `pr-review-orchestrator.agent.md` | konsolidiert PR-/Code-Reviews | normale PRs und Diffs |
| `architecture.agent.md` | Zielarchitektur, ADR-Bedarf, arc42-Fit | Architektur- und Systemänderungen |
| `code-quality-guardian.agent.md` | Korrektheit, Typen, Architekturgrenzen | Codeänderungen |
| `documentation.agent.md` | Doku-Abdeckung, Konsistenz, arc42 | jede PR / jedes Proposal |
| `test-quality.agent.md` | Tests, Coverage, Verifikationsstrategie | Verhaltensänderungen, Test-/Coverage-Themen |
| `security-privacy.agent.md` | Security, Privacy, Secrets, PII | Auth, Rollen, Tokens, Daten |
| `studio-test-operator.agent.md` | End-to-End-Studio-Tests mit Chrome MCP und Grafana MCP | manuelle Smoke-/Regressionstests, Staging-Abnahmen |
| `ux-accessibility.agent.md` | WCAG/BITV, Tastatur, Screenreader | UI und Navigation |
| `i18n-content.agent.md` | harte Strings, Key-Konventionen, Textklarheit | user-facing Texte |
| `user-journey-usability.agent.md` | Nutzersicht, Friktion, Flow-Verständlichkeit | UI-Flows, Formschritte |
| `operations-reliability.agent.md` | Betrieb, Runbooks, Monitoring | Infra, Deployments, Workflows |
| `interoperability-data.agent.md` | APIs, Standards, Datenmigration | Contracts, Exporte, Versionierung |
| `logging.agent.md` | strukturierte Logs, Audit, Korrelationsfelder | Server-Code, Fehlerpfade |
| `performance.agent.md` | Rendering, Caching, Hot Paths | Performance-sensitive Änderungen |
| `pr-fixer.agent.md` | Iterativer PR-Fix (Threads, Tests, Quality Gates) | PRs merge-bereit machen |
| `rollout-operator.agent.md` | Rollouts durchführen und verifizieren | Deployments, Image-Build, Quantum, Keycloak |

## Trigger-Matrix

### Proposal-Reviews

- Immer: `Documentation`
- Neue Architektur / Packages / strukturelle Entscheidungen: `Architecture`
- Neue Plugin-Standard-/Advanced-Path-Faehigkeit, neue plugin-oeffentliche Host-Vertraege oder Allowlist-Ausnahmen: `Architecture` + `Documentation` + `Code Quality`
- IAM, Rollen-Sync, ABAC/RBAC, Data-Subject-Rights oder andere sicherheitskritische Domänenlogik: `Architecture` + `Documentation` + `Security & Privacy`
- Auth, Sessions, Tokens, PII: `Security & Privacy`
- UI, Formulare, Navigation: `UX & Accessibility`
- Texte, Übersetzungen, Labels: `i18n & Content`
- UI-Flows, Erstnutzung, Fehlerzustände: `User Journey & Usability`
- neue Logik, Verhalten, Tests, Coverage-Auswirkungen: `Test Quality`
- Infra, Migrationen, Runbooks, Monitoring: `Operations`
- APIs, Datenformate, Standards: `Interoperability`
- Server-Code, Audit, Fehlerbehandlung: `Logging`
- Caching, Rendering, große Listen, Benchmarks, Hot Paths: `Performance`

### PR-Reviews

- Immer: `Documentation`
- Jede Codeänderung: `Code Quality`
- Verhaltensänderungen oder Coverage-/Test-Themen: `Test Quality`
- Aenderungen an `config/plugin-architecture-allowlist.json`, `docs/reports/plugin-architecture-boundary-baseline.md`, `scripts/ci/check-plugin-architecture-boundary.ts` oder plugin-oeffentlichen Host-Vertraegen: zusaetzlich `Architecture`
- Wiederholte rote Test-/Coverage-Checks im PR-Verlauf: `Test Quality` mit expliziter Shift-left-Prozessbewertung
- Relevante Bot-Kommentare von `Copilot` oder `chatgpt-codex-connector[bot]` muessen vor Merge einen gueltigen Bearbeitungsnachweis tragen
- IAM, Rollen-Sync, ABAC/RBAC, Data-Subject-Rights oder andere architekturrelevante Security-/Domain-Änderungen: zusätzlich `Architecture` und `Security & Privacy`
- weitere Fachreviewer trigger-basiert analog zu Proposal-Reviews

## Abgrenzungen

### UX & Accessibility vs User Journey & Usability

- `UX & Accessibility` bewertet normative Bedienbarkeit, Fokus, Tastatur, Semantik und WCAG/BITV.
- `User Journey & Usability` bewertet Aufgabenbewältigung, mentale Modelle, Reibung und Verständlichkeit.

### i18n & Content vs UX & Accessibility

- `i18n & Content` bewertet harte Strings, Key-Struktur, de/en-Abdeckung und Textklarheit.
- `UX & Accessibility` bewertet keine Übersetzungsvollständigkeit, sondern Bedienbarkeit und Normkonformität.

### Test Quality vs Code Quality

- `Code Quality` bewertet Korrektheit, Typen und Architektur.
- `Test Quality` bewertet ausschließlich die Verifikationsstrategie und die Aussagekraft der Tests.

### Performance vs Code Quality

- `Performance` bewertet messbare oder technisch klar herleitbare Laufzeit-/Render-/Cache-Risiken.
- `Code Quality` bleibt für allgemeine Robustheit und Architektur zuständig.

## Standard-Reihenfolge

1. Scope erfassen
2. Orchestrator auswählen
3. Pflichtreviewer aufrufen
4. zusätzliche Fachreviewer trigger-basiert ergänzen
5. Ergebnisse konsolidieren
6. Konflikte und offene Fragen explizit benennen

## Konfliktauflösung

- Fachreviewer liefern ihre Perspektive getrennt.
- Orchestratoren dürfen Konflikte zusammenführen und Entscheidungsoptionen formulieren.
- Die finale Entscheidung bleibt beim Menschen.

## Zusatzregeln fuer Plugin-Architektur

- "Vorerst im Plugin" oder "nur intern" ist keine ausreichende Begruendung fuer Core- oder Host-Kopplung.
- Jede temporaere Advanced-Path-Ausnahme braucht einen benannten Folgechange oder ein Sunset-Ziel.
- Allowlist-Eintraege muessen dem aktuellen JSON-Vertrag entsprechen: `plugin`, `sourceFile`, `importSpecifier`, `resolvedTarget`, `kind`, `reason` und optional `ticket`.
- Review-Metadaten wie Owner, Folgechange oder Abbauplanung koennen zusaetzlich in PR-, Ticket- oder Architekturkontext verlangt werden, sind aber kein Feld des aktuellen JSON-Vertrags.
- `pnpm check:plugin-architecture-boundary` laeuft im ersten Rollout warn-only fuer `packages/plugin-*`; Review behandelt neue Guard-Warnungen trotzdem als Architektur-Signal.
- Der Guard bewertet direkte, relative, Runtime-, Type- und Re-Export-Kanten; `@sva/plugin-sdk` und `@sva/studio-ui-react` bleiben die einzigen erlaubten internen Plugin-Einstiegspunkte.
- Die heutige Allowlist ist importkantenorientiert und ersetzt historische Baseline-Klassen wie Workspace-Dependencies oder Path-Signals nicht eins zu eins.

## Templates

- Fachreviewer nutzen dedizierte Templates unter `.github/agents/templates/`.
- Orchestratoren nutzen konsolidierte Report-Templates.

## Referenzen

- `AGENTS.md`
- `.github/agents/`
- `docs/architecture/README.md`
