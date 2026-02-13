# 📊 IAM-Proposal Review Summary

**Datum:** 21. Januar 2026
**Status:** 🔴 **CONDITIONAL APPROVAL** – Mit Auflagen
**Aufwand für Remediation:** 60–90 Task-Tage (+20–30% Overhead)

---

## Executive Summary

Das IAM-Proposal ist **konzeptionell solid**, aber **nicht produktionsreif** ohne folgende Maßnahmen:

| Agent | Bewertung | Kritische Funde | Empfehlung |
|-------|-----------|-----------------|------------|
| **Architecture** | ✅ Konform | 6 Findings, 3 ADRs nötig | Akzeptieren + ADRs |
| **Security** | ⚠️ Bedingt | 6 Blocker, 6 mittlere Risiken | Conditional + 60d Fixes |
| **Operations** | 🔴 LOW | 8 kritische Risiken, 15 Runbooks fehlen | +4–6 Wochen Remediation |
| **Interoperability** | 🟡 MITTEL | 4 Blocker (Export/Import, APIs fehlen) | +4 Wochen Implementierung |
| **Accessibility** | 🔴 Offen | Keine WCAG-Anforderungen spezifiziert | +20–25% Aufwand in Phase 1–3 |

---

## 🎯 Gesamtfindlings nach Priorität

### 🔴 **BLOCKER (vor Code-Start)**

#### Architecture (3 ADRs)
1. **ADR #1: Keycloak Vendor Lock-in Mitigation**
   - Problem: `keycloakId` als UUID-Mapping ist starr
   - Lösung: Multi-IdP-Schema mit `identity_providers` Tabelle
   - Aufwand: 8 Tage
   - Status: ⏳ ADR schreiben + Approval

2. **ADR #2: Token Management & Security Policy**
   - Problem: Error-Handling, Rate-Limiting, CSRF unterspecifiziert
   - Lösung: Detaillierte Threat-Modelling + Security-Defaults
   - Aufwand: 10 Tage
   - Status: ⏳ ADR schreiben + Approval

3. **ADR #3: Permission Composition & Conflicts**
   - Problem: Unklar ob Permissions additiv (OR) oder restriktiv (AND)
   - Lösung: Explizite Conflict-Resolution-Strategie
   - Aufwand: 5 Tage
   - Status: ⏳ ADR schreiben + Approval

#### Security (6 Blocker)
4. **Token Storage: HttpOnly-Only**
   - Problem: `localStorage` ist XSS-anfällig
   - Lösung: HttpOnly Cookies + SameSite=Strict
   - Aufwand: 5 Tage
   - Status: 🔴 MUSS vor Phase 1

5. **DSGVO Right-to-Erasure (Löschung)**
   - Problem: Keine Prozesse für Nutzer-Löschungen
   - Lösung: Soft-Delete + Hard-Delete mit Retention-Policy
   - Aufwand: 10 Tage
   - Status: 🔴 MUSS vor Phase 1

6. **Consent & Legal Basis Management**
   - Problem: Keine First-Login-Zustimmung zu Datenschutz
   - Lösung: Legal-Basis + Versionierung + Accept-UI
   - Aufwand: 5 Tage
   - Status: 🔴 MUSS vor Phase 1

7. **Brute-Force Protection**
   - Problem: Account-Lockout nicht spezifiziert
   - Lösung: 5 attempts → 30min lockout + Alerts
   - Aufwand: 7 Tage
   - Status: 🔴 MUSS vor Phase 1

8. **Secrets Management (Client-Secret)**
   - Problem: Keycloak Client-Secret könnte im Code landen
   - Lösung: Vault-Integration (HashiCorp Vault / AWS Secrets Manager)
   - Aufwand: 4 Tage
   - Status: 🔴 MUSS vor Phase 1

9. **Public-Key Caching & Stale Fallback**
   - Problem: Keycloak-Key-Rotation könnte Token-Validierung brechen
   - Lösung: 24h Cache mit Stale-Fallback + Alarm
   - Aufwand: 3 Tage
   - Status: 🔴 MUSS vor Phase 1

#### Operations (4 Blocker)
10. **Keycloak Failure Scenarios**
    - Problem: Keine Grace Period, wenn Keycloak down ist
    - Lösung: Lokal gecachte JWT bis 1h alt, dann deny
    - Aufwand: 8 Tage
    - Status: 🔴 MUSS vor Production

