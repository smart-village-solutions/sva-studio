# Tasks: add-iam-core-data-layer

## 1. Schema & Migration

- [ ] 1.1 `iam`-Schema anlegen
- [ ] 1.2 Kern-Tabellen modellieren (`accounts`, `organizations`, `roles`, `permissions`)
- [ ] 1.3 Zuordnungstabellen modellieren (`account_roles`, `role_permissions`, `account_organizations`)
- [ ] 1.4 Instanzmodell ergänzen (`instances`, `instance_memberships`, instanzgebundene Org-Zuordnung)
- [ ] 1.4 Migrations und Rollback validieren

## 2. Multi-Tenancy-Basis

- [ ] 2.1 `instanceId`-Konvention in relevanten Tabellen durchziehen (Organisationen bleiben untergeordnet)
- [ ] 2.2 RLS-Basispolicies erstellen
- [ ] 2.3 Isolationstests für Mandantenzugriff schreiben

## 3. Seeds & Qualität

- [ ] 3.1 Seed-Daten für 7 Personas anlegen
- [ ] 3.2 Repositories/Typen in Strict-TS ergänzen
- [ ] 3.3 Unit-/Integrationstests für Datenzugriff ergänzen
