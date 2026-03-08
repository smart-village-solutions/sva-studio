# 📌 INTEROPERABILITY REVIEW FINDINGS – QUICK REFERENCE

**Reference:** [Full Review](interoperability-review-iam.md) | [Executive Summary](interoperability-review-iam-EXECUTIVE-SUMMARY.md)  
**Date:** 21. Januar 2026

---

## 🎯 TOP 5 CONCERNS

### 1️⃣ **KEINE EXPORT/IMPORT-APIs** 🔴
- **Problem:** Kommune kann nicht wechseln
- **Evidence:** Section 5, Tasks.md nur Audit-Logs
- **Fix:** +3 Wochen, 80h
- **Blocker:** JA

### 2️⃣ **KEINE API-DOKUMENTATION** 🔴
- **Problem:** Partner können nicht integrieren
- **Evidence:** Section 11, Kein OpenAPI, keine SDKs
- **Fix:** +1 Woche, 20h (auto-generated)
- **Blocker:** JA

### 3️⃣ **KEINE WEBHOOK/EVENT-APIs** 🔴
- **Problem:** Cascading-Provisioning impossible
- **Evidence:** Section 7, Design spricht nur von Cache
- **Fix:** +2 Wochen, 60h
- **Blocker:** JA

### 4️⃣ **API-VERSIONIERUNG UNKLAR** 🔴
- **Problem:** Breaking Changes können Partner brechen
- **Evidence:** Section 1, Keine Policy
- **Fix:** +3 Tage, 10h
- **Blocker:** JA

### 5️⃣ **JWT-CLAIMS UNKLAR** 🟡
- **Problem:** "org", "roles" nicht präzise definiert
- **Evidence:** Section 2, Claims-Schema incomplete
- **Fix:** +5 Tage, 15h
- **Blocker:** NEIN (aber wichtig)

---

## 🗺️ API-DESIGN LANDSCAPE

### Current: ❌ FEHLT

```
API-Style:      Unklar (REST vs GraphQL?)
Versionierung:  Nicht definiert
Documentation: Nicht existent
SDKs:          Nicht existent
Webhooks:      Nicht existent
```

### Recommended: ✅ HYBRID

```
REST:            Primary (simple CRUD)
GraphQL:         Secondary (complex queries)
Documentation:   OpenAPI 3.0 (auto-generated)
SDKs:            Python, TypeScript, Go (auto-generated)
Webhooks:        Event-driven (Kafka/Redis)
Versioning:      /api/iam/v1/... in URL
```

---

## 💾 EXPORT/IMPORT GAPS

| Entity | Export | Import | Status | Priority |
|--------|--------|--------|--------|----------|
| Organizations | ❌ | ❌ | Missing | P0 |
| Users | ❌ | ❌ | Missing | P0 |
| Roles | ❌ | ❌ | Missing | P0 |
| Permissions | ❌ | ❌ | Missing | P0 |
| Role-Assignments | ❌ | ❌ | Missing | P0 |
| Audit-Logs | ✅ | ❌ | Partial | P1 |

**Impact:** COMMUNE CANNOT EXIT without new APIs

---

## 🔗 EVENT-STREAMING MISSING

**Current State:** ❌ NONE

**Needed For:**
- [ ] Media-System notified when permissions change
- [ ] Content-CMS knows when new org added
- [ ] Analytics ingests real-time audit events
- [ ] External IdP stays in sync

**Solution:** 
- Kafka/Redis topics for IAM events
- Webhook subscriptions (REST API)
- GraphQL subscriptions (real-time clients)

---

## 🔐 JWT CLAIMS SPEC

### URGENT SPECIFICATION NEEDED

```typescript
// What we NEED:
{
  // Standard OIDC (from Keycloak)
  iss: "https://keycloak.sva-studio.de/auth/realms/sva"
  sub: "<keycloak-user-id>"
  aud: ["sva-studio-client", "sva-studio-api"]
  exp, iat, nbf, jti
  
  // SVA Custom (need PRECISE SPEC)
  email: "user@example.de"
  name: "Max Mustermann"
  
  organizations: [
    {
      id: "org-uuid",
      name: "Gemeinde München",
      type: "municipality",
      path: ["county-uuid", "org-uuid"]  // Full ancestor path?
    }
  ]
  current_organization: "org-uuid"  // Which one?
  
  roles: {
    system_roles: ["user"],
    organization_roles: {
      "org-uuid": ["redakteur", "moderator"]  // Format clear?
    }
  }
}
```

**STATUS:** ⚠️ INCOMPLETE – See Section 2 for full spec

---

## 🌍 STANDARDS COMPLIANCE

### ✅ GOOD
```
OIDC Authorization Code Flow (RFC 6749)  ✅
PKCE (RFC 7636)                          ✅
JWT (RFC 7519)                           ✅
RS256 Signature (RSA-SHA256)             ✅
HttpOnly Cookies                         ✅
```

