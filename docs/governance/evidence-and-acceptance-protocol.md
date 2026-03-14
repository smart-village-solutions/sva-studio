# Evidence- und Abnahmeprotokoll

> Standard für Evidence-basierte Qualitätssicherung und Agent-exekutierbare Verifikation

**Gültigkeitsbereich**: Alle Governance-Arbeiten, die über `.sisyphus/plans/*.md` strukturiert sind  
**Version**: 1.0  
**Letzte Aktualisierung**: 2026-02-19

---

## 1. Übersicht

Dieses Protokoll definiert den verbindlichen Standard für Evidence-Dateien in Governance-Projekten. Es stellt sicher, dass Aufgaben nachweisbar abgeschlossen, reproduzierbar verifiziert und langfristig auditierbar sind.

**Kernprinzip**: Keine Aufgabe ist ohne Evidence-Dateien abgeschlossen.

---

## 2. Evidence-Namensschema

### 2.1 Dateinamensformat

**Pattern**:
```
task-{N}-{scenario-slug}.{ext}
```

**Komponenten**:

| Komponente | Beschreibung | Beispiel |
|------------|--------------|----------|
| `{N}` | Aufgabennummer (1-999, keine Zero-Padding-Pflicht) | `4`, `10`, `16` |
| `{scenario-slug}` | Kebab-case-Slug aus QA-Szenario-Beschreibung | `gate-matrix`, `required-checks`, `preview-cleanup-error` |
| `{ext}` | Dateierweiterung nach Artefakttyp (siehe 2.2) | `txt`, `json`, `log`, `md` |

**Regex** (für Validierung):
```regex
^task-\d{1,3}-[a-z0-9]+(-[a-z0-9]+)*\.(txt|json|log|md)$
```

**Valide Beispiele**:
```
.sisyphus/evidence/task-4-gate-matrix.txt
.sisyphus/evidence/task-10-branch-protection.json
.sisyphus/evidence/task-15-preview-cleanup-error.txt
```

**Invalide Beispiele**:
```
.sisyphus/evidence/task4_check.txt          (Unterstrich statt Bindestrich)
.sisyphus/evidence/branch-protection.txt    (Aufgabennummer fehlt)
.sisyphus/evidence/task-4-check              (Dateierweiterung fehlt)
.sisyphus/evidence/TASK-4-gate-matrix.txt   (Großbuchstaben in Task)
```

### 2.2 Dateierweiterungen und Verwendung

| Extension | Verwendung | Typische Inhalte | Beispiel |
|-----------|------------|------------------|----------|
| `.txt` | Plain-Text-Output, Grep-Ergebnisse, Validierungslogs, einfache Assertions | Command-Output, Counts, Boolean-Checks | `task-8-concurrency-cap.txt` |
| `.json` | Strukturierte Daten, API-Responses, Konfigurationssnapshots | GitHub API Response, Parsed Config | `task-10-branch-protection.json` |
| `.log` | Vollständige Command-Logs mit Zeitstempeln, Debug-Output | CI-Run-Logs, Multi-Command-Execution | `task-12-migration-coverage.log` |
| `.md` | Strukturierte Reports, Tabellen, mehrsektige Analysen | Vergleichsmatrizen, Feature-Analysen | `task-6-comparison-matrix.md` |

#### Beispiel: `.txt` (Plain Text)
```
Datei: task-8-concurrency-cap.txt

max_active_previews: 10
priority_queue_max: 5
idle_ttl_days: 7
destroy_ttl_days: 14
```

#### Beispiel: `.json` (Strukturierte Daten)
```json
// Datei: task-10-branch-protection.json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint / lint",
      "Unit / unit",
      "Types / types",
      "Test Coverage / coverage",
      "App E2E / e2e"
    ]
  }
}
```

#### Beispiel: `.log` (Full Log)
```
Datei: task-12-migration-coverage.log

[2026-02-19T18:00:00Z] Starting validation...
[2026-02-19T18:00:01Z] Checking dual-handling section...
[2026-02-19T18:00:02Z] PASS: Dual-handling documented
[2026-02-19T18:00:03Z] Checking cutover-deadline...
[2026-02-19T18:00:04Z] PASS: Cutover deadline = 30 days
```

