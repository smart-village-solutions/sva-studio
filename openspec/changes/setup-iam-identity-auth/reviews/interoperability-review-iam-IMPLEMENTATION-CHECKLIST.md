# ✅ INTEROPERABILITY IMPLEMENTATION CHECKLIST

**For:** Development Team, Architecture Review  
**Status:** Ready for Integration into tasks.md  
**Created:** 21. Januar 2026

---

## 🔴 P0 BLOCKERS – Vor Production (Phase 1–3 erweitern)

### API Versionierung & Deprecation (3 Tage)

- [ ] **Design:** API-Versioning Strategie finalisieren
  - URL-Pattern: `/api/iam/v1/users` vs `/api/iam/v2/users`
  - Deprecation-Window: Mindestens 6 Monate
  - Communication-Prozess dokumentieren
  - Acceptance Criteria: Strategy-Dokument approved by Stakeholders
  - Owner: Architecture Team
  - Effort: 8h

- [ ] **Implement:** API-Versioning in Codebase
  - Express/Server Router mit Version-Support
  - Route-Prefix für Version
  - Version-Header in Responses
  - Tests für Version-Routing
  - Acceptance Criteria: All APIs under `/v1/` path, Header-Version included
  - Owner: Backend Team
  - Effort: 12h

- [ ] **Dokumentation:** Deprecation Policy veröffentlichen
  - Blog-Post zur Policy
  - Developer-Portal: "Breaking Changes" Section
  - Migration-Guides für zukünftige Changes
  - Communication-Template für Deprecation-Announcements
  - Acceptance Criteria: Policy published, Template available
  - Owner: DevRel Team
  - Effort: 4h

---

### Export/Import Framework (3 Wochen)

#### Phase 1: Schema & Endpoints (1 Woche)

- [ ] **1.1 Design Export-API Schema**
  - JSON Format für Orgs, Users, Roles
  - CSV Format für Bulk-Import
  - Versioning & Checksum
  - Metadata-Struktur
  - Acceptance Criteria: Schema-Doc reviewed, no schema-conflicts
  - Owner: Data Team
  - Effort: 16h

- [ ] **1.2 Implement Export Endpoints**
  ```
  GET /api/iam/v1/organizations/export?format=json
  GET /api/iam/v1/users/export?format=csv&include_org_assignments=true
  GET /api/iam/v1/roles/export?format=json&include_permissions=true
  GET /api/iam/v1/role-assignments/export?format=csv
  ```
  - Authentication: Admin-only
  - Format validation
  - Streaming for large datasets
  - Error handling
  - Acceptance Criteria: All 4 endpoints return valid data
  - Owner: Backend Team
  - Effort: 32h

- [ ] **1.3 Implement Import Endpoints**
  ```
  POST /api/iam/v1/organizations/import (multipart/form-data)
  POST /api/iam/v1/users/import
  POST /api/iam/v1/roles/import
  POST /api/iam/v1/role-assignments/import
  ```
  - Modes: create_or_update, create_only, dry_run
  - Validation & Error Reporting (per-row)
  - Idempotency guarantees
  - Transaction handling
  - Acceptance Criteria: Import works for all entities, dry-run accurate
  - Owner: Backend Team
  - Effort: 40h

#### Phase 2: Testing & Documentation (1 Woche)

- [ ] **2.1 Integration Tests**
  - Export → Import Cycle (complete data integrity)
  - Error Scenarios (missing IDs, invalid references)
  - Bulk Operations (1000+ records)
  - Idempotency (same import twice = same result)
  - Acceptance Criteria: 100% coverage, all tests green
  - Owner: QA Team
  - Effort: 24h

- [ ] **2.2 Compliance Verification**
  - GDPR Right-to-Export compliance
  - Data sanitization (no passwords, secrets)
  - Audit-Log completeness
  - Data retention in exports
  - Acceptance Criteria: Compliance-checklist signed-off
  - Owner: Security/Compliance Team
  - Effort: 8h

