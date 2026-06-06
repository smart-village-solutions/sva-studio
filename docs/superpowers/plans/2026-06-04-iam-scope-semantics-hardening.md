# IAM Scope Semantics Hardening Implementation Plan

**Statusabgleich zum aktuellen Codestand (`main`, nach PR `#510`):**
- erledigt: Root-/Tenant-Trennung, `instance_registry_admin` root-only, `system_admin` als tenantseitige Sonderrolle, Seed-/Bootstrap-Bereinigung, Tenant-Filter für `instance.registry.manage`, permission-zentrierte Admin-/Router-Gates
- erledigt: explizite `runtimeScope`-Klassifikation, Auflösung der pauschalen `organizationId`-Projektion im `permission-store`, instanzweite Behandlung von `media.*` und `waste-management.*` trotz aktivem Organisationskontext, Angleichung der Transparenzpfade in Runtime und Admin-Read-Modellen
- repo-seitig erledigt: Dokumentations- und Evidenznachlauf für die neue Scope-Semantik
- extern offen: fachlich starker Zielumgebungs-Showcase-Nutzer für besonders aussagekräftige Delivery-Screenshots
- bereits teilweise vorhanden: Transparenzfelder wie `inactiveReason` und `inheritedFromOrganizationId` existierten schon; der Rest wurde auf korrekte Scope-Klassifikation und Projektion reduziert und ist backendseitig umgesetzt.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das IAM soll den kanonischen Instanz-First-Scope konsistent auswerten, organisations- und datensatzbezogene Einschränkungen nur noch explizit anwenden und Runtime-, Admin- und Transparenzpfade auf dieselbe Semantik zurückführen.

**Architecture:** Nach dem bereits abgeschlossenen Rollenmodell-Refactor bleibt als Folgearbeit die fachliche Trennung von instanzweiten Rechten und record-/organizationsbezogenen Rechten. Neue Runtime-Metadaten beschreiben explizit, wann `organizationId` überhaupt semantisch wirksam ist; bestehende record-scoped Rechte behalten `accessScope`, instanzweite Rechte verlieren die heutige implizite Org-Bindung.

**Tech Stack:** OpenSpec, arc42, TypeScript strict mode, Nx, pnpm, Vitest, Postgres/SQL, React, TanStack Router

---

## Zielregeln

1. `instanceId` ist immer der führende Tenant-Scope.
2. `organizationId` ist nur ein optionaler Fachkontext innerhalb einer Instanz.
3. Die Runtime unterscheidet exakt drei Rechteklassen: Root-/Plattformrechte, tenantweite Instanzrechte und explizit datensatz-/organisationsbezogene Rechte.
4. Instanzweite Rechte bleiben auch bei gesetztem `activeOrganizationId` instanzweit wirksam.
5. `accessScope = all | own | organization` gilt nur für ausdrücklich scope-fähige Datensatzrechte.
6. `content.*`, `news.*`, `events.*`, `poi.*` bleiben record-scoped; `media.*`, `waste-management.*`, `app.read`, `cockpit.read`, `feature.toggle`, `integration.manage` bleiben in dieser Phase instanzweit.
7. Runtime, Permission-Snapshot, Admin-API und UI-Transparenz müssen dieselbe Scope-Semantik anzeigen.
8. Öffentliche Diagnosepfade bleiben allowlist-basiert und leaken weder Session- noch Membership-Interna.

## Aktuelle Codebeobachtungen

### Bereits umgesetzt