### ⏳ PLANNED FOR LATER
```
SAML 2.0                                 Q2 2026
LDAP/AD Integration                      Q2 2026
SCIM 2.0                                 Q3 2026
OAuth Device Flow                        Q2 2026
WebAuthn/Passkeys                        Q3 2026
```

### ❌ MISSING FROM SPEC
```
OIDC Metadata Endpoint (/.well-known/openid-configuration)
SVA Claims Registry (/.well-known/sva-iam-claims.json)
XACML/OPA Export for Policies
OpenAPI 3.0 Spec
GraphQL SDL
```

---

## 🚀 GO/NO-GO CHECKLIST

### MUST BE DONE (Blockers)

- [ ] Export/Import APIs fully implemented
- [ ] OpenAPI 3.0 spec published
- [ ] SDKs auto-generated (Python, TS, Go)
- [ ] Webhook/Event framework operational
- [ ] API Versioning strategy implemented
- [ ] JWT Claims fully specified
- [ ] Error handling standardized
- [ ] Rate-limiting documented

### NICE TO HAVE (Can defer to Q1)

- [ ] SAML/LDAP federation
- [ ] SCIM 2.0 support
- [ ] Advanced reporting/analytics
- [ ] GraphQL (REST primary first)
- [ ] Multi-language documentation

### ONLY THEN: 🟢 LAUNCH READY

---

## 📊 MIGRATION STRATEGY

### Timeline

**Week 1:** Versionierung + OpenAPI setup  
**Week 2–3:** Export/Import APIs  
**Week 3–4:** Event/Webhook Framework  
**Week 5+:** Polish + Testing  

### Exit-Scenario: "Gemeinde wechselt zu Konkurrenz"

```
Day 1:   Export complete IAM state (Orgs, Users, Roles, Logs)
Day 2:   Map to target system schema
Day 3:   Import dry-run in target system
Day 4:   Parallel operation (SVA + Target)
Day 5:   Final cutover
Day 6+:  Rollback window (24h emergency option)
```

**Prerequisite:** All Export/Import APIs working

---

## 💼 PARTNER INTEGRATION ROADMAP

### Phase 1 (Now – Before Launch)
- [ ] API docs published (OpenAPI)
- [ ] SDKs available
- [ ] Developer portal live

### Phase 2 (Q1 2026)
- [ ] Webhook integrations deployed
- [ ] Event schema finalized
- [ ] 3+ partners successfully integrated

### Phase 3 (Q2 2026)
- [ ] SAML/LDAP federation live
- [ ] SCIM provisioning available
- [ ] Advanced analytics integrations

---

## ⚠️ RISK MATRIX

| Risk | Severity | Likelihood | Mitigation | Effort |
|------|----------|-----------|-----------|--------|
| No Export-APIs | 🔴 High | High | Implement Export/Import | 80h |
| API Breaking Changes | 🔴 High | Medium | Versioning + Deprecation | 10h |
| Webhook Failures | 🟡 Medium | Medium | Dead-letter-queue + Retries | 15h |
| Cache-Invalidation Race | 🟡 Medium | Low | Event-driven invalidation | 16h |
| Token Leak | 🔴 High | Low | HttpOnly + CSP | 8h |
| RLS Misconfiguration | 🔴 High | Low | Code Review + Tests | 12h |

---

## 📚 SECTION MAPPING

| Section | Title | Status | Effort |
|---------|-------|--------|--------|
| 1 | API-Versionierung | 🔴 | 10h |
| 2 | JWT-Claims | 🟡 | 15h |
| 3 | REST vs GraphQL | 🟡 | 5h |
| 4 | Abwärtskompatibilität | 🟡 | 20h |
| 5 | Export/Import | 🔴 | 80h |
| 6 | OIDC Standards | 🟢 | 0h |
| 7 | Webhooks/Events | 🔴 | 60h |
| 8 | Exit-Strategie | 🟡 | 0h (doc) |
| 9 | Fehlende Endpoints | 🔴 | 40h |
| 10 | Datenmodell | 🟢 | 0h |
| 11 | API-Dokumentation | 🔴 | 20h |
| 12 | Integrations-Risiken | 🟡 | 15h |

**Total P0 Effort:** ~185 hours (4 weeks)

---

## 🎓 KEY LEARNINGS FOR TEAM

1. **API Design First** – Spec before Implementation
2. **Export-Ready by Default** – Think about Day-1 Exit
3. **Event-Driven Architecture** – For Partner Integration
4. **Documentation = Part of Development** – Not afterthought
5. **Backward Compatibility Matters** – Plan for Deprecation

---

## 📞 REVIEW OWNER

**Reviewer:** Interoperability & Data Integration Specialist  
**Email:** [contact]  
**Slack:** #iam-integrations  
**Office Hours:** Thursdays 14:00-15:00 UTC

---

**Last Updated:** 21. Januar 2026  
**Version:** 1.0  
**Status:** ✅ Ready for Stakeholder Review
