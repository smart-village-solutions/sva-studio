# Architecture & FIT Compliance Review: IAM-Proposal für SVA Studio

**Reviewer:** Architecture & FIT Compliance Agent  
**Datum:** 21. Januar 2026  
**Change-ID:** `setup-iam-identity-auth`  
**Review-Status:** 🟢 **APPROVED WITH RECOMMENDATIONS**

---

## Executive Summary

Das IAM-Proposal etabliert eine **solide, sicherheitsorientierte Grundarchitektur** für das SVA Studio mit Keycloak-Integration, Organisationshierarchien, RBAC/ABAC und Audit-Logging. Die Architektur folgt **FIT-Richtlinien** und **Clean Architecture Prinzipien** konsequent. Das System ist **zukunftsfähig**, nutzt **offene Standards** und minimiert **Vendor-Lock-in-Risiken** effektiv.

**Empfehlung: Akzeptieren mit 6 Empfehlungen zur Konkretisierung und 3 notwendigen ADRs.**

---

## 1. Gesamteinschätzung

### Konformität: ✅ **KONFORM** (mit Empfehlungen)

| Kriterium | Status | Kommentar |
|-----------|--------|----------|
| **API-first / Headless** | ✅ Konform | OIDC, REST/GraphQL-basiert, Frontend-agnostisch |
| **Modulgrenzen & Entkopplung** | ✅ Konform | IAM als separater Service, klare Schnittstellendefinition |
| **Vendor-Lock-in-Risiken** | ⚠️ Adressiert | Keycloak ist zentral, aber mit Migrationsweg dokumentierbar |
| **Offene Standards** | ✅ Konform | OIDC, JWT (RS256), OpenID Connect, SAML-vorbereitet |
| **Skalierbarkeit & Zukunftsfähigkeit** | ✅ Konform | Hierarchisch, Multi-Tenant, Caching-Strategie, Erweiterbar |
| **Clean Architecture** | ✅ Konform | Framework-agnostische Kernlogik in `packages/core/` |
| **FIT-Architekturrichtlinien** | ✅ Konform | Modulare Struktur, API-First, Headless-Ansatz |
| **Cross-Cutting Concerns** | ⚠️ Unvollständig | Logging/Error-Handling grundgelegt, aber nicht vollständig spezifiziert |

---

## 2. Stärken (4+ Erkanntes)

### ✅ **Stärke 1: Offene Standards & Keycloak-Wahl**

Die Entscheidung für Keycloak über OIDC ist **architektonisch solid**:
- **OIDC** ist federweiter Standard für Identity Management (nicht proprietär)
- **JWT mit RS256** ermöglicht Token-Validierung ohne Backend-Abhängigkeit
- **Keycloak selbst ist Open Source** (Apache 2.0) → Migrationsweg ist technisch möglich
- **SAML/LDAP/AD-Integration** bereits im Design vorbereitet
- **Alternative IdPs** sind austauschbar (Auth0, Okta → Schema-kompatibel)

**Bewertung:** Minimiert Vendor-Lock-in deutlich besser als proprietäre Lösungen.

---

### ✅ **Stärke 2: Hierarchische Multi-Tenancy-Architektur**

Das Organisationsmodell (County → Municipality → District → Org) ist **exemplarisch**:
- **Parent-Child-Relationships** sind typsicher und performant
- **Row-Level Security (RLS)** auf DB-Ebene erzwingt Isolation auch bei App-Bug
- **Hierarchische Permission-Vererbung** mit Override-Möglichkeiten ist elegant
- **Account-Synchronisation (JIT Provisioning)** reduziert Admin-Aufwand
- **ACID-Transaktionen** in Postgres garantieren Konsistenz bei kritischen Ops

**Bewertung:** Multi-Tenancy-Umsetzung folgt Best Practices (z.B. Supabase RLS Pattern).

---

### ✅ **Stärke 3: Performance-Bewusstsein & Caching-Strategie**