- `packages/auth-runtime/src/iam-account-management/platform-iam.ts` projiziert Plattformrollen bereits nur noch über `PLATFORM_PROFILE_ROLES`.
- `packages/data-repositories/src/iam/seed-plan.personas.ts` filtert `instance.registry.manage` aus tenantseitigen Personas heraus.
- `packages/iam-admin/src/managed-permissions.ts` behandelt `instance.registry.manage` bereits als root-only und `isTenantVisiblePermissionKey(...)` fail-closed.
- `packages/iam-admin/src/user-detail-query.mapping.ts` trägt `inactiveReason` und `inheritedFromOrganizationId` bereits durch.
- `packages/auth-runtime/src/iam-account-management/shared-assignment.ts` und der User-Update-Pfad arbeiten bereits diff-basiert, sobald bestehende Rollen-/Gruppen-IDs bekannt sind.

### Noch offen

- Kein Repo-Blocker mehr. Außerhalb des Repos bleibt nur noch zusätzlicher Zielumgebungs-Showcase für Delivery-Evidence.

## File Structure Map

### Spezifikation und Architektur

- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/proposal.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/tasks.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/iam-core/spec.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/account-ui/spec.md`
- Modify: `docs/architecture/04-solution-strategy.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Create or Modify: `docs/architecture/decisions/ADR-0xx-iam-scope-semantics-and-role-separation.md`

### Permission-Semantik und Metadaten

- Modify: `packages/iam-admin/src/managed-permissions.ts`
- Modify: `packages/iam-admin/src/managed-permissions.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.test.ts`

### Snapshot- und Authorize-Auflösung

- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.ts`
- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.queries.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/me-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/me-permissions.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize.test.ts`
- Modify: `packages/auth-runtime/src/auth-route-handlers.ts`

### Modul- und Host-Call-Sites

- Modify: `packages/auth-runtime/src/iam-media/server-authorization.ts`
- Modify: `packages/auth-runtime/src/iam-media/server-authorization.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/auth.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/guard-branches.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.test.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.test.ts`

### Transparenz- und Admin-Projektion

- Modify: `packages/iam-admin/src/user-detail-permission-sql.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.test.ts`
- Modify: `packages/iam-admin/src/user-detail-query.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/users/*`

### Verifikation und Doku

- Modify: `docs/guides/iam-authorization-api-contract.md`
- Modify: `docs/guides/iam-service-api-dokumentation.md`
- Modify: `docs/guides/iam-deployment-runbook.md`
- Modify: `docs/guides/iam-acceptance-runbook.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`

---

### Task 1: Restumfang in Spezifikation und Architektur synchronisieren

**Files:**
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/proposal.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/tasks.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/iam-core/spec.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/specs/account-ui/spec.md`
- Modify: `docs/architecture/04-solution-strategy.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`

- [ ] **Step 1: Spezifikationen nur noch auf offene Scope-Semantik ausrichten**

Run:
```bash
openspec show refactor-wp-005-iam-assignment-transparency --json --deltas-only
openspec show iam-core --type spec
openspec show iam-access-control --type spec
```

Expected:
- Root-/Tenant-Trennung wird nicht mehr als offene Arbeit beschrieben.
- Offen bleiben nur Instanz-vs-Org-Semantik, `runtimeScope` und Transparenzangleichung.

- [ ] **Step 2: Normative Anforderung für instanzweite Rechte im Org-Kontext ergänzen**

Zieltext:
```md
### Requirement: Tenantweite Rechte bleiben bei aktivem Organisationskontext instanzweit wirksam
Das System SHALL tenantweite Host- und Plugin-Rechte nicht allein deshalb organisationsgebunden behandeln, weil ein aktiver `organizationId`-Kontext vorhanden ist.
```

- [ ] **Step 3: Architektur- und ADR-Texte auf die Restschuld fokussieren**

Pflichtpunkte:
- `runtimeScope` als neue normative Metadatenklasse
- record-scoped Rechte behalten `accessScope`
- Root-/Tenant-Split gilt als abgeschlossen und wird nur noch referenziert
- diff-basierte Assignment-Writes werden nicht mehr als ungebaute Kernfunktion beschrieben, sondern nur noch als Verifikations- und Restpfadthema

### Task 2: Permission-Metadaten um explizite Laufzeitsemantik erweitern

**Files:**
- Modify: `packages/iam-admin/src/managed-permissions.ts`
- Modify: `packages/iam-admin/src/managed-permissions.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.ts`
- Modify: `packages/auth-runtime/src/iam-account-management/roles-handlers.test.ts`

- [ ] **Step 1: Failing Tests für `runtimeScope` schreiben**

Zieltest:
```ts
expect(getManagedPermissionMetadata('media.read')).toMatchObject({
  permissionKey: 'media.read',
  runtimeScope: 'instance',
});

