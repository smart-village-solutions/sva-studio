# ADR-007: Label Schema & PII Policy

**Datum:** 6. Februar 2026
**Status:** ⏳ Proposed
**Kontext:** Label-Standards, PII-Redaction & Retention
**Entscheider:** SVA Studio Team

---

## Entscheidung

Wir definieren ein **striktes Label-Schema** mit **Whitelist**, **PII-Redaction** und **Retention-Regeln**:

**Erlaubte Labels (Low Cardinality):**
- `workspace_id` (mandatory)
- `component`
- `environment`
- `level`
- `status_code`

**Verbotene Labels (High Cardinality / PII):**
- `user_id`, `session_id`, `email`, `request_id`, `token`, `ip`

**PII Policy:**
- PII wird **vor Export** redacted (Logger + OTEL Processor).
- PII darf **nur im Payload** auftauchen, nie als Label.
- E-Mail-Masking und Secret-Redaction sind verpflichtend.

**Retention:**
- **Development:** 7 Tage (lokaler Stack)
- **Production:** 90 Tage Standard, Audit-Logs bis 2 Jahre

---

## Kontext und Problem

Multi-Tenancy und DSGVO erfordern **strikte Trennung und Minimierung**. Labels sind indexiert und führen bei hoher Kardinalität zu Performance- und Kostenproblemen. Ohne klare Regeln drohen:

- **Daten-Leaks** zwischen Workspaces
- **Kostenexplosion** durch hohe Label-Kardinalität
- **DSGVO-Verstöße** durch Speicherung personenbezogener Daten in Labels

Die Entscheidung legt daher verbindliche Regeln fest, die **technisch durchgesetzt** werden.

---

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
|---|---|---|---|
| **A: Strikte Label-Whitelist + Redaction (empfohlen)** | Sicherheit, DSGVO, Skalierung | 9/10 | Klare Regeln, sicher und stabil ✅ |
| B: Freies Labeling | Flexibilität | 3/10 | Hohe Kardinalität, Security-Risiko |
| C: Partielles Labeling (Guidelines ohne Enforcement) | Einfach | 5/10 | Regelbruch schwer erkennbar |

### Warum Option A?

- ✅ **Sicherheit:** Keine PII in Labels → minimiertes Leak-Risiko.
- ✅ **Performance:** Begrenzte Label-Cardinality.
- ✅ **Compliance:** DSGVO-konform durch Redaction und Retention.
- ✅ **Observability-Qualität:** Einheitliche Filterbarkeit nach workspace_id.

---

## Trade-offs & Limitierungen

### Pros
- ✅ Klare Regeln für Entwickler und Ops.
- ✅ Skalierbarkeit durch stabile Label-Kardinalität.
- ✅ Einfache Multi-Tenancy-Isolation.

### Cons
- ❌ Weniger Flexibilität bei Ad-hoc-Labels.
- ❌ Zusätzlicher Implementierungsaufwand (Processor + Tests).

**Mitigation:** Standardisierte Payload-Felder ermöglichen Details ohne Indexierung (z. B. `user_id` als Feld).

---

## Implementierung / Ausblick

- [ ] Logger-Redaction-Filter für `password`, `token`, `authorization`, `api_key`, `secret`.
- [ ] OTEL Processor mit Label-Whitelist und Drop-Policy.
- [ ] Promtail Relabeling Rules zur Entfernung verbotener Labels.
- [ ] Tests für Label-Validation & PII-Redaction.
- [ ] Dokumentation des Schemas in `docs/development/monitoring-stack.md`.

---

## Migration / Exit-Strategie

Die Policy ist stack-agnostisch und kann bei Backend-Wechsel unverändert übernommen werden. Änderungen sind versionierbar über ADR-Supersedes.

---

**Links:**
- [ADR-004: Monitoring Stack – Loki, Grafana & Prometheus](ADR-004-monitoring-stack-loki-grafana-prometheus.md)
- [Design: Docker-basierter Monitoring Stack](../../../openspec/changes/add-docker-monitoring-dev-stack/design.md)
