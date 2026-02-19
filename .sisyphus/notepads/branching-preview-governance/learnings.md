# Learnings: Branching & Preview Governance

> Cumulative knowledge from task execution - conventions, patterns, gotchas

---

## Initial Context (Atlas - 2026-02-19T18:04)

**Current Repository State:**
- Branch naming enforced via `.githooks/reference-transaction`
- Allowed prefixes: `feature|fix|chore|docs|setup|adr|hotfix|epic|release|refactor|dev`
- Pattern: `<prefix>/<kebab-case-description>`
- Primary branches allowed: `main`, `develop`
- CI gates exist: test-coverage.yml with lint, unit, types, coverage checks
- Preview target exists: `apps/sva-studio-react:preview` (vite preview)
- Missing: `.github/CODEOWNERS`, per-PR preview workflow

**Key Files:**
- `DEVELOPMENT_RULES.md` - Current governance baseline
- `.githooks/reference-transaction` - Branch naming validation
- `.github/workflows/test-coverage.yml` - CI gates
- `docs/reports/PR_CHECKLIST.md` - PR requirements

---

## Task 1 Learnings (2026-02-19T17:11Z)

- Die Governance-Basis wird stabiler, wenn `Definition of Done` messbare Mindestwerte enthält (z. B. Anzahl IN/OUT-Punkte, feste Invarianten).
- Für diese Planstruktur müssen QA-RegExe gegen den kompletten Plantext geprüft werden; Marker in Szenario-Beschreibungen können sonst False-Positives auslösen.
- Für Scope-Freeze ist die klare Trennung aus `IN Scope`, `OUT Scope` und `Entscheidungsprinzipien` ausreichend, ohne technische Implementierungsdetails vorzuziehen.
- `PR-Preview als Standard` wurde als verbindlicher Lifecycle-Contract konkretisiert: `opened/synchronize -> update`, `closed -> destroy`.
- Evidence-Dateien unter `.sisyphus/evidence/` wurden als harte Abschlussbedingung bestätigt (`no evidence -> no done`).

## Task 2 Learnings (2026-02-19T18:40Z)

- Finales Governance-Modell ist auf fünf Kernklassen stabil: `feature/`, `fix/`, `chore/`, `stack/`, `epic/`.
- `stack/` braucht eine explizite Hook-Migration, weil es in `.githooks/reference-transaction` aktuell noch nicht im Prefix-Set enthalten ist.
- Für temporäre Branch-Klassen funktionieren harte TTL-Regeln nur mit numerischen Triggern (z. B. Tag 5/7 bei `stack`, Tag 10/14 bei `epic`).
- QA-Check sollte Prefix-Mengenvergleich und Invalid-Beispielanzahl getrennt ausweisen, damit Governance und technische Validierung unabhängig nachweisbar sind.

## Task 3 Learnings (2026-02-19T19:00Z)

- Stack-Regeln sind erst wirklich steuerbar, wenn sie als numerisches Policy-Objekt mit festen Schluesseln dokumentiert werden (`max_stack_depth`, `ttl_days`, `cadence_hours`).
- Rebase-Governance braucht neben einer Frequenz immer ein Ereignisfenster nach Parent-Merge (`after_parent_merge_hours`), sonst bleiben Kind-Branches trotz regelmaessigem Rebase technisch veraltet.
- Stale-Detection wird robust, wenn sie mehrere harte Trigger kombiniert (Commit-Inaktivitaet, Rebase-Alter, Konfliktdauer, TTL-Ueberschreitung) statt nur ein Zeitkriterium zu pruefen.
- Eskalation ist nur operational belastbar mit eindeutigem Owner pro Level und fester Reaktionszeit in Stunden (`8/24/48`).

## Task 4 Learnings (2026-02-19T19:20Z)