expect(getManagedPermissionMetadata('news.read')).toMatchObject({
  permissionKey: 'news.read',
  runtimeScope: 'record',
  isScopeAssignable: true,
});
```

- [ ] **Step 2: Metadatenmodell erweitern und alle verwalteten Permissions klassifizieren**

Zielcode:
```ts
export type PermissionRuntimeScope = 'instance' | 'record' | 'organization_context';
```

Regel:
- kein stiller Fallback auf `'instance'`
- neue Permission-Keys brechen Tests, bis ihre Semantik explizit entschieden wurde

- [ ] **Step 3: Runtime-Scope in Rollen-/Permission-Read-Modelle durchreichen**

Run:
```bash
pnpm nx run iam-admin:test:unit --testFiles=src/managed-permissions.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-account-management/roles-handlers.test.ts
```

### Task 3: Permission-Store von pauschaler Org-Projektion lösen

**Files:**
- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.ts`
- Create: `packages/auth-runtime/src/iam-authorization/permission-scope-semantics.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.queries.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.test.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/me-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize.ts`

- [ ] **Step 1: Regressionstest für instanzweite Rechte mit `organizationId` ergänzen**

Zieltest:
```ts
expect.objectContaining({
  action: 'media.read',
  organizationId: undefined,
});
```

Expected:
- aktueller Teststand muss zunächst rot werden, weil `$3::uuid AS organization_id` heute blanket projiziert wird

- [ ] **Step 2: Query und Post-Processing trennen**

Regel:
- instanzweite Rechte behalten `organizationId: undefined`
- record-/organization-context-Rechte erhalten nur dort eine Org-Projektion, wo die Fachsemantik sie verlangt
- `organizationId` bleibt Teil des Cache-Keys, damit record-scoped Rechte korrekt gecacht werden

- [ ] **Step 3: `/auth/me`, `GET /iam/me/permissions` und `POST /iam/authorize` angleichen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/permission-store.test.ts --testFiles=src/iam-authorization/me-permissions.test.ts --testFiles=src/iam-authorization/authorize.test.ts
pnpm nx run auth-runtime:test:types
```

### Task 4: Modulpfade auf instanzweite vs. record-scoped Semantik angleichen

**Files:**
- Modify: `packages/auth-runtime/src/iam-media/server-authorization.ts`
- Modify: `packages/auth-runtime/src/iam-media/server-authorization.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/auth.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/guard-branches.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.test.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.ts`
- Modify: `packages/auth-runtime/src/iam-contents/request-context.test.ts`

- [ ] **Step 1: Media und Waste nicht mehr implizit an `activeOrganizationId` koppeln**

Regel:
- `media.*` und `waste-management.*` laufen über instanzweite Resolution
- `iam-contents` bleibt der Referenzpfad für record-scoped Rechte und darf `activeOrganizationId` weiter bewusst nutzen

- [ ] **Step 2: Regressionstests für Media, Waste und Content gegeneinander absichern**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-media/server-authorization.test.ts --testFiles=src/waste-management/core/guard-branches.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts --testFiles=src/iam-contents/request-context.test.ts
```

### Task 5: Transparenz- und Admin-Read-Modelle an dieselbe Semantik angleichen

**Files:**
- Modify: `packages/iam-admin/src/user-detail-permission-sql.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.ts`
- Modify: `packages/iam-admin/src/user-detail-query.mapping.test.ts`
- Modify: `packages/iam-admin/src/user-detail-query.test.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/users/*`

