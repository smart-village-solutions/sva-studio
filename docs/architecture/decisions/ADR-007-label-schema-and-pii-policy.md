# ADR-007: Label Schema & PII Policy

**Datum:** 6. Februar 2026
**Status:** Accepted
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
- PII darf **nicht frei** in Labels auftauchen und in Payloads nur minimiert, redacted oder zweckgebunden erscheinen.
- E-Mail-Masking, Secret-Redaction und JWT-/Query-Parameter-Redaction sind verpflichtend.
- Tokens und tokenhaltige Redirect- oder Logout-URLs sind in operativen Logs generell unzulaessig.
- Pseudonyme technische IDs (`session_user_id`, `actor_account_id`, `db_keycloak_subject`) gelten ebenfalls als personenbeziehbar und duerfen nur bei begruendeter Betriebsnotwendigkeit im Payload erscheinen.

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

**Mitigation:** Standardisierte Payload-Felder ermoeglichen Details ohne Indexierung, bleiben aber weiter dem Prinzip der Datenminimierung unterworfen.

---

## Implementierung / Ausblick

- [x] Logger-Redaction-Filter fuer `password`, `token`, `authorization`, `api_key`, `secret` und sensitive Query-Parameter.
- [x] OTEL Processor mit Label-Whitelist und Drop-Policy.
- [x] Promtail Relabeling Rules zur Entfernung verbotener Labels.
- [x] Tests fuer Label-Validation & PII-Redaction.
- [x] Dokumentation des Schemas in Logging-/Monitoring-Dokumentation.

---

## Migration / Exit-Strategie

Die Policy ist stack-agnostisch und kann bei Backend-Wechsel unverändert übernommen werden. Änderungen sind versionierbar über ADR-Supersedes.

---

**Links:**
- [ADR-004: Monitoring Stack – Loki, Grafana & Prometheus](ADR-004-monitoring-stack-loki-grafana-prometheus.md)
- [Logging-Architektur](../logging-architecture.md)