#### Beispiel: `.md` (Strukturierter Report)
```markdown
<!-- Datei: task-6-comparison-matrix.md -->

| Kriterium | Vercel | Self-Hosted |
|-----------|--------|-------------|
| Setup     | 5      | 3           |
| Security  | 4      | 5           |
| Isolation | 4      | 5           |
```

---

## 3. Abschlussregel: Evidence-Driven Acceptance

### 3.1 Regel

**No Evidence → No Done**

Eine Aufgabe gilt als **NICHT ABGESCHLOSSEN**, wenn nicht für jedes QA-Szenario eine entsprechende Evidence-Datei existiert.

### 3.2 Enforcement

1. **Erstellung**: Jedes QA-Szenario in der Aufgabendefinition **MUSS** eine Evidence-Datei produzieren.
2. **Staging**: Evidence-Dateien **MÜSSEN** zusammen mit den Deliverables gestaged und committed werden.
3. **Verifikation**: Der Orchestrator **MUSS** vor dem Markieren der Checkbox die Existenz aller Evidence-Dateien prüfen.

### 3.3 Rationale

- **Vermeidung von "Done, but broken"**: Claims ohne Nachweis führen zu Folgefehlern.
- **Audit-Trail**: Evidence-Dateien schaffen eine nachprüfbare Historie für Compliance.
- **Reproduzierbarkeit**: Andere Agenten oder zukünftige Reviews können Ergebnisse eigenständig validieren.

### 3.4 Beispiel: Task 4 (Merge/Review Gates)

**QA-Szenarien**:
1. Gate-Matrix vollständig → `.sisyphus/evidence/task-4-gate-matrix.txt` (ERFORDERLICH)
2. Broken-Main-Error-Handling dokumentiert → `.sisyphus/evidence/task-4-broken-main-error.txt` (ERFORDERLICH)

**Status ohne beide Dateien**: Task 4 = **INCOMPLETE**, auch wenn `docs/governance/merge-review-gates.md` existiert.

### 3.5 Ausnahmen

**Keine Ausnahmen.** Wenn ein Szenario keine Evidence produzieren kann, ist das Szenario fehlerhaft und muss überarbeitet werden.

---

## 4. Evidence-Lifecycle

### 4.1 Phase 1: Erstellung (Task-Ausführung)

**Verantwortlich**: Subagent (z. B. Sisyphus-Junior)

1. **Szenario ausführen**: Kommando oder Check gemäß QA-Szenario-Definition durchführen.
2. **Output erfassen**: Ergebnis in Evidence-Datei mit korrektem Naming speichern.
3. **Stagen**: Evidence-Datei mit `git add` zu Deliverables hinzufügen.

**Beispiel**:
```bash
# Szenario: Concurrency Cap validieren
grep -E "max_active_previews|priority_queue_max" docs/governance/preview-capacity-constraints.md \
  > .sisyphus/evidence/task-8-concurrency-cap.txt

git add .sisyphus/evidence/task-8-concurrency-cap.txt
```

### 4.2 Phase 2: Validierung (Orchestrator-Verifikation)

**Verantwortlich**: Orchestrator (z. B. Atlas)

1. **Existenzprüfung**: Prüfen, ob Evidence-Datei unter `.sisyphus/evidence/task-{N}-{slug}.{ext}` existiert.
2. **Inhaltsvalidierung**: Evidence-Inhalt gegen erwartete Kriterien prüfen (z. B. Regex-Match, JSON-Schema, Mindest-Zeilenanzahl).
3. **Entscheidung**:
   - **PASS**: Task als abgeschlossen markieren (Checkbox setzen).
   - **FAIL**: Subagent-Session wiederaufnehmen, Nachbesserung verlangen.

**Beispiel**:
```bash
# Prüfen, ob task-8-concurrency-cap.txt existiert und relevante Werte enthält
test -f .sisyphus/evidence/task-8-concurrency-cap.txt && \
  grep -qE "max_active_previews: [0-9]+" .sisyphus/evidence/task-8-concurrency-cap.txt
```

### 4.3 Phase 3: Archivierung (Commit)

**Verantwortlich**: Orchestrator oder Subagent (je nach Workflow)

1. **Commit**: Evidence-Dateien zusammen mit Governance-Dokumenten committen.
2. **Referenz**: In Final Verification (F1-F4) auf Evidence-Dateien verweisen.
3. **Retention**: Evidence-Dateien **niemals löschen** nach Commit (permanente Aufbewahrung für Audits).