- [ ] **2.3 Documentation**
  - API Reference (OpenAPI)
  - Migration Guide (CSV template, examples)
  - Error Codes (detailed error documentation)
  - Performance notes (expected time for 10k users)
  - Acceptance Criteria: Docs published on developer portal
  - Owner: DevRel Team
  - Effort: 12h

#### Phase 3: Operations & Monitoring (1 Woche)

- [ ] **3.1 Monitoring & Alerts**
  - Export operation metrics (count, duration)
  - Import success/failure rates
  - Large export detection (alert if > 50k records)
  - Error tracking (per endpoint)
  - Acceptance Criteria: Dashboards in APM, alerts configured
  - Owner: Operations Team
  - Effort: 16h

- [ ] **3.2 Operational Runbooks**
  - "How to export complete IAM state"
  - "How to import from backup"
  - "Troubleshooting import failures"
  - "Data validation after import"
  - Acceptance Criteria: Runbooks documented, ops team trained
  - Owner: Operations Team
  - Effort: 8h

- [ ] **3.3 Performance Tuning**
  - Optimize large exports (streaming, pagination)
  - Batch import performance (target: 1000 records/sec)
  - Database query optimization
  - Acceptance Criteria: Export 100k orgs in < 5min, Import 100k users in < 2min
  - Owner: Performance Team
  - Effort: 20h

---

### OpenAPI Spec + SDK Generation (1 Woche)

- [ ] **Design OpenAPI 3.0 Spec**
  - All endpoints documented (Users, Orgs, Roles, Permissions, Audit)
  - Request/Response schemas
  - Error codes (400, 401, 403, 404, 500)
  - Security schemes (Bearer token)
  - Examples in each endpoint
  - Acceptance Criteria: Spec passes `openapi-validator`
  - Owner: API Team
  - Effort: 24h

- [ ] **Setup OpenAPI Generator Pipeline**
  - CI/CD integration (auto-generate on spec changes)
  - Language targets: Python, TypeScript, Go
  - Template customization (if needed)
  - Version management
  - Acceptance Criteria: Generator runs in CI, produces valid SDKs
  - Owner: DevOps Team
  - Effort: 12h

- [ ] **Generate & Publish SDKs**
  - Python: PyPI package (`pip install sva-iam-client`)
  - TypeScript: npm package (`@sva-studio/iam-client`)
  - Go: github.com module (`github.com/sva-studio/iam-client-go`)
  - Documentation in each SDK
  - Example usage in README
  - Acceptance Criteria: All 3 SDKs installable, basic examples work
  - Owner: SDK Team
  - Effort: 16h