- [ ] **Step 1: Bestehende Transparenzfelder beibehalten, aber um `runtimeScope` ergänzen**

Wichtig:
- `inactiveReason` und `inheritedFromOrganizationId` sind bereits im Codestand vorhanden
- neu ist die konsistente Kennzeichnung `instance | record | organization_context`
- dieser Task umfasst nicht mehr den Neuaufbau der gesamten Permission-Trace-UI, sondern nur die fehlende Scope-Semantik

- [ ] **Step 2: SQL-Projektion zwischen instanzweiten und record-scoped Rechten unterscheiden**

Zielrichtung:
```sql
CASE
  WHEN p.permission_key = ANY($record_scoped_keys) THEN ao.organization_id::text
  ELSE NULL::text
END AS organization_id
```

- [ ] **Step 3: User-Detail-UI lesbar nachschärfen**

Zielanzeige:
- instanzweit
- datensatzbezogen (`all|own|organization`)
- organisationsvererbt
- inaktiv / abgelaufen / deaktiviert

Run:
```bash
pnpm nx run iam-admin:test:unit --testFiles=src/user-detail-query.mapping.test.ts --testFiles=src/user-detail-query.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/users/**/*.test.tsx
```

### Task 6: Verifikation, Runbooks und Restschulden aktualisieren

**Files:**
- Modify: `docs/guides/iam-authorization-api-contract.md`
- Modify: `docs/guides/iam-service-api-dokumentation.md`
- Modify: `docs/guides/iam-deployment-runbook.md`
- Modify: `docs/guides/iam-acceptance-runbook.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `openspec/changes/refactor-wp-005-iam-assignment-transparency/tasks.md`

- [ ] **Step 1: Runbooks und Risiken nur auf die offene Scope-Semantik beziehen**

Pflichtpunkte:
- kein zusätzlicher DB-Roundtrip im Cache-Hit-Pfad
- öffentliche Diagnostik bleibt allowlist-basiert
- Legacy-Rollenmodell-Refactor wird nur noch als bereits erledigte Voraussetzung referenziert
- WP-005-Restschulden trennen zwischen bereits umgesetzten diff-basierten Update-Pfaden und noch offener Scope-/Transparenzsemantik

- [ ] **Step 2: Kleinsten relevanten Gate-Pfad ausführen**

Run:
```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/permission-store.test.ts --testFiles=src/iam-authorization/me-permissions.test.ts --testFiles=src/iam-authorization/authorize.test.ts --testFiles=src/iam-media/server-authorization.test.ts --testFiles=src/waste-management/core/guard-branches.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts --testFiles=src/iam-contents/request-context.test.ts
pnpm nx run iam-admin:test:unit --testFiles=src/managed-permissions.test.ts --testFiles=src/user-detail-query.mapping.test.ts --testFiles=src/user-detail-query.test.ts
pnpm nx run auth-runtime:test:types
pnpm check:server-runtime
```

- [ ] **Step 3: OpenSpec und Diff-Qualität final prüfen**

Run:
```bash
openspec validate refactor-wp-005-iam-assignment-transparency --strict
git diff --check
```

## Self-Review

- Scope of this plan:
  - nur noch die offene Instanz-vs-Org-Semantik
  - kein doppelter Root-/Tenant-Cleanup mehr
- Code alignment:
  - `runtimeScope` fehlt aktuell wirklich noch
  - blanket `organization_id`-Projektion ist im aktuellen Permission-Store und in der Transparenz-SQL noch vorhanden
  - Teile der Transparenzarbeit sind bereits umgesetzt und werden nicht erneut als grüne Wiese geplant
  - diff-basierte Assignment-Updates sind im User-Update-Pfad bereits vorhanden; offen bleiben Verifikation und eventuelle Restpfade