**Git-Historie**: Evidence-Dateien bleiben dauerhaft in Git-History für Compliance-Nachweise verfügbar.

---

## 5. Storage-Konventionen

### 5.1 Verzeichnisstruktur

**Pfad**: `.sisyphus/evidence/` (flat structure)

**Rationale**:
- Einfache Glob-Patterns (`task-*.txt`)
- Keine verschachtelten Ordner pro Task (verhindert Fragmentierung)
- Alle Evidence-Dateien eines Plans an einem Ort

### 5.2 Retention-Policy

**Regel**: Evidence-Dateien werden **niemals gelöscht** nach Commit.

**Begründung**:
- Audit-Trail für Governance-Compliance
- Reproduzierbarkeit für zukünftige Reviews
- Git-Historie als Single Source of Truth

---

## 6. Evidence-Inventar (Branching-Preview-Governance-Plan)

### 6.1 Übersicht

| Task | QA-Szenarien | Evidence-Dateien | Format |
|------|--------------|------------------|--------|
| T1 | 2 | `task-1-scope-baseline.txt`<br>`task-1-ambiguity-check-error.txt` | `.txt` |
| T2 | 2 | `task-2-qa-prefix-alignment.txt`<br>`task-2-qa-invalid-examples.txt` | `.txt` |
| T3 | 2 | `task-3-qa-depth-ttl-rebase.txt`<br>`task-3-qa-rebase-trigger.txt` | `.txt` |
| T4 | 2 | `task-4-gate-matrix.txt`<br>`task-4-broken-main-error.txt` | `.txt` |
| T5 | 2 | `task-5-codeowners-strategy.txt`<br>`task-5-unowned-path-error.txt` (geplant) | `.txt` |
| T6 | 2 | `task-6-matrix-readiness.txt`<br>`task-6-tie-breaker-error.txt` | `.txt` |
| T7 | 2 | `task-7-create-preview.txt`<br>`task-7-destroy-preview-error.txt` | `.txt` |
| T8 | 3 | `task-8-concurrency-cap.txt`<br>`task-8-idle-cleanup-error.txt`<br>`task-8-summary.txt` | `.txt` |
| T9 | 2 | `task-9-secrets-policy.txt`<br>`task-9-pii-error.txt` | `.txt` |
| T10 | 2 | `task-10-branch-protection.json`<br>`task-10-merge-queue-error.txt` | `.json`, `.txt` |
| T11 | 2 | `task-11-rollout-phases.txt`<br>`task-11-pilot-failure-error.txt` | `.txt` |
| T12 | 2 | `task-12-migration-coverage.txt`<br>`task-12-cutover-error.txt` | `.txt` |
| T13 | 2 | `task-13-broken-main-sop.txt`<br>`task-13-hotfix-audit-error.txt` | `.txt` |
| T14 | 2 | `task-14-kpi-integrity.txt`<br>`task-14-kpi-source-error.txt` | `.txt` |

**Gesamt**: 28 Evidence-Dateien (14 Tasks × 2 Szenarien durchschnittlich)  
**Format-Verteilung**: 27× `.txt`, 1× `.json`

### 6.2 Pattern-Analyse

**Beobachtungen**:
- Alle Dateinamen folgen `task-{N}-{slug}.{ext}` (100% Konformität)
- Extensions: Überwiegend `.txt` (einfache Validierungen), `.json` für GitHub API Response (T10)
- Szenarien pro Task: Mindestens 2 (1× positive Validierung, 1× Error/Edge-Case)

---

## 7. Werkzeuge und Automation

### 7.1 Validierung (Naming)

**Regex-basierte Prüfung**:
```bash
# Alle Evidence-Dateien prüfen
for file in .sisyphus/evidence/task-*.*; do
  if ! echo "$file" | grep -qE "^\.sisyphus/evidence/task-[0-9]{1,3}-[a-z0-9]+(-[a-z0-9]+)*\.(txt|json|log|md)$"; then
    echo "INVALID: $file"
  fi
done
```

### 7.2 Vollständigkeitsprüfung

**Beispiel** (für Plan mit 2 Szenarien pro Task):
```bash
# Erwartete Evidence-Dateien für Task 4
expected_files=(
  ".sisyphus/evidence/task-4-gate-matrix.txt"
  ".sisyphus/evidence/task-4-broken-main-error.txt"
)

for file in "${expected_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "MISSING: $file"
    exit 1
  fi
done
```