- Merge-Gates sind nur auditierbar, wenn Required Checks als exakte Branch-Protection-Namen dokumentiert sind (nicht nur als Command-Liste).
- Eine belastbare Gate-Matrix braucht neben `lint/unit/types/coverage` eine explizite E2E-Aktivierungsregel mit klaren Pfadbedingungen.
- Review-Governance bleibt eindeutig, wenn ein hartes numerisches Minimum (`1`) global gilt und fuer kritische Pfade ein hoeheres Minimum (`2`) separat definiert ist.
- Merge-Queue-Regeln sollten ueber messbare Trigger (`>=2` merge-ready PRs, kritische Pfade, `>30` Dateien) statt "bei Bedarf" aktiviert werden.
- Broken-main muss als Incident-SOP mit Owner, Revert-first-Aktion und SLA (`30` Minuten bis gruen) formuliert sein, damit Trunk-Betrieb stabil bleibt.
- Evidence:
  - `./.sisyphus/evidence/task-4-gate-matrix.txt`
  - `./.sisyphus/evidence/task-4-broken-main-error.txt`

## Task 5: CODEOWNERS-Strategie
- Kritische Pfade wurden identifiziert und kategorisiert (Apps, Core, CI, Security, Infrastruktur).
- Ein Team-basiertes Owner-Modell wurde gewählt, um den Bus-Faktor zu minimieren.
- Ein Fallback auf das Maintainer-Team wurde für alle nicht explizit zugewiesenen Pfade definiert.
- Ein Template für die zukünftige .github/CODEOWNERS Datei wurde erstellt (geplant für T10).
- Die Strategie ist in docs/governance/codeowners-strategy.md dokumentiert.

## Task 6 Learnings (2026-02-19T17:31Z)

- Eine belastbare Plattformentscheidung für Preview-Umgebungen braucht eine feste Skala (`1-5`) plus Gewichte mit Summe `100`, sonst bleiben Ergebnisse schwer vergleichbar.
- `SLA/Verfügbarkeit` sollte als eigenes Kriterium geführt werden und nicht nur implizit unter Betrieb laufen, damit Stabilitätsrisiken separat messbar sind.
- Für Governance-Readiness ist die Kombination aus `Kosten` und `Betrieb (Ops Burden)` entscheidend, weil reine Plattformpreise den internen Betriebsaufwand unterschätzen.
- Ein deterministischer Tie-Breaker mit fester Reihenfolge (`Security -> Isolation -> Kosten -> Setup`) verhindert ad-hoc Entscheidungen bei Gleichstand.
- Die Trennung zwischen Bewertungslogik (T6) und Umsetzungslogik (spätere Tasks) hält die Governance auditierbar und vermeidet verfrühte Migrationsfestlegungen.

## Task 8 Learnings (2026-02-19T18:00Z)

- Kosten- und Kapazitätsleitplanken sind nur operational belastbar, wenn sie mit harten numerischen Werten arbeiten (`max_active_previews: 10`, `stale: 7 Tage`, `destroy: 14 Tage`).
- Für Kapazitätsengpässe braucht es eine klare Priorisierungslogik mit Budget-Enforcement (`priority:high` limitiert auf 2 Labels/Team/Woche), sonst wird das System missbraucht.
- Queue-Mechanismen müssen neben technischer Länge (`max 5 Slots`) auch eine Kommunikationsstrategie haben (GitHub-Kommentar mit Wartezeit/Position).
- Cleanup-Fehlerbehandlung ist unvollständig ohne Retry-Logik (`3x mit 5min Abstand`) plus Eskalation mit Owner/SLA (`SRE 24h`).
- Budget-Caps sollten nicht blind gesetzt werden: Für neue Systeme ist "Monitoring First" mit messbarer Re-Evaluation nach 30/90 Tagen robuster als spekulative Limits.
- Idle-Lifecycle mit Opt-Out (`/preview keep`) balanciert Ressourceneffizienz mit Entwicklerfreiheit, muss aber Missbrauch durch max. Verlängerungen (`2x = 42 Tage`) verhindern.
- Evidence:
  - `./.sisyphus/evidence/task-8-concurrency-cap.txt`
  - `./.sisyphus/evidence/task-8-idle-cleanup-error.txt`

