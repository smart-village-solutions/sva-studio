# IAM Role Delete Cascade Assignments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rollenlöschung soll direkte Benutzer- und Gruppenzuordnungen implizit entfernen und die UI soll diesen Kaskadeneffekt klar ankündigen.

**Architecture:** Der Delete-Flow für tenantlokale Custom-Rollen bleibt IAM-lokal und erweitert die Persistenz um deterministisches Aufräumen von `iam.account_roles` und `iam.group_roles`, bevor `iam.roles` entfernt wird. Allgemeine Custom-Rollen werden dabei nicht als Keycloak Realm Roles materialisiert oder gelöscht; Keycloak-Abgleich bleibt auf technische Sonderrollen begrenzt. Die Rollenliste behält ihren bestehenden Bestätigungsdialog, bekommt aber eine präzisere Warnformulierung.

**Tech Stack:** TypeScript, React, Vitest, Nx, OpenSpec

---

### Task 1: Spezifikation und IAM-Persistenzpfad anpassen

**Files:**
- Modify: `openspec/changes/update-iam-role-delete-cascade-assignments/specs/iam-core/spec.md`
- Modify: `packages/iam-admin/src/role-mutation-persistence.ts`
- Test: `packages/iam-admin/src/role-mutation-persistence.test.ts`

- [ ] Bestehende Delete-Schutzregel durch IAM-lokale Kaskadenlöschung für `iam.account_roles` und `iam.group_roles` ersetzen
- [ ] Sicherstellen, dass der Custom-Rollen-Delete keine allgemeine Keycloak-Realm-Rollenmutation erwartet oder ausführt
- [ ] Persistenztest auf SQL-Reihenfolge und Wegfall des Konflikts für bestehende Zuweisungen anpassen

### Task 2: Delete-Handler und UI-Texte anpassen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/roles/-roles-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources/de/admin/roles.resources.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources/en/admin/roles.resources.ts`

- [ ] Warnhinweis im Delete-Dialog auf Kaskadenlöschung umformulieren
- [ ] UI-Test auf den neuen Hinweis und unveränderten Delete-Call anpassen

### Task 3: Dokumentation und gezielte Verifikation

**Files:**
- Modify: `docs/guides/iam-service-api-dokumentation.md`
- Modify: `docs/api/iam-v1.yaml`
- Modify: `docs/architecture/06-runtime-view.md`

- [ ] Doku auf IAM-lokales kaskadierendes Entfernen von User- und Gruppenzuordnungen vor dem Rollendelete aktualisieren
- [ ] Keycloak-Rollen-Sync-Dokumentation nur dann anfassen, wenn technische Sonderrollen oder Legacy-Diagnose betroffen sind
- [ ] Relevante Vitest-/Nx-Targets und OpenSpec-Validierung ausführen