Das Design adressiert Skalierungschallenges explicit:
- **Permission-Cache in Redis** mit < 50ms Ziel ist realistisch
- **Cache-Invalidation über Pub/Sub** vermeidet stale data
- **Fallback zu DB bei Cache-Miss** ist robuster als nur-Redis
- **Permission-Aggregation** wird einmal pro Session berechnet + gecacht
- **Hierarchie-Queries** verwenden indexes (userId, organizationId, hierarchyLevel)

**Bewertung:** Throughput-orientierte Architektur, kein N+1-Problem erkennbar.

---

### ✅ **Stärke 4: Audit-Logging als First-Class-Citizen**

Das Auditing-Design ist **compliance-ready**:
- **Immutable `iam.activity_logs`** Tabelle (append-only, keine Updates)
- **Event-Schema-Validierung** verhindert inkonsistente Logs
- **Retention-Policy mit Legal Hold** ist DSGVO-konform
- **16+ Standard-Event-Types** decken alle kritischen Flows
- **Dashboard + Export** ermöglicht forensische Analysen

**Bewertung:** Audit-Anforderungen sind gründlich durchdacht, nicht bolted-on.

---

### ✅ **Stärke 5: Typsicherheit über alle Layer**

- **TypeScript strict-mode** durchgehend
- **JWT-Claims sind typgeprüft** (UserContext-Objekt)
- **Rollenmodell hat typed Enum-Werte** (system vs. custom)
- **ABAC-Policies sind strukturierte Daten** (nicht String-basiert)
- **Database-Schema-Validierung** (Migrations-Skripte, Tests)

**Bewertung:** Minimiert Runtime-Überraschungen bei IAM-Operationen.

---

## 3. Architekturkritiken & Befunde

### 🔴 **KRITIK 1: Keycloak-Abhängigkeit noch nicht vollständig mitigiert**

**Problem:**
- Design beschreibt Keycloak als "bereits vorhanden", aber kein Migrationsplan dokumentiert
- `iam.accounts.keycloakId` ist globales Schema-Constraint
- Token-Validierung nutzt Keycloak Public Key-Fetching (direkte Dependency)

**Risiko:**
- Wenn Keycloak-Betrieb zusammenbricht, gibt es keine Fallback-Auth
- Wechsel zu anderer IdP erfordert Schema-Refactoring (nicht nur Config)
- JWT-Token offline-validierbar? Nur mit Public Key-Caching.

**Empfehlung:**
→ **ADR erforderlich:** "Keycloak Vendor Lock-in Mitigation Strategy"
→ Explizit dokumentieren:
  - Fallback-Szenarien (Keycloak down → lokale Token-Validierung mit cached key)
  - Extraktions-Strategie (Keycloak → Standard OIDC Provider)
  - Schema-Design muss Public Key-Caching erlauben

**Konkrete Maßnahme:**
```typescript
// Token Validator sollte so aussehen:
class OIDCTokenValidator {
  private publicKeyCache: Map<string, string> = new Map() // Persistent Cache

  async validate(token: string): Promise<UserClaims> {
    let publicKey = this.publicKeyCache.get('keycloak')
    if (!publicKey) {
      publicKey = await fetchPublicKey('https://keycloak-server/.well-known/...')
      this.publicKeyCache.set('keycloak', publicKey)
    }
    // Validate offline mit gecachtem Key
    return verifyJWT(token, publicKey)
  }
}
```

---

### 🔴 **KRITIK 2: Error-Handling & Security-Policies sind unterspecifiziert**

**Problem:**
- `Token-Validierung` behandelt nur "invalid" vs. "expired" (zu simpel)
- Keine Erwähnung von: Token-Revocation, Session-Theft-Prevention, Rate-Limiting
- CORS-Konfiguration nur "zu definieren"
- PKCE-Implementation ist genannt, aber nicht fully specc'd

**Fehlende Szenarien:**
- Compromised Refresh-Token (Rotation-Strategie?)
- Token-Replay-Attacken (Nonce?)
- Cross-Site-Request-Forgery (CSRF) bei Org-Switch
- Brute-Force-Schutz auf API (nach X Failed Login Versuche, rate-limit)