11. **Redis Cache Konsistenz**
    - Problem: 1h TTL zu lang → Veraltete Permissions
    - Lösung: Event-basierte Invalidation via Pub/Sub
    - Aufwand: 10 Tage
    - Status: 🔴 MUSS vor Phase 3

12. **Keine Datenbank-Rollback-Strategie**
    - Problem: Fehlgeschlagene Migrations → keine Rollback
    - Lösung: Flyway/Alembic Rollback-Skripte für alle Migrations
    - Aufwand: 5 Tage
    - Status: 🔴 MUSS vor Phase 2

13. **RLS Policy Testing**
    - Problem: RLS-Fehler → Datenleck zwischen Orgs
    - Lösung: Explizite Integration Tests mit RLS-Violations
    - Aufwand: 8 Tage
    - Status: 🔴 MUSS vor Phase 2

#### Interoperability (4 Blocker)
14. **No Export/Import APIs**
    - Problem: Kommune KANN NICHT wechseln ohne Datenverlust
    - Lösung: GraphQL Export-Mutations + Bulk-Import
    - Aufwand: 80 Stunden (~2 Wochen)
    - Status: 🔴 MUSS vor Production

15. **No OpenAPI/SDK Documentation**
    - Problem: Partner können nicht integrieren
    - Lösung: OpenAPI Spec + TypeScript SDK
    - Aufwand: 20 Stunden
    - Status: 🔴 MUSS vor Production

16. **No Webhooks/Event-APIs**
    - Problem: Echtzeitliche Synchronisation unmöglich
    - Lösung: Event-basierte Webhooks für Org/Role/Permission Changes
    - Aufwand: 60 Stunden (~1,5 Wochen)
    - Status: 🔴 MUSS vor Production

17. **No API Versioning Strategy**
    - Problem: Breaking Changes können externe Systeme crashen
    - Lösung: Semantic Versioning + Deprecation-Policy
    - Aufwand: 10 Stunden
    - Status: 🔴 MUSS vor Phase 1

---

### 🟡 **HIGH-PRIORITY (Q1 2026, vor Phase 3)**

18. **Hierarchy Query Optimierung** – ltree/Material Path (8 Tage)
19. **CSRF Protection Details** – Token + SameSite Policy (3 Tage)
20. **Session-Timeout mit Warnung** – 30min Inactivity (5 Tage)
21. **Failed-Auth Logging** – Brute-Force Detection (4 Tage)
22. **Audit-Log Hashing** – Authenticity Verification (3 Tage)
23. **MFA Policy Details** – TOTP vs Push vs SMS (2 Tage)
24. **Bulk-Operations APIs** – User/Role Bulk Import (40 Stunden)
25. **JWT Claims Standardisierung** – Structured Claims (15 Stunden)

---

### 🟢 **NICE-TO-HAVE (später)**

- Passkey Support (WebAuthn)
- SAML/LDAP Integration
- Reporting Dashboards
- Graphical Admin UI (aktuell Tasks nur Backend)

---

## 📋 Zusammenfassung nach Perspektive

### ✅ **Architecture & FIT Compliance** (KONFORM ✅)

**Stärken:**
- Keycloak/OIDC minimiert Vendor-Lock-in ✅
- Hierarchische Multi-Tenancy exemplarisch ✅
- Redis-Caching mit Performance-Ziel (< 50ms) ✅
- Audit-Logging First-Class ✅
- TypeScript strict-mode all-layer ✅

