# Change: Staging-Promote um gehärtete One-shot-Jobs erweitern

## Why

PR #676 hat mit `Promote` bereits einen gemeinsamen, imagegebundenen Deploymentvertrag für `dev`, `staging` und `prod` geschaffen. Für erkannte Schema- oder Bootstrap-Risiken blockiert der Workflow derzeit absichtlich: Der vorhandene One-shot-Executor aus dem Runtime-Operatorpfad ist noch nicht in GitHub Actions verdrahtet. Dadurch ist ein sicherer, nachvollziehbarer Staging-Rollout mit diesen Änderungen nicht möglich, obwohl die technischen Job-Bausteine bereits existieren.

## What Changes

- `Promote` bleibt der einzige GitHub-Actions-Deploymentworkflow; es wird kein zweiter Workflow und kein neuer lokaler Standardbedienpfad eingeführt.
- Für `staging` führt `migration_mode=run` einen gehärteten temporären Migrations-Stack aus; ein angeforderter Bootstrap läuft danach ausschließlich bei erfolgreicher Migration.
- Die vorhandenen Executor-Bausteine `scripts/ops/runtime/migration-job.ts` und `scripts/ops/runtime/bootstrap-job.ts` erhalten einen CI-tauglichen Einstieg. Die bisher inline implementierte Dev-Bootstrap-Ausführung verwendet denselben Einstieg.
- Der Staging-Ablauf löst die zulässige Image-Eingabe zu einem Digest auf, prüft dessen OCI-Revision gegen den validierten Git-Head und bindet diesen Nachweis mit dem gerenderten Job-Stack zusammen. Er erzwingt die Reihenfolge: Preflight → Migration → optional Bootstrap → Postconditions → App-Deploy → interne und externe Verifikation.
- Der Workflow erhält `maintenance_window`. Für Staging-Migrationen mit `run` ist ein nicht-sensitiver, revisionsfähiger Wartungsfenster-Verweis Pflicht.
- `promote-deploy-gates.ts` gibt `run` nur frei, wenn der jeweils angeforderte Executor tatsächlich im Workflow verdrahtet ist. Production bleibt für beide `run`-Modi fail-closed.
- Der automatische `main`-Promote für `dev` verwendet den neuen Modus `auto`: Er führt Migration oder Bootstrap nur bei erkanntem Änderungsrisiko aus und rollt die App ausschließlich nach erfolgreichen benötigten One-shot-Jobs aus.
- Der Workflow erfasst redigierte Job-Evidenz, Preflight- und Postflight-Ergebnisse, Cleanup sowie den vor dem App-Deploy tatsächlich laufenden App-Digest als Rollback-Hinweis.
- Das GitHub-Environment `staging` wird als externe Merge-Voraussetzung mit Required Reviewers geschützt; mutierende Credentials liegen ausschließlich dort.
- Bei Fehlschlag einer Migration, eines Bootstrap-Jobs, einer Postcondition oder einer Verifikation wird der App-Deploy nicht fortgesetzt. Für diesen Change wird kein automatisches DB-Rollback eingeführt.

## Non-Goals

- Keine erneute Einführung oder Ablösung der mit PR #676 etablierten Deploymenttopologie.
- Kein Production-`run` für Migration oder Bootstrap und keine Änderung am bestehenden Production-App-only-Pfad.
- Kein automatisches Datenbank-Rollback und keine Unterstützung destruktiver oder nicht rückwärtskompatibler Migrationen ohne separaten Restore-Plan.
- Kein neuer lokaler Quantum-Bedienpfad; der lokale Operatorpfad bleibt Diagnose- und Recovery-Werkzeug.

## Impact

- Affected specs: `deployment-topology`, `architecture-documentation`
- Affected code: `.github/workflows/promote.yml`, `scripts/ci/promote-deploy-gates.ts`, CI-Einstieg für `scripts/ops/runtime/{migration-job,bootstrap-job}.ts` sowie deren Tests
- Affected documentation: `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/11-risks-and-technical-debt.md`, `docs/guides/swarm-deployment-runbook.md`
- Follow-up: Ein separater Change aktiviert Production-`run` erst mit nachgewiesener Staging-Parität, Production-Freigabe, Backup-/Restore-Readiness und production-spezifischen Postconditions.