**Empfehlung:**
→ **ADR erforderlich:** "Security Policy: Token Management & Attack Prevention"
→ Ausarbeiten:
  - Refresh-Token-Rotation Strategie
  - Rate-Limiting (Pro User, Pro IP)
  - Nonce-Handling für Replay-Protection
  - CSRF-Token für State-Changing Operationen

---

### 🔴 **KRITIK 3: Federation & External IdP Integration nicht ausreichend vorbereitet**

**Problem:**
- Non-Ziele nennen "AD, BundID, SAML später"
- Aber **kein Extensibility-Point** im aktuellen Design dokumentiert
- `iam.accounts` Schema hat nur `keycloakId` (monolithic)
- Falls later "AD-Integration" kommt, muss alles umgebaut werden

**Risiko:**
- "Later" wird zu Rearchitecture statt Erweiterung
- Kommunen fordern oft AD/SAML-Integration early
- Multi-IdP Scenario nicht unterstützt (ein User in AD + Keycloak?)

**Empfehlung:**
→ Generalisieren Sie Schema schon jetzt:

```sql
-- Statt:
iam.accounts (
  keycloakId TEXT UNIQUE NOT NULL,  -- ❌ Too specific
  ...
)

-- Besser:
iam.accounts (
  id UUID PRIMARY KEY,
  ...
)

iam.identity_providers (
  id UUID PRIMARY KEY,
  accountId UUID REFERENCES iam.accounts(id),
  provider TEXT ('keycloak', 'ldap', 'saml'),  -- Enum
  externalId TEXT NOT NULL,  -- keycloakId, ldapDN, samlNameID
  UNIQUE (provider, externalId),
  ...
)
```

→ Damit ist AD/SAML-Integration später nur `INSERT INTO iam.identity_providers` ohne Schema-Migration.

---

### ⚠️ **KRITIK 4: Organization-Hierarchy-Queries nicht optimiert**

**Problem:**
- Design sagt "hierarchies queryable in < 500ms mit 1000+ orgs"
- Aber: Recursive CTEs (Common Table Expressions) in Postgres sind teuer
- Kein Mention of `ltree` Extension (PostgreSQL Hierarchical Data Type)

**Szenario:** 
```sql
-- ❌ Slow bei deep hierarchies:
WITH RECURSIVE org_tree AS (
  SELECT id, name FROM organizations WHERE parentId = ?
  UNION ALL
  SELECT o.id, o.name FROM organizations o
  JOIN org_tree t ON o.parentId = t.id
)
SELECT * FROM org_tree;  -- O(n) bei 1000 orgs, 5-10 levels deep

-- ✅ Fast mit ltree:
SELECT * FROM organizations WHERE path <@ ?;  -- Index scan, O(log n)
```

**Empfehlung:**
→ Design sollte `ltree` oder Material Path Pattern (Denormalized Hierarchy) erwähnen
→ Tests mit 1000+ Orgs + 10 Levels durchführen
→ Falls Postgres 17+: RECURSIVE views mit Query Optimization

---

### ⚠️ **KRITIK 5: Role-Permission-Composition-Komplexität nicht adressiert**

**Problem:**
- Design aggregiert Permissions aus mehreren Rollen gut
- Aber: Was, wenn Rollen *widersprüchliche* Permissions haben?
  - Rolle A: "edit_news" in "sports" category
  - Rolle B: "edit_news" in "health" category
  - → User with A+B: Can edit in both? Logic nicht explizit

**Fehlende Spezifikation:**
- Sind Permissions **additive** (UNION) oder **restrictive** (INTERSECTION)?
- Szenario: Role A hat "publish_any", Role B hat "publish_only_draft" → Konflikt?
- ABAC-Policies mit Konflikten: Principal of Least Privilege? Deny wins?

**Empfehlung:**
→ **ADR erforderlich:** "Permission Composition & Conflict Resolution"
→ Explizit definieren:
  - Permissions sind **additive** (UNION – maximale Rechte gewinnen)
  - ABAC-Scope-Matching: Intersection der scopes aller Rollen
  - Deny-Override: Explizite "deny_*" Permissions schlagen "allow_*" Permissions