**Kritiken:**
- `keycloakId` Schema zu monolithic (ADR #1)
- Error-Handling unterspecifiziert (ADR #2)
- Permission-Conflicts unklar (ADR #3)

**Empfehlung:** ✅ Akzeptieren + 3 ADRs schreiben

---

### 🔐 **Security & Privacy** (CONDITIONAL ⚠️)

**Kritische Risiken (🔴 6 Blocker):**
1. Token Storage (HttpOnly-Only)
2. DSGVO Löschung (Right-to-Erasure)
3. Consent Management
4. Brute-Force Protection
5. Secrets Management (Vault)
6. Public-Key Caching

**Mittlere Risiken (🟡 6):**
- CSRF Protection, Session-Timeouts, MFA-Policy, RLS-Testing, Audit-Log-Hashing, Failed-Auth-Logging

**DSGVO/BSI/CRA Compliance:**
- 🟡 Partial – Löschung & Secrets müssen vor Phase 1

**Empfehlung:** ⚠️ Conditional Approval + 60 Task-Tage Overhead

---

### 🚀 **Operations & Reliability** (LOW 25%)

**Betriebsreife:** 🔴 **NICHT PRODUKTIONSREIF**

**8 kritische Betriebsrisiken:**
1. Keycloak-Ausfall → Kein Login (Grace Period unklar)
2. Redis Cache-Konsistenz (1h TTL zu lang)
3. Datenbank-Migrationsfehler (kein Rollback)
4. RLS-Policy-Fehler (Datenleck)
5. Performance-Regression (50ms nicht validiert)
6. Audit-Archivierung (DSGVO-Compliance)
7. Feature-Flag-Automation (Unkontrollierter Rollout)
8. Fehlende Incident-Response Prozesse

**Fehlende Dokumentation:**
- 8 Runbooks Deployment & Updates
- 6 Runbooks Incident & Failover
- 6 Runbooks Monitoring & Troubleshooting
- 5 Runbooks Maintenance & Compliance

**Empfehlung:** 🔴 4–6 Wochen Remediation + 15 Runbooks vor Production

---

### 🔗 **Interoperability & Data** (MITTEL 65%)

**Gesamtbewertung:** 🟡 **KEINE MIGRATION MÖGLICH**

**4 BLOCKER (vor Production):**
1. ❌ No Export/Import APIs (80h)
   - Kommune kann NICHT wechseln
2. ❌ No API Documentation (20h)
   - Partner können nicht integrieren
3. ❌ No Webhooks/Event-APIs (60h)
   - Echtzeitliche Sync unmöglich
4. ❌ No API Versioning Strategy (10h)
   - Breaking Changes riskant

**3 HIGH-PRIORITY (Q1 2026):**
- JWT-Claims Standardisierung (15h)
- Bulk-Operation APIs (40h)
- GraphQL Implementation (36h)

**Leitfrage:** "Kann eine Kommune morgen wechseln?"
- **Heute:** ❌ NEIN
- **Nach P0-Fixes:** ✅ JA (4 Wochen)

**Empfehlung:** 🔴 P0-Blocker MUSS vor Production gelöst werden

---

### ♿ **UX & Accessibility** (NICHT WCAG AA)

**Gesamtkonformität:** 🔴 **NICHT WCAG 2.1 AA-KONFORM** (ohne Specs)

**7 kritische Accessibility-Gaps:**

| Aspekt | Status | Aufwand |
|--------|--------|---------|
| Tastaturbedienbarkeit | 🔴 Offen | 8 Tage |
| Screenreader (ARIA/Semantik) | 🔴 Offen | 12 Tage |
| Error-Messages (accessible) | 🔴 Kritisch | 5 Tage |
| Focus-Management (Dialoge) | 🔴 Kritisch | 8 Tage |
| 2FA-Accessibility | 🔴 Kritisch | 6 Tage |
| Org-Switch UI | 🔴 Offen | 4 Tage |
| Kontrast (4.5:1 minimum) | ⚠️ Offen | 3 Tage |

**Kritische Szenarien:**
- Session-Timeout-Dialog ohne Warnung (nicht accessible)
- 2FA OTP-Input nicht Copy-Paste-freundlich
- Error-Messages nur HTTP-Codes (nicht accessible)
- Org-Navigation nicht Keyboard-navigierbar

**Leitfrage:** "Können blinde/motorisch behinderte Nutzer das System nutzen?"
- **Heute:** ❌ NEIN
- **Nach Fixes:** ✅ JA (aber +20–25% Aufwand)

**Empfehlung:** 🟡 Accessibility-Requirements in Phase 1–3 integrieren + +20–25% Zeitpuffer

---

## 📊 Gesamtaufwand-Schätzung

| Phase | Basis-Aufwand | Remediation-Aufwand | Total |
|-------|----------------|---------------------|-------|
| **Phase 1** | 40 Tage | 25 Tage (Security, ADRs, Accessibility) | **65 Tage** |
| **Phase 2** | 30 Tage | 20 Tage (RLS Testing, Interop, Ops) | **50 Tage** |
| **Phase 3** | 50 Tage | 25 Tage (Caching, Audit, Testing) | **75 Tage** |
| **Production** | 0 Tage | 40 Tage (Runbooks, Deploy, Monitoring) | **40 Tage** |
| **Total** | **120 Tage** | **110 Tage** | **230 Tage** |

**+91% Overhead gegenüber Basis-Schätzung!**

---

## ✅ Approval Gate & Gating Criteria

### Vor Phase 1 Implementation

- [ ] **3 ADRs** approved (Architecture #1–3)
- [ ] **6 Security Blockers** spezifiziert & geplant
- [ ] **Threat-Modelling** durchgeführt (STRIDE)
- [ ] **Keycloak-Version & Security-Posture** geklärt
- [ ] **Accessibility-Requirements** in Tasks integriert
- [ ] **180 Task-Tage** budgetiert statt 120
- [ ] **Monitoring/Observability-Plan** erstellt
- [ ] **Export/Import API Design** finalisiert

### Vor Phase 2 Start

- [ ] Phase 1 **100% done** mit allen Tests grün
- [ ] **RLS-Policy Tests** 100% coverage
- [ ] **Performance-Tests** validieren < 50ms
- [ ] **4 Operability Runbooks** dokumentiert

### Vor Phase 3 Start

- [ ] Phase 2 **100% done**
- [ ] **Redis Caching** Event-basiert invalidiert
- [ ] **Interop APIs** (Export/Import/Webhooks) spezifiziert

### Vor Production Deployment

- [ ] Alle **15 Runbooks** dokumentiert & getestet
- [ ] **Penetration-Testing** durchgeführt
- [ ] **DSGVO Data Processing Agreement** mit Keycloak-Betreiber
- [ ] **Audit-Log Retention Policy** dokumentiert
- [ ] **Disaster Recovery Plan** (RTO/RPO) getestet
- [ ] **Feature-Flag Strategy** für graduelle Rollout
- [ ] **SLA/OLA Monitoring** konfiguriert

---

## 🎯 Nächste Schritte (Prioritätsreihenfolge)

### 🔴 **Diese Woche (KW 3)**
1. [ ] Stakeholder-Alignment auf Findings & Aufwand-Schätzung
2. [ ] 3 ADRs schreiben (Architecture #1–3)
3. [ ] Threat-Modelling durchführen (STRIDE)
4. [ ] Team-Planung für 180 Task-Tage (statt 120)

### 🟡 **Nächste Woche (KW 4)**
1. [ ] ADRs approved & merged
2. [ ] Security Blockers in Tasks integriert
3. [ ] Runbooks-Templates erstellen
4. [ ] Export/Import API Design-Docs

### 🟢 **Phase 1 Start (KW 5)**
1. [ ] 3 ADRs fully implemented
2. [ ] 6 Security Blockers implementiert
3. [ ] Accessibility-Tasks parallel
4. [ ] Performance-Baselines gesetzt

---

## 📋 Anhang: Review-Quellen

Die folgenden Agenten haben detaillierte Reviews durchgeführt:

| Agent | Dokument | Funde | Empfehlung |
|-------|----------|-------|------------|
| **Architecture** | ADR-Templates, Architektur-Checklist | 6 Findings | 3 ADRs schreiben |
| **Security** | Threat-Model, Compliance-Checklist, Impl-Guide | 12 Risiken | 60d Overhead |
| **Operations** | Runbook-Templates, Incident-Response | 8 Risiken | 4–6 Wochen Remediation |
| **Interoperability** | API-Design, Export/Import-Spec | 4 Blocker | +4 Wochen Impl |
| **Accessibility** | WCAG-Conformance, Testing-Matrix | 7 Gaps | +20–25% Aufwand |

---

**Zusammenfassung:** Das Proposal ist konzeptionell gut, aber braucht **substanzielle Arbeit** für Production-Readiness. Mit den empfohlenen Maßnahmen wird es ein **robust, secure, interoperable System**.

**Final Recommendation: ⚠️ CONDITIONAL APPROVAL – mit 180 Task-Tagen statt 120**
