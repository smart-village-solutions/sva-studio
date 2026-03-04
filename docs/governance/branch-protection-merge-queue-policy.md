# Branch-Protection- und Merge-Queue-Policy

## Ziel und Geltungsbereich

Diese Policy definiert die verbindlichen Branch-Protection-Regeln fuer `main` und die Einfuehrung der Merge Queue. Sie konkretisiert die Gate-Basis aus `docs/governance/merge-review-gates.md` und nutzt die Kritikalitaetsdefinition aus `docs/governance/codeowners-strategy.md` als Quelle fuer kritische Pfade (spaeter in `.github/CODEOWNERS` technisch abgebildet).

## Verbindliche Branch-Protection-Regeln fuer `main`

### Required Status Checks (exakte GitHub-Check-Namen)

Die folgenden Checks muessen in GitHub Branch Protection fuer `main` als `required` konfiguriert sein:

1. `Lint / lint`
2. `Unit / unit`
3. `Types / types`
4. `Test Coverage / coverage`
5. `App E2E / e2e` (nur wenn `apps/` betroffen ist)

Quellen:

- Coverage-Workflow: `.github/workflows/test-coverage.yml`
- E2E-Workflow: `.github/workflows/app-e2e.yml`
- Gate-Baseline: `docs/governance/merge-review-gates.md`

### Required Reviews

- Standard-Pfade: mindestens `1` Approval.
- Kritische Pfade: mindestens `2` Approvals.
- Kritische Pfade richten sich nach `docs/governance/codeowners-strategy.md` (insbesondere `apps/`, `packages/core/`, `.github/workflows/`, sowie weitere dort als KRITISCH markierte Bereiche).

### Zuschnitt der Schutzregeln

- Dismiss stale approvals: aktiviert.
- Require conversation resolution before merge: aktiviert.
- Force-push auf `main`: verboten.
- Deletion von `main`: verboten.

## Merge Queue: Einfuehrung und Aktivierung

## Einfuehrungsmodell

Die Merge Queue wird **phasenweise** eingefuehrt:

- Phase 1 (ab sofort): Queue aktiviert fuer PRs, die mindestens eines der Aktivierungskriterien erfuellen.
- Phase 2 (nach 14 Kalendertagen): Queue ist Standard fuer alle PRs nach `main`; Ausnahmen nur gemaess Bypass-Policy.

Uebergangskriterium Phase 1 -> Phase 2:

- In den letzten `14` Tagen wurden mindestens `20` PRs erfolgreich ueber die Queue gemergt.
- Queue-bedingte Ejections liegen unter `10 %`.

### Aktivierungskriterien (numerisch, verbindlich)

Ein PR wird in die Merge Queue aufgenommen, wenn mindestens ein Kriterium zutrifft:

1. Es warten gleichzeitig mindestens `2` merge-ready PRs.
2. Der PR beruehrt einen kritischen Pfad gemaess `docs/governance/codeowners-strategy.md`/CODEOWNERS.
3. Der PR aendert mehr als `30` Dateien.

## Merge-Queue-Fehlerbehandlung

### Flaky Check

- Automatischer Retry bis zu `2` Mal.
- Wenn danach weiterhin nicht gruen: Eject aus Queue.

### Failed Check

- Sofortiger Eject ohne Retry.

### Timeout

- Maximale Queue-Zeit pro PR: `30` Minuten.
- Bei Ueberschreitung: Eject aus Queue.

### Eskalation

- Bei jedem Eject wird der zuständige Owner (aus CODEOWNERS bzw. Maintainer-Fallback) innerhalb von `15` Minuten benachrichtigt.
- Der PR bleibt blockiert, bis Ursache dokumentiert und Checks wieder gruen sind.

## Bypass-Policy

Bypass ist nur bei **Produktionsvorfaellen P0/P1** erlaubt.

Verpflichtende Audit-Spur (alle Punkte muessen vor Merge vorliegen):

1. Verlinktes GitHub Incident-Issue.
2. PR-Kommentar mit Begruendung fuer den Bypass und Risikoabschaetzung.
3. Nennung der freigebenden verantwortlichen Rolle (Maintainer/Incident Commander).

Nachgelagerte Pflichtmassnahme:

- Incident Review innerhalb von `48` Stunden mit dokumentierter Korrekturmassnahme (z. B. Rule-Hardening, Test/Gate-Erweiterung).

Offene, nicht protokollierte Bypass-Rechte sind unzulaessig.