---

### ⚠️ **KRITIK 6: Account-Lifecycle & Deprovisioning nicht spezifiziert**

**Problem:**
- Design fokussiert auf **Provisioning** (JIT Provisioning) und **RoleAssignment**
- Aber: Was passiert wenn ein Nutzer aus Keycloak gelöscht wird?
  - Nur Keycloak-Seite? (dann hat `iam.accounts` orphaned records)
  - Auch `iam.accounts` löschen? (dann verlieren wir Audit-Trail)
  - Soft-Delete mit retained logs?

**Fehlende Szenarien:**
- User löschen sich selbst aus Keycloak
- Admin löscht User in Keycloak
- DSGVO Löschanfrage ("right to be forgotten")
- Account-Deaktivierung vs. -Löschung

**Empfehlung:**
→ In Phase 2/3 ausarbeiten, aber Schema schon vorbereiten:

```sql
iam.accounts (
  ...
  status ENUM ('active', 'deactivated', 'deleted'),
  deletedAt TIMESTAMP,  -- For audit, not actual deletion
  ...
)
```

→ Soft-Delete preserves audit trail.

---

## 4. Notwendige Architecture Decision Records (ADRs)

### **ADR #1: Keycloak Vendor Lock-in Mitigation Strategy** 🔴 KRITISCH

**Entscheidungsproblem:**
- Keycloak ist zentral in Phase 1, aber Migrationsweg unklar
- Fallback bei Ausfall nicht dokumentiert

**Zu treffen:**
1. Fallback-Token-Validation-Strategie (Public Key Caching)
2. Extraktions-Pfad (Keycloak → Andere OIDC Provider)
3. Schema-Design muss Provider-agnostisch sein

**Acceptance Criteria:**
- Public Key wird gecacht + periodisch refreshed
- Schema nutzt generalized `iam.identity_providers` (nicht `keycloakId`)
- Migrationsguide für Provider-Wechsel existiert

---

### **ADR #2: Security Policy: Token Management & Attack Prevention** 🔴 KRITISCH

**Entscheidungsproblem:**
- Token-Lifecycle ist unterspecifiziert (Rotation? Revocation? Nonce?)
- Rate-Limiting / Brute-Force-Schutz fehlt
- CSRF-Protection bei Org-Switch nicht erwähnt

**Zu treffen:**
1. Refresh-Token-Rotation Strategy (z.B. Rotation nach jedem Refresh)
2. Rate-Limiting Policy (Pro-User, Pro-IP, Pro-Org)
3. Nonce + State Parameter für OAuth2 Flow
4. Session-Theft Prevention (Device Fingerprinting? IP Lock?)

**Acceptance Criteria:**
- Refresh-Token kann nicht replayed werden (Rotation-Chain)
- API Rate-Limits sind implementiert (429 Too Many Requests)
- E2E-Tests für Brute-Force-Szenarien existieren

---

### **ADR #3: Permission Composition & Conflict Resolution** ⚠️ WICHTIG

**Entscheidungsproblem:**
- Wenn User mehrere Rollen mit widersprüchlichen Permissions hat
- Was ist das Verhalten? (Additive? Restrictive? Deny-Wins?)

**Zu treffen:**
1. Permissions sind **additive** (UNION – maximale Rechte)
2. ABAC-Scopes werden geschnitten (Intersection aller Rollen-Scopes)
3. Explizite "deny_*" Permissions schlagen "allow_*" (Secure by Default)

**Acceptance Criteria:**
- Unit-Tests für Multi-Role-Szenarien existieren
- Dokumentation für Admin-Interface beschreibt Verhalten
- Konflikt-Szenarien sind getestet (A+B + C = erwartetes Ergebnis?)

---

## 5. Technische Schulden & Langzeitwirkungen

