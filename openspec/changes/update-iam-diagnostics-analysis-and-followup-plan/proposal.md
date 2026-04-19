# Change: IAM-Diagnostik, Analysephase und Folgechange-Übergabe

## Why

Das aktuelle Zusammenspiel zwischen Studio, Keycloak, Instanz-Registry, Sessions und IAM-Datenhaltung erzeugt wiederkehrende Ausfälle mit ähnlichen Symptomen, aber unterschiedlichen Ursachen. Vor einem Refactoring fehlt ein belastbarer, end-to-end nachvollziehbarer Diagnose- und Analysepfad, der Konfigurationsfehler, Runtime-Drift, Dateninkonsistenzen, Session-Probleme, Altlasten aus früheren Fixes und Frontend-Symptome sauber trennt.

Zusätzlich ist absehbar, dass die eigentliche Refactoring- und Umsetzungsarbeit nicht im selben Arbeitskontext abgeschlossen werden kann. Die Analysephase muss deshalb verbindlich in einen Folgechange überführt werden, damit Befunde, priorisierte Maßnahmen und Architekturentscheidungen nicht verloren gehen.

## What Changes

- definiert einen verbindlichen Analyse- und Diagnose-Track für IAM vor jedem größeren Refactoring
- führt eine end-to-end IAM-Fehlertaxonomie für Auth-Auflösung, Session, Actor-/Membership-Auflösung, Keycloak-Abhängigkeit, DB-/Schema-Drift und Registry-/Provisioning-Drift ein
- verlangt die explizite Untersuchung historischer Workarounds, Fehlfixes und möglicher Seiteneffekte aus früheren IAM-Änderungen
- verlangt die explizite Untersuchung falscher, veralteter oder widersprüchlicher IAM-, Mapping- und Membership-Daten in der Datenbank
- verlangt eine sichere, UI-taugliche Diagnoseoberfläche für IAM-Fehler statt überwiegend generischer Fehlermeldungen
- verlangt explizit bessere Statusanzeigen im Frontend für degradierte IAM-Zustände, Recovery-Zwischenzustände und driftverdächtige Konstellationen
- verzahnt bestehende Keycloak-Preflight-/Provisioning-Diagnosen mit den Runtime-IAM-Fehlerbildern
- dokumentiert die Repo-Analyse in einem versionierten Bericht unter `docs/reports/`
- verlangt einen expliziten Hybrid-Live-Triage-Block gegen eine reale Umgebung und verbietet stillschweigendes Schließen ohne diesen Nachweis
- verpflichtet die Analysephase zur Übergabe in einen separaten Folgechange mit Proposal, Design, Tasks und priorisiertem Refactoring-Scope

## Impact

- Affected specs:
  - `iam-core`
  - `account-ui`
  - `instance-provisioning`
  - `architecture-documentation`
- Affected code:
  - `packages/auth/src/`
  - `packages/data/src/instance-registry/`
  - `packages/core/src/instances/`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `apps/sva-studio-react/src/providers/auth-provider.tsx`
  - `apps/sva-studio-react/src/routes/account/`
  - `apps/sva-studio-react/src/routes/admin/users/`
  - `apps/sva-studio-react/src/routes/admin/instances/`
  - `docs/reports/iam-diagnostics-analysis-2026-04-19.md`
  - `openspec/changes/refactor-iam-runtime-diagnostics-contract/`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