### 7.3 Git-Hooks (Pre-Commit)

**Optional**: Hook, der vor Commit prüft, ob alle Evidence-Dateien für gestaged Governance-Dokumente vorhanden sind.

---

## 8. Integration in Task-Definitions

### 8.1 Template für QA-Szenarien

**Format**:
```markdown
## QA-Szenarien

1. **[Positive Validation Scenario]**
   - Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`
   - Muss: [Erwartetes Ergebnis mit messbarem Kriterium]

2. **[Error/Edge-Case Scenario]**
   - Evidence: `.sisyphus/evidence/task-{N}-{slug}-error.{ext}`
   - Muss: [Erwartetes Fehlerverhalten oder Edge-Case-Handling]
```

**Beispiel** (Task 10):
```markdown
## QA-Szenarien

1. **Branch-Protection Required Checks vollständig**
   - Evidence: `.sisyphus/evidence/task-10-branch-protection.json`
   - Muss: JSON enthält mindestens 5 Required Checks inkl. `Test Coverage / coverage`

2. **Merge-Queue Bypass-Regel dokumentiert**
   - Evidence: `.sisyphus/evidence/task-10-merge-queue-error.txt`
   - Muss: Bypass nur für P0/P1 mit Incident-Referenz-Pflicht
```

---

## 9. Häufige Fehlerquellen

### 9.1 Ambiguitäten in Scenario-Slugs

**Problem**: `"Branch Protection Required Checks"` → `required-checks` oder `branch-protection`?

**Lösung**: Slug sollte aus den **relevanten Keywords** des Szenarios abgeleitet werden, die das **spezifische Artefakt** beschreiben:
- `"Branch Protection Required Checks"` → `branch-protection` (da JSON = Branch-Protection-Snapshot)
- `"Merge-Queue Bypass-Regel"` → `merge-queue-error` (da Fehlerfall = Bypass-Regel)

### 9.2 Fehlende Extensions

**Problem**: Datei ohne Extension (`task-4-check`)

**Lösung**: Extension ist **verpflichtend**. Immer mindestens `.txt` verwenden.

### 9.3 Vorzeitige Completion ohne Evidence

**Problem**: Orchestrator markiert Task als `done`, obwohl Evidence-Dateien fehlen.

**Lösung**: Orchestrator-Verifikation muss **zuerst** Evidence-Existenz prüfen, bevor Checkbox gesetzt wird.

---

## 10. Erweiterungen (für zukünftige Pläne)

### 10.1 Machine-Readable Evidence (JSON Schema)

Für `.json`-Evidence-Dateien kann ein JSON-Schema definiert werden, um strukturierte Validierung zu ermöglichen.

**Beispiel**:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["required_status_checks"],
  "properties": {
    "required_status_checks": {
      "type": "object",
      "required": ["contexts"],
      "properties": {
        "contexts": {
          "type": "array",
          "minItems": 5,
          "items": { "type": "string" }
        }
      }
    }
  }
}
```

### 10.2 Evidence-Metadaten

Optionale Header in Evidence-Dateien für bessere Nachvollziehbarkeit:
```
# Evidence Metadata
# Task: T10
# Scenario: Branch-Protection Required Checks vollständig
# Generated: 2026-02-19T18:30:00Z
# Command: gh api repos/owner/repo/branches/main/protection

{...}
```

---

## 11. Zusammenfassung

**Kernanforderungen**:
1. **Naming**: `task-{N}-{scenario-slug}.{ext}` (deterministisch, Regex-validierbar)
2. **Extensions**: `.txt`, `.json`, `.log`, `.md` (nach Artefakttyp)
3. **Completion Rule**: Keine Evidence → Keine Aufgabe als abgeschlossen markierbar
4. **Lifecycle**: Erstellung → Validierung → Archivierung (permanent)

**Erfolgsmetriken**:
- 100% Evidence-Coverage für alle QA-Szenarien
- 0% Tasks mit fehlenden Evidence-Dateien nach Completion
- 0% Evidence-Dateien mit ungültigem Naming

**Nächste Schritte**:
- Orchestrator-Integration: Automatisierte Existenzprüfung vor Checkbox-Markierung
- Git-Hooks: Optional Pre-Commit-Hook für Evidence-Vollständigkeit