| Schuld | Umfang | Zeitpunkt | Mitigierung |
|--------|--------|----------|------------|
| **Keycloak-Dependency** | Hoch | Phase 1+ | ADR #1 + Periodic Review |
| **Error-Handling-Underspec** | Mittel | Phase 1 | ADR #2 + Security Audit |
| **Schema-Generalisierung** | Mittel | Phase 2 | Refactor `keycloakId` → `identity_providers` |
| **Hierarchy-Optimization** | Niedrig | Phase 3+ | ltree oder Material Path später |
| **Deprovisioning-Policy** | Mittel | Phase 2-3 | DSGVO-Compliance-Review |
| **Caching-TTL-Tuning** | Niedrig | Post-Launch | Performance-Profiling |

---

## 6. Konkrete Empfehlungen: Akzeptieren / Ändern / Dokumentieren

### 🟢 **AKZEPTIEREN**

1. ✅ **Keycloak + OIDC Architecture**
   - Open Source, offene Standards, SAML/LDAP-Vorbereitung erkennbar
   - Zustimmung vorausgesetzt, dass ADR #1 vor Phase 1-Implementierung erfolgt

2. ✅ **Hierarchical Multi-Tenancy mit RLS**
   - Excellente Umsetzung, Production-ready
   - RLS-Tests müssen in E2E-Suite enthalten sein

3. ✅ **RBAC + ABAC Hybrid Model**
   - Balanced (80% Fälle mit RBAC, 20% mit ABAC)
   - Zustimmung vorausgesetzt, dass ADR #3 klare Conflict-Resolution definiert

4. ✅ **Redis Permission-Caching mit < 50ms Ziel**
   - Realistic, performant
   - Fallback-Strategie ist gut dokumentiert

5. ✅ **Immutable Audit-Logging**
   - Compliance-ready, DSGVO-konform mit Retention-Policy
   - 16+ Event-Types sind comprehensive

---

### 🟡 **ÄNDERN**

1. **Schema: `keycloakId` → `iam.identity_providers` generalisieren**
   - **Umfang:** 30-60 min Refactoring (vor Phase 1 Implementation)
   - **Grund:** Zukünftige AD/SAML-Integration ohne Schema-Migration
   - **Impact:** Keine, da Keycloak weiterhin funktioniert, aber Provider-agnostisch