## Task 9 Learnings (2026-02-19T20:05Z)

- Preview-Security wird nur dann operational belastbar, wenn Secret-Quelle pro Plattform explizit erzwungen ist (`GitHub Secrets` fuer Vercel, `Vault` fuer self-hosted) statt allgemein "Env Vars" zu erlauben.
- Hardcoded-Credentials brauchen eine Zero-Tolerance-Formulierung mit verbotenen Fundorten (`source_code`, `config_files`, `environment_defaults`), damit automatische Governance-Checks eindeutig auswertbar bleiben.
- PII-Schutz ist fuer Preview erst pruefbar, wenn erlaubte Datenklassen geschlossen definiert sind (`test`, `sanitized`, `synthetic`) und Produktivdaten ohne Sanitization explizit verboten werden.
- Incident-Reaktion muss numerisch sein, sonst bleibt Verantwortlichkeit diffus: `security_team`, Start der Leak-Gegenmassnahmen in `<= 60` Minuten, PII-Incident-Report in `<= 2` Stunden.
- Plattformneutrale Regeln plus separater Vercel/self-hosted Abschnitt vermeiden Vendor-Lock-in in der Policy und halten die Unterschiede dennoch auditierbar.
- Evidence:
  - `./.sisyphus/evidence/task-9-secrets-policy.txt`
  - `./.sisyphus/evidence/task-9-pii-error.txt`

## Task 7 Learnings (2026-02-19T17:36Z)

- Ein robustes Preview-Lifecycle-Modell bleibt auditierbar, wenn jeder PR-Event exakt einem Lifecycle-Schritt zugeordnet ist (`opened`, `synchronize`, `closed` jeweils genau ein Schritt).
- URL-Publishing sollte als mehrkanaliger Governance-Standard fixiert werden (Deployment-Objekt als kanonische Quelle plus Status-Check und sticky PR-Kommentar), damit Sichtbarkeit fuer Reviewer und Automationen gleichzeitig gesichert ist.
- TTL-Regeln brauchen zwei harte numerische Grenzen (`stale` und `hard destroy`), damit keine implizit unbefristeten Preview-Umgebungen entstehen.
- Cleanup-Policy ist erst vollstaendig, wenn neben Ressourcen auch Deployment-Metadaten verpflichtend entfernt werden und ein klarer Fehlerpfad mit Retry + Eskalation existiert.
- Zombie-Praevention sollte explizit als periodischer Sweep mit fester Frequenz dokumentiert sein, statt nur als informeller Betriebswunsch.

## Task 10 Learnings (2026-02-19T17:36Z)

- Branch-Protection-Policies bleiben nur dann durchsetzbar, wenn Check-Namen exakt als GitHub-Statusnamen dokumentiert sind (`Lint / lint`, `Unit / unit`, `Types / types`, `Test Coverage / coverage`, `App E2E / e2e`).
- Merge-Queue-Einfuehrung sollte phasenweise mit harten Schwellwerten erfolgen (`>=2` merge-ready PRs, kritische Pfade, `>30` Dateien), damit Aktivierung nachvollziehbar und auditierbar bleibt.
- Fehlerpfade muessen numerisch fixiert sein (Retry `2x`, Timeout `30` Minuten, Eskalation `15` Minuten), sonst bleibt Queue-Verhalten interpretierbar.
- Bypass-Regeln sind nur governance-tauglich, wenn sie auf P0/P1 begrenzt sind und immer eine Incident-Issue-Referenz plus PR-Audit-Kommentar erzwingen.
- Wenn `gh` in der Ausfuehrungsumgebung fehlt, muss die Delta-Luecke explizit als Baseline-Nachweis dokumentiert werden statt stillschweigend als "PASS" zu markieren.