- [ ] **Publish API Documentation**
  - Swagger UI (interactive docs)
  - Redoc (reference docs)
  - Developer Portal (https://api-docs.sva-studio.de)
  - Code snippets (curl, Python, JS, Go)
  - Acceptance Criteria: Docs site accessible, "Try It" buttons work (OAuth scoped)
  - Owner: DevRel Team
  - Effort: 12h

---

### Event/Webhook API Framework (2 Wochen)

#### Phase 1: Architecture Design (3 Tage)

- [ ] **Design Event Schema**
  - Event types (user.created, role.assigned, org.deleted, etc.)
  - Payload structure (event_id, event_type, timestamp, data)
  - Versioning strategy
  - Acceptance Criteria: Event-schema doc reviewed, no conflicts with existing models
  - Owner: Architecture Team
  - Effort: 12h

- [ ] **Design Webhook Subscription API**
  - REST endpoints (POST/GET/PATCH/DELETE /webhooks)
  - Authentication/Authorization
  - Retry policy
  - Acceptance Criteria: API spec approved
  - Owner: Architecture Team
  - Effort: 8h

- [ ] **Choose Event Backend**
  - Kafka vs Redis-Streams vs AWS SNS
  - Persistence requirements
  - Scalability planning
  - Acceptance Criteria: Decision documented, POC if needed
  - Owner: Architecture Team
  - Effort: 12h

#### Phase 2: Implementation (1 Woche)

- [ ] **Implement Internal Event Bus**
  - Kafka topics (or Redis streams): iam.events.users, iam.events.roles, etc.
  - Event producer in IAM service
  - Event schema validation
  - Acceptance Criteria: Events published for login, role_assigned, org_created
  - Owner: Backend Team
  - Effort: 40h

- [ ] **Implement Webhook Subscription Endpoints**
  - REST API for webhook CRUD
  - Webhook delivery mechanism (HTTP POST)
  - Retry logic (exponential backoff)
  - Dead-letter-queue for failed deliveries
  - Acceptance Criteria: Webhooks deliverable, retries working
  - Owner: Backend Team
  - Effort: 32h

- [ ] **Implement GraphQL Subscriptions**
  - Real-time subscriptions schema
  - WebSocket support
  - Authentication for subscriptions
  - Acceptance Criteria: GraphQL subscription queries work
  - Owner: Backend Team
  - Effort: 24h

#### Phase 3: Testing & Monitoring (4 Tage)

- [ ] **Integration Tests**
  - Event emission triggered by IAM operations
  - Webhook delivery tests
  - Subscription filtering tests
  - Retry scenarios
  - Acceptance Criteria: E2E test: Create user → Webhook fired → Event received
  - Owner: QA Team
  - Effort: 20h

- [ ] **Webhook Delivery Guarantees**
  - At-least-once delivery verification
  - Idempotency key (event_id)
  - Signature verification (HMAC)
  - Acceptance Criteria: Partner system can verify signatures
  - Owner: Security Team
  - Effort: 12h

- [ ] **Documentation & SDKs**
  - Webhook setup guide
  - Event reference (all event types)
  - Retry policy documentation
  - SDK/library for webhook consumers
  - Acceptance Criteria: Guide published, example webhook server code available
  - Owner: DevRel Team
  - Effort: 16h

- [ ] **Monitoring & Alerts**
  - Event delivery rate metrics
  - Failed delivery alerts
  - Dead-letter-queue monitoring
  - Acceptance Criteria: Dashboards configured, ops alerted on delivery failures
  - Owner: Operations Team
  - Effort: 12h

---

## 🟡 P1 HIGH-PRIORITY – Q1 2026 (Nach Launch)

### JWT Claims Standardisierung (5 Tage)

- [ ] **Finalize JWT Claims Schema**
  - Standard OIDC claims: iss, sub, aud, exp, iat, nbf, jti
  - SVA Custom claims: organizations, current_organization, roles, scope
  - Document in OpenAPI `components.schemas`
  - Acceptance Criteria: Claims-schema-doc approved by Security team
  - Owner: Security/Architecture Team
  - Effort: 16h

- [ ] **Configure Keycloak Mappers**
  - Role mapping (system_roles + organization_roles)
  - Organization claims (id, name, path)
  - Custom scope handling
  - Acceptance Criteria: Token introspection shows correct claims
  - Owner: Infrastructure Team
  - Effort: 12h

- [ ] **Implement Claims Validation in Backend**
  - Validate all required claims present
  - Validate claim values (org_id exists in DB)
  - Error handling for invalid claims
  - Acceptance Criteria: Token validation rejects invalid claims
  - Owner: Backend Team
  - Effort: 12h

- [ ] **Publish Claims Registry**
  - /.well-known/sva-iam-claims.json endpoint
  - OIDC Metadata (/.well-known/openid-configuration)
  - Documentation of all custom claims
  - Acceptance Criteria: Endpoint returns valid JSON, claims discoverable
  - Owner: DevRel Team
  - Effort: 8h

---

### Bulk-Operation APIs (1 Woche)

- [ ] **Design Bulk Endpoints**
  ```
  POST /api/iam/v1/organizations/{id}/users/bulk-assign
  POST /api/iam/v1/roles/bulk-assign
  POST /api/iam/v1/permissions/bulk-grant
  ```
  - CSV input format
  - Dry-run mode
  - Error reporting (per-row)
  - Acceptance Criteria: Design doc approved
  - Owner: API Team
  - Effort: 12h

- [ ] **Implement Bulk Endpoints**
  - File upload handling (streaming for large files)
  - Batch processing
  - Transaction management
  - Rollback on error (or partial-success report)
  - Acceptance Criteria: Bulk import 1000 users < 30 seconds
  - Owner: Backend Team
  - Effort: 32h

- [ ] **Add to OpenAPI + SDKs**
  - Update OpenAPI spec
  - Regenerate SDKs
  - Add bulk operation examples
  - Acceptance Criteria: SDKs have bulk methods, examples work
  - Owner: SDK Team
  - Effort: 12h

---

### GraphQL Server (1.5 Wochen)

- [ ] **Design GraphQL Schema**
  - Queries: user, users, organizations, roles, checkPermission, auditLogs
  - Mutations: assignRole, createOrganization, deleteUser
  - Subscriptions: onRoleAssigned, onAuditEvent
  - Acceptance Criteria: Schema doc reviewed
  - Owner: API Team
  - Effort: 16h

- [ ] **Implement GraphQL Endpoint**
  - Apollo Server or similar
  - Resolvers for queries/mutations/subscriptions
  - Authentication middleware
  - Acceptance Criteria: GraphQL endpoint responding, introspection works
  - Owner: Backend Team
  - Effort: 32h

- [ ] **Add to OpenAPI Spec**
  - Document GraphQL endpoint
  - Example queries
  - Acceptance Criteria: GraphQL documented in OpenAPI
  - Owner: API Team
  - Effort: 8h

- [ ] **Client SDK for GraphQL**
  - Generate GraphQL client (TypeScript, Python)
  - Example queries
  - Acceptance Criteria: Client SDK usable
  - Owner: SDK Team
  - Effort: 12h

---

### Permission-Cache Verification (5 Tage)

- [ ] **Verify Redis Integration**
  - Redis connection established
  - Cache keys defined: iam:permissions:{userId}:{orgId}
  - TTL set (1 hour)
  - Acceptance Criteria: Cache hit verified in APM
  - Owner: Backend Team
  - Effort: 12h

- [ ] **Implement Cache Invalidation**
  - Pub/Sub on role changes
  - Event-driven invalidation (not polling)
  - Acceptance Criteria: Cache invalidated immediately after role change
  - Owner: Backend Team
  - Effort: 16h

- [ ] **Performance Testing**
  - Permission check < 50ms (cache hit)
  - Cold start < 200ms (DB query)
  - Load test: 1000 concurrent permission checks
  - Acceptance Criteria: SLA met under load
  - Owner: Performance Team
  - Effort: 16h

---

## 📋 REFERENCE DOCUMENTS

### Dependencies & Prerequisites
- OpenAPI specification (core)
- Event-streaming infrastructure (Kafka/Redis)
- Developer portal infrastructure
- CI/CD pipeline (for SDK generation)

### Acceptance Criteria
- All tasks must have explicit, testable acceptance criteria
- Definition of "Done" includes code review + testing
- Security review for cryptographic/auth tasks

### Effort Estimation
- P0 Blockers: ~185 hours (4 weeks, parallel work)
- P1 High-Priority: ~100 hours (distributed over Q1)
- Assumes 2–3 FTE team size

---

## 🚀 DEPLOYMENT ORDER

1. **Week 1:** Versionierungsstrategie + OpenAPI
2. **Week 2–3:** Export/Import APIs
3. **Week 3–4:** Event/Webhook Framework
4. **Week 5+:** P1 items (JWT Claims, Bulk APIs, GraphQL)

---

**Created:** 21. Januar 2026  
**Status:** Ready for Task-Integration  
**Next Step:** Add to openspec/changes/setup-iam-identity-auth/tasks.md
