# Kosten- und Kapazitätsleitplanken für Preview-Umgebungen

## Ziel und Geltungsbereich

Dieses Dokument definiert messbare Leitplanken für Preview-Umgebungen, um Kosten kontrollierbar zu halten und Ressourcenengpässe durch unbegrenzte Parallelität zu vermeiden. Die Regeln sind plattformneutral und gelten sowohl für Vercel als auch für eigene Infrastruktur.

## Kontext

- Preview-Umgebungen werden automatisch für jeden PR bereitgestellt (siehe `docs/governance/branch-preview-lifecycle.md`).
- Ohne Kapazitätsgrenzen können parallele PRs unkontrollierte Kosten oder Ressourcenknappheit verursachen.
- Die Regeln müssen operational messbar sein (numerische Trigger, nicht "bei Bedarf").

## Max Active Previews (Concurrent Limit)

### Wert

**Pilot-Phase (erste 90 Tage): 10 aktive Previews**

- `max_active_previews`: `10`
- Scope: Pro Workspace (wenn multi-tenant), andernfalls global pro Repository.

### Verhalten bei Überschreitung

Wenn bereits `max_active_previews` Previews aktiv sind und ein neuer PR geöffnet wird:

1. **Prüfung Priorität**: Hat der neue PR das Label `priority:high`?
   - **Ja**: Sofort provisionieren, ältesten `priority:default` Preview zerstören (FIFO).
   - **Nein**: In Queue einreihen (siehe Abschnitt Queue-Logik).

2. **Queue-Logik (Priority Default)**:
   - Maximale Queue-Länge: `5` PRs.
   - Bei Queue-Überschreitung: PR-Autor erhält GitHub-Kommentar mit Message:
     ```
     ⏸️ Preview-Kapazität erreicht. Dein PR wartet auf einen freien Slot (Position: X/5).
     Aktuelle Wartezeit: ~XX Minuten (basierend auf durchschnittlicher PR-Laufzeit).
     
     Dringend? Label `priority:high` hinzufügen (max. 2 pro Team/Woche).
     ```
   - Sobald ein Preview abgebaut wird (PR closed/merged oder Inaktivitäts-Timeout): Nächster PR aus Queue wird automatisch provisioniert.

3. **Priorisierungs-Budget**:
   - `priority:high` ist limitiert auf **2 Labels pro Team pro Woche** (Rolling Window).
   - Überschreitung: Label wird automatisch auf `priority:default` zurückgesetzt + GitHub-Kommentar mit Hinweis.

## Inaktivitäts-Timeout (Idle Cleanup)

### Werte

- **Stale-Schwelle**: `7 Tage` ohne neue Commits auf dem PR-Branch.
- **Auto-Destroy-Schwelle**: `14 Tage` ohne Commits.

### Lifecycle

1. **Tag 0-6**: Preview läuft normal.
2. **Tag 7**: PR wird als "stale" markiert.
   - GitHub-Label `preview:stale` wird gesetzt.
   - PR-Autor erhält Kommentar:
     ```
     🕒 Preview seit 7 Tagen inaktiv. Bei fehlender Aktivität (Commit/Push) 
     wird der Preview in weiteren 7 Tagen (Tag 14) automatisch abgebaut.
     
     Abbruch-Kommando: Kommentar `/preview keep` posten.
     ```
3. **Tag 14**: Auto-Destroy wird ausgelöst.
   - Preview-Infrastruktur wird zerstört.
   - GitHub-Label `preview:destroyed` wird gesetzt.
   - PR-Kommentar:
     ```
     🗑️ Preview wurde wegen Inaktivität (14 Tage) abgebaut.
     Reaktivierung: Neuen Commit pushen oder `/preview recreate` kommentieren.
     ```

### Opt-Out

- PR-Autor kann mit Kommentar `/preview keep` den Timer für weitere `14 Tage` zurücksetzen.
- Maximale Verlängerungen: `2x` (insgesamt 42 Tage), danach zwingender Abbau.

### Fehlerbehandlung

**Szenario: Cleanup-Job schlägt fehl (z. B. API-Fehler, Netzwerk-Timeout)**

1. **Retry-Logik**: 3 Versuche im Abstand von `5 Minuten`.
2. **Nach 3 Fehlversuchen**:
   - Incident wird in Monitoring-System geloggt (Prometheus Alert: `PreviewCleanupFailed`).
   - AlertManager Trigger: Slack-Channel `#preview-ops` + PagerDuty (bei `severity:critical`).
   - Fallback-Verhalten:
     - Preview-Status wird auf `cleanup:failed` gesetzt (GitHub-Label).
     - PR-Kommentar:
       ```
       ⚠️ Preview-Cleanup fehlgeschlagen (Infrastruktur-Problem). 
       Ops-Team wurde benachrichtigt. Manuelle Bereinigung erforderlich.
       ```
   - Eskalation: **SRE-Team muss innerhalb von 24 Stunden manuell bereinigen**.

3. **Success-Path**: Cleanup erfolgreich → GitHub-Label `preview:destroyed`, PR-Kommentar, Prometheus Metric `preview_cleanup_duration_seconds` aktualisiert.

## Budget-Cap

### Pilot-Phase (erste 90 Tage)

**Budget-Cap: TBD - Monitoring First**

- Während der Pilot-Phase wird **kein harter Budget-Cap** gesetzt.
- Stattdessen: Datensammlung über tatsächliche Kosten.
  - Metrik: `preview_cost_estimated_eur` (täglich, pro Preview).
  - Aggregation: Wöchentliche Reports an Product-Owner.
  
