# 🎯 IAM-Proposal: Action Card (1-Pager)

## Status: ⚠️ CONDITIONAL APPROVAL

```
┌─────────────────────────────────────────────────────────────────┐
│  GESAMTBEWERTUNG DES IAM-PROPOSALS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Architecture        ✅ KONFORM (+ 3 ADRs nötig)               │
│  Security           ⚠️  BEDINGT (6 Blocker, 60d Overhead)     │
│  Operations         🔴 LOW (4-6 Wochen Remediation)           │
│  Interoperability   🟡 MITTEL (4 API-Blocker)                 │
│  Accessibility      🔴 NICHT WCAG AA (+25% Aufwand)           │
│                                                                 │
│  TOTAL EFFORT:      180 Task-Tage (+50% vs. Baseline 120d)    │
│  GO/NO-GO:          ✅ GO (mit Auflagen)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔴 MUST-DO VOR CODE-START (17 Items)

### Architektur (3 ADRs)
- [ ] ADR #1: Keycloak Multi-IdP Schema (nicht nur UUID)
- [ ] ADR #2: Token Security Policy (ErrorHandling, Rate-Limiting, CSRF)
- [ ] ADR #3: Permission Composition Rules (Additiv vs. Restriktiv)

### Security (6 Fixes)
- [ ] HttpOnly-Only Token Storage (keine localStorage!)
- [ ] DSGVO Right-to-Erasure (Soft-Delete + Hard-Delete)
- [ ] Consent Management (Legal-Basis + First-Login)
- [ ] Brute-Force Protection (5 attempts → 30min lockout)
- [ ] Secrets Vault-Integration (Keycloak Client-Secret)
- [ ] Public-Key Caching + Stale-Fallback (24h + alarm)

### Operations (4 Items)
- [ ] Keycloak-Failure Grace Period (1h local JWT cache)
- [ ] Redis Cache Invalidation (Event-basiert, nicht TTL)
- [ ] DB-Rollback-Strategie (Flyway für alle Migrations)
- [ ] RLS-Policy Integration-Tests (Org-Isolation verifizieren)

### Interoperability (4 APIs)
- [ ] Export/Import API (GraphQL Mutations + Bulk-Import)
- [ ] OpenAPI Spec + TypeScript SDK
- [ ] Webhooks/Event-APIs (Org/Role/Permission Changes)
- [ ] API-Versioning & Deprecation-Policy

**Aufwand:** ~90 Tage
**Timeline:** 3–4 Wochen parallel mit Phase 1

---

## 🟡 HIGH-PRIORITY (vor Phase 3)

- [ ] Hierarchy Query Optimierung (ltree/Material Path)
- [ ] CSRF Protection Details (Token + SameSite)
- [ ] Session-Timeout mit Warnung (30min + "Abmelden in 2 Min"-UI)
- [ ] Failed-Auth Logging (für Brute-Force Detection)
- [ ] Audit-Log Authenticity (Hashing/Signatures)
- [ ] MFA Policy Spezifizierung (TOTP vs Push vs SMS)

**Aufwand:** ~45 Tage
**Timeline:** Q1 2026

---

## 📋 Kritische Dokumente (Lesereienfolge)

1. **Diese Datei** (1 min) ← Du bist hier
2. [REVIEW-SUMMARY.md](REVIEW-SUMMARY.md) (10 min) – Alle Findings aggregiert
3. [proposal.md](proposal.md) (5 min) – Business Case
4. [design.md](design.md) (30 min) – Technische Details
5. [tasks.md](tasks.md) (15 min) – Implementierungs-Roadmap
6. **ADR-Templates** (aus Architecture-Agent) – Details zu 3 ADRs

---

## 🚀 Rollout-Plan

### Woche 1–2: Approval & Planning
```
Week 1
├─ Review-Sync mit Stakeholder (1h)
├─ ADRs schreiben + approval process (3–5 days)
├─ Threat-Modelling (STRIDE) (2 days)
└─ Team-Planung für 180 days

Week 2
├─ ADRs merged
├─ Runbooks-Template erstellen
└─ Export/Import API Design-Docs starten
```

### Woche 3–8: Phase 1 Implementation
```
Phase 1 (6 Wochen, paralleles 2-Team-Setup)

Team A: Security Fixes
├─ Token Storage (1 Woche)
├─ DSGVO Löschung (1 Woche)
├─ Brute-Force (1 Woche)
└─ Vault Integration (3 days)

Team B: Core IAM + Accessibility
├─ Keycloak OIDC (1 Woche)
├─ Token-Validator (1 Woche)
├─ Login-Flow + WCAG (1 Woche)
└─ Unit-Tests + E2E (1 Woche)

Team C: Operations
├─ Runbooks schreiben (1 Woche)
├─ Monitoring-Setup (1 Woche)
└─ Feature-Flags (3 days)
```

### Woche 9–10: Phase 2 Start
- [ ] Phase 1 ✅ 100% done, alle Tests grün
- [ ] RLS-Tests ✅ 100% coverage
- [ ] Performance-Tests ✅ < 50ms validated
- [ ] Go Phase 2

---

## 💰 Budget & Timeline

| Komponente | Aufwand | Timeline |
|-----------|---------|----------|
| Baseline (3 Phasen) | 120 days | 12 Wochen |
| Remediation | +110 days | +8 Wochen parallel |
| **Total** | **230 days** | **12 Wochen** |
| **Overhead %** | **+91%** | – |

**Strategie:** Paralleles 3-Team-Setup → 12 Wochen gesamte Lösung
(statt sequenziell 20 Wochen)

---

## ✅ Approval Gate Checklist

```
PHASE GATE: Vor Code-Start (KW 3–4)
├─ [ ] Stakeholder Alignment auf Findings
├─ [ ] 3 ADRs Written & Approved
├─ [ ] Threat-Model Durchgeführt
├─ [ ] 180 Task-Tage Budgetiert
├─ [ ] Keycloak v.X.Y Security-Posture Geklärt
├─ [ ] Team assignments KW 5 ff. Done
└─ [ ] Runbooks-Templates erstellt

GO/NO-GO DECISION: ✅ GO (mit Auflagen)
```

---

## 🎯 Top 3 Priorities

1. **🔴 Security Blockers** – 6 Items, 20–30 Tage
   - Token Storage, DSGVO, Consent, Brute-Force, Secrets, Keys
   - Blocker für Phase 1 Start

2. **🟡 Interop APIs** – 4 Items, 25–30 Tage
   - Export/Import, OpenAPI, Webhooks, Versioning
   - Blocker für Production

3. **🟢 Operations Runbooks** – 15 Items, 20–25 Tage
   - Deployment, Incident, Monitoring, Maintenance
   - Blocker für Live-Betrieb

---

## 📞 Feedback & Questions

**Feedback-Kanäle:**
- Architecture Questions? → [architecture.agent.md Specs]
- Security Concerns? → [security-privacy.agent.md Specs]
- Ops/Reliability? → [operations-reliability.agent.md Specs]
- APIs/Interop? → [interoperability-data.agent.md Specs]
- Accessibility? → [ux-accessibility.agent.md Specs]

**Next Sync:** KW 3 (Approval Gate)

---

**Status:** ✅ **READY FOR STAKEHOLDER REVIEW**
**Last Updated:** 21. Januar 2026