2. **Error-Handling Spec ausarbeiten (ADR #2)**
   - **Umfang:** 1-2h Design, dann Phase 1.5 Implementierung
   - **Kritisch für:** Security Audit, Compliance, Brute-Force Prevention
   - **Abhängigkeit:** Vor Phase 1 E2E-Tests

3. **Rate-Limiting Policy in design.md dokumentieren**
   - **Umfang:** ½h (Add ~5 Szenarien)
   - **Grund:** Brute-Force-Schutz ist Security-Baseline
   - **Implementation:** Phase 1.5 (nach Token-Validierung)

4. **Organization-Hierarchy Query-Strategie klären**
   - **Wahl:** Recursive CTEs vs. ltree vs. Material Path
   - **Umfang:** Performance-Test mit 1000+ Orgs + 5-10 Levels
   - **Timing:** Vor Phase 2 Implementation (2.1.4 Indexes)

---

### 📝 **DOKUMENTIEREN**

1. **Migrationsguide: Keycloak-Unabhängigkeit**
   - Wie man von Keycloak zu anderem OIDC-Provider wechselt
   - Public Key Caching Strategie
   - Schema-Mapping (keycloakId → identity_providers)

2. **Admin-Dokumentation: Permission Conflicts & ABAC Policies**
   - Szenarien, wenn User mehrere Rollen mit überlappenden Permissions hat
   - Wie ABAC-Scopes kombiniert werden
   - Best Practices für Rollendefinition

3. **Security-Handbook:**
   - Token-Lifecycle & Refresh-Token-Rotation
   - Rate-Limiting Limits (pro User, pro IP, pro Org)
   - Incident Response bei Token-Compromise

4. **Developer-Guide: IAM-Service Integration**
   - Wie `canUserPerformAction()` verwenden
   - Cache-Invalidation triggern
   - Tests für Permission-Denials schreiben

---

## 7. Risiken für Zukunftsfähigkeit

### 🔴 **Hohes Risiko: Keycloak-Betrieb wird zur Kritischen Abhängigkeit**

**Szenario:**
- Phase 1 Keycloak-Integration ist complete
- Keycloak-Instanz geht down
- Benutzer können sich nicht anmelden, System ist komplett down

**Mitigation:**
- Fallback zu lokalen JWT-Validierung (gecachter Public Key)
- Keycloak-Redundancy (Clustering, Failover)
- Test: Schalte Keycloak aus, System sollte noch kurzzeitig funktionieren

**Ownership:** Phase 1 Infrastructure Review

---

### 🟡 **Mittleres Risiko: Permission-Cache-Invalidation wird zu Bottleneck**

**Szenario:**
- Rollenwechsel-Event wird publiziert
- Redis Pub/Sub verzögert sich (network latency)
- User hat alte Permissions gebunden für 1-5 Minuten

**Mitigation:**
- Redis Pub/Sub + Fallback zu Polling (10s)
- Cache-TTL auf 1h setzen (sowieso)
- Permission-Changes sind seltene Operationen (nicht Critical Path)

**Ownership:** Phase 3 Performance Testing

---

### 🟡 **Mittleres Risiko: ABAC-Policies werden komplex, schwer wartbar**

**Szenario:**
- 50+ ABAC-Policies mit 10+ Attribute-Kombinationen
- Policies beeinflussen sich gegenseitig
- Bugs sind hard to trace

**Mitigation:**
- ABAC nur für <20% der Fälle einsetzen (Design ist 80/20)
- Policy-DSL/Tests zur Validierung von Policies
- Admin-Dashboard für Policy-Visualisierung

**Ownership:** Phase 3 Post-Launch Review

---

### 🟢 **Niedriges Risiko: Schema-Migrationen bei Requirement-Changes**

**Szenario:**
- Neuer Requirement: "Users können mehrere Primary Orgs haben"
- Schema-Refactoring nötig

**Mitigation:**
- Migrations-Strategie ist bereits in Roadmap (Flyway/Alembic)
- Monorepo ermöglicht versionierte DB-Schemas
- Tests mit Migrations-Rollback

**Ownership:** Phase 2 Data Modeling Review

---

## 8. Review-Leitfaden: Was vor Phase 1 Implementation passieren sollte

### ✅ **Vorbereitungen (2-3 Tage)**

- [ ] **ADR #1 erstellen & Approval:** Keycloak Vendor Lock-in Mitigation
- [ ] **ADR #2 erstellen & Approval:** Security Policy (Token, Rate-Limiting)
- [ ] **ADR #3 erstellen & Approval:** Permission Composition & Conflicts
- [ ] **Schema-Refactoring:** `keycloakId` → `identity_providers` (30min)
- [ ] **Error-Handling Spec in design.md erweitern** (1h)
- [ ] **Hierarchy-Query Performance-Test Plannen** (Vitest + Postgres-Bench)
- [ ] **Security Audit Scheduled:** Check OWASP-Top-10 für IAM
- [ ] **Approval Gate Checklist Updated** (openspec/project.md)

### 🟢 **Nach Approval vor Implementation starten**

- [ ] `tasks.md` hat Abhängigkeiten auf ADRs dokumentiert
- [ ] Unit-Test-Templates für RBAC/ABAC existieren
- [ ] E2E-Test-Suite hat Keycloak Mock + Integration Paths
- [ ] Security-Tests für Rate-Limiting, Token-Replay in tasks.md

---

## 9. Fazit & Empfehlungen an Stakeholder

### **Was ist gut:**

✅ Architektur folgt **FIT-Richtlinien** konsequent (API-First, Modulare Grenzen, Headless)  
✅ **Multi-Tenancy Design** ist Excellence-Level (RLS, Hierarchie, Isolation)  
✅ **Sicherheit & Compliance** sind First-Class-Citizen (Audit-Logging, Retention-Policy)  
✅ **Offene Standards** reduzieren Vendor-Lock-in (OIDC, JWT, SAML-bereit)  
✅ **Performance-bewusst** (Redis, Caching, < 50ms Ziel)  

### **Was ist zu konkretisieren:**

⚠️ **3 kritische ADRs** müssen vor Phase 1 gschrieben werden (Token Security, Permission Conflicts, Vendor Lock-in Mitigation)  
⚠️ **Schema-Generalisierung** (keycloakId → identity_providers) sollte vor Implementation erfolgen  
⚠️ **Error-Handling & Rate-Limiting** sind unterspecifiziert, sollten in design.md ausgearbeitet werden  

### **Empfehlungen:**

**1. FREIGEBEN mit Bedingung:** ADRs #1–#3 müssen gebilligt sein, bevor Phase 1 Implementierung startet.

**2. CONCURRENT WORK:** Während ADRs geschrieben werden, kann bereits schon folgendes vorbereitet werden:
   - Keycloak-Instance Setup & Config testen
   - Postgres Schema-Setup (mit identity_providers Table)
   - Frontend OIDC-Library Evaluation (@react-oauth/google? react-oidc-context?)
   - E2E-Test-Infrastructure (Keycloak Mock vs. Real Instance)

**3. POST-PHASE-1 REVIEW:** Nach Phase 1 Live-Deployment sollte folgendes überprüft werden:
   - Keycloak-Performance unter Load (Loginqueue, Token-Refresh)
   - Public Key Caching in Production
   - Token-Validation Error-Rates (sind Keycloak-Ausfälle erkannt?)

---

## Anhang A: Konformitäts-Checkliste gegen Föderale IT-Architekturrichtlinien

| Richtlinie | Compliance | Bemerkung |
|-----------|-----------|----------|
| **Modularität** | ✅ | IAM als separater Service, klare Grenzen |
| **API-First / Headless** | ✅ | OIDC-basiert, Frontend-agnostisch |
| **Skalierbarkeit** | ✅ | Multi-Tenant, Hierarchisch, Caching |
| **Security by Design** | ✅ | Token-Validierung, RLS, Audit-Logs |
| **Interoperabilität** | ✅ | Offene Standards (OIDC, JWT, SAML) |
| **Wartbarkeit & Dokumentation** | ⚠️ | Gut, aber ADRs + Error-Handling noch ausstehen |
| **Testbarkeit** | ✅ | Unit/Integration/E2E-Tests geplant |
| **Performance** | ✅ | Caching, Indexes, < 50ms Permission Checks |
| **Datenschutz (DSGVO)** | ✅ | Audit-Logging, Retention-Policy, RLS |

---

## Anhang B: Links & Referenzen

**Proposals & Specs:**
- [`proposal.md`](proposal.md) – Geschäftliche Begründung & Impact
- [`design.md`](design.md) – Technische Architekturdetails (Keycloak, Token, RLS)
- [`tasks.md`](tasks.md) – 3-Phase Implementation Plan
- [`specs/iam-core/spec.md`](specs/iam-core/spec.md) – OIDC, Token-Validierung
- [`specs/iam-organizations/spec.md`](specs/iam-organizations/spec.md) – Hierarchie, RLS, Memberships
- [`specs/iam-access-control/spec.md`](specs/iam-access-control/spec.md) – RBAC, ABAC, 7-Personas
- [`specs/iam-auditing/spec.md`](specs/iam-auditing/spec.md) – Activity-Logs, Events, Retention

**Projektkontext:**
- [`openspec/project.md`](../../openspec/project.md) – Architektur-Richtlinien
- [`DEVELOPMENT_RULES.md`](../../DEVELOPMENT_RULES.md) – Coding Standards
- [`AGENTS.md`](../../AGENTS.md) – Monorepo-Struktur, Testing-Guidelines

---

**Reviewer Notes:**  
_Review durchgeführt am 21.01.2026 anhand aller 7 Proposals & Specs. FIT-Compliance geprüft gegen openspec/project.md. Security Review incomplete (formales Audit fehlt noch), aber keine kritischen Lücken erkannt._