- **Trigger für Budgetprüfung nach Tag 30**:
  - Wenn Durchschnittskosten > `500 EUR/Monat`: Re-Evaluation der Kapazitätslimits.
  - Wenn Durchschnittskosten < `200 EUR/Monat`: Erhöhung von `max_active_previews` auf `15` evaluieren.

### Post-Pilot (nach Tag 90)

Nach Auswertung der Monitoring-Daten wird ein fester Budget-Cap definiert:

- Format: `max_monthly_budget_eur`: `<numerischer Wert>`.
- Verhalten bei Überschreitung:
  - **Soft-Limit (90%)**: Warning-Alert + Benachrichtigung Product-Owner.
  - **Hard-Limit (100%)**: Keine neuen Previews mehr provisionieren bis Monatsende (Queue blockiert, PRs erhalten Kommentar mit Wartezeit bis nächster Monat).

**Placeholder für zukünftiges Update:**

```yaml
# NACH PILOT (Tag 90+) hier eintragen:
# max_monthly_budget_eur: <numerischer Wert>
# soft_limit_percentage: 90
# hard_limit_action: "block_provisioning"
```

## Over-Capacity Behavior (Zusammenfassung)

| Szenario | Bedingung | Aktion |
| --- | --- | --- |
| Neuer PR (`priority:high`) | `active_previews >= 10` | Ältesten `priority:default` Preview zerstören + neuen PR sofort provisionieren |
| Neuer PR (`priority:default`) | `active_previews >= 10` | In Queue einreihen (max. 5 Slots), bei Queue-Überschreitung: Kommentar mit Wartezeit |
| Inaktivität >= 7 Tage | Keine Commits | Label `preview:stale`, Kommentar mit 7-Tage-Warnung |
| Inaktivität >= 14 Tage | Keine Commits | Auto-Destroy (mit Fehlerbehandlung: 3x Retry → Eskalation) |
| Budget >= 90% | Monatliche Kosten > Soft-Limit | Alert + Product-Owner Benachrichtigung |
| Budget >= 100% | Monatliche Kosten > Hard-Limit | Blockierung neuer Previews bis Monatsanfang |

## Priority Rules (Label-basiert)

### Label: `priority:high`

- **Bedeutung**: Zeitkritischer PR (z. B. Hotfix, Security-Patch, Blocker für Milestone).
- **Effekt**:
  - Immer sofort provisionieren, auch bei Kapazitätsengpass.
  - Verdrängt ältesten `priority:default` Preview aus Pool (FIFO).
- **Budget**: Max. `2 Labels pro Team pro Woche` (Rolling Window).
- **Monitoring**: Metric `preview_priority_high_count` (aggregiert pro Team).

### Label: `priority:default` (Standard)

- **Bedeutung**: Normaler PR-Workflow.
- **Effekt**:
  - Provisionierung nur wenn `active_previews < max_active_previews`.
  - Bei Kapazitätsengpass: Queue-Eintrag (FIFO).
- **Keine Label-Limitierung**.

### Label-Enforcement

- Labels werden automatisch durch GitHub-Workflow gesetzt (`opened` Event → `priority:default` falls nicht explizit gesetzt).
- Manuelle Änderung von `priority:default` zu `priority:high` triggert Budget-Check (siehe Abschnitt Priorisierungs-Budget).

## Monitoring und Metriken

Folgende Prometheus-Metriken müssen durch Preview-Workflow exponiert werden:

```prometheus
# Aktuelle Anzahl laufender Previews
preview_active_count{priority="high|default"}

# Durchschnittliche Lifetime eines Previews (in Stunden)
preview_lifetime_hours_bucket

# Cleanup-Fehlerrate
preview_cleanup_failures_total

# Queue-Länge
preview_queue_length

# Kosten pro Preview (täglich, geschätzt)
preview_cost_estimated_eur{preview_id="<branch-name>"}

# Budget-Auslastung (Prozent)
preview_budget_utilization_percentage
```

### Alerts

```yaml
# dev/monitoring/prometheus/alert-rules.yml

- alert: PreviewCapacityExhausted
  expr: preview_active_count >= 10
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Preview-Kapazität erschöpft (10/10 aktiv)"
    description: "Neue PRs werden in Queue eingereiht."

- alert: PreviewCleanupFailed
  expr: increase(preview_cleanup_failures_total[5m]) > 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Preview-Cleanup fehlgeschlagen"
    description: "Manuelle Intervention erforderlich (SLA: 24h)."

- alert: PreviewBudgetSoftLimit
  expr: preview_budget_utilization_percentage >= 90
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "Preview-Budget bei 90% (Soft-Limit)"
    description: "Product-Owner Review erforderlich."
```

## Abhängigkeiten zu anderen Governance-Dokumenten

- `docs/governance/branch-preview-lifecycle.md` (T1): Definiert Event-Trigger (`opened/synchronize/closed`).
- `docs/governance/branch-naming-conventions.md` (T2): Bestimmt welche Branches überhaupt Previews erhalten.
- `docs/governance/merge-gates-checklist.md` (T4): Merge darf Preview-Tests nicht blockieren (parallel-path).
- `docs/governance/preview-platform-comparison.md` (T6): Kostenmodell und Plattform-Constraints.

## Review und Aktualisierung

- **Initiales Review**: Nach Tag 30 der Pilot-Phase (Datenauswertung).
- **Budget-Cap Definition**: Nach Tag 90 der Pilot-Phase.
- **Reguläre Reviews**: Quartalsweise oder bei signifikanten Kostenänderungen.
- **Owner**: Product-Owner + DevOps/SRE Team.

---

**Erstellt:** 2026-02-19  
**Letzte Aktualisierung:** 2026-02-19  
**Status:** Aktiv (Pilot-Phase)  
**Nächstes Review:** Tag 30 (2026-03-21)
