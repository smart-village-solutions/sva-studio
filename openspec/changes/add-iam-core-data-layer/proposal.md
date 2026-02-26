# Change: IAM Core Data Layer aufbauen

## Why

Für belastbare Autorisierung und Mandantenfähigkeit fehlt eine konsistente IAM-Datenbasis. Ohne stabiles Schema sind Rollen, Permissions, Vererbung und Audit nicht zuverlässig umsetzbar.

## What Changes

- Einführung des `iam`-Schemas in Postgres/Supabase
- Tabellen für `accounts`, `organizations`, `roles`, `permissions`, Zuordnungen
- Migrationspfad inkl. Seeds für Systemrollen (7 Personas)
- RLS-Baseline für mandantenfähige Isolation

## Impact

- Affected specs: `iam-organizations`, `iam-access-control`, `iam-auditing`
- Affected code: `packages/data`, ggf. `packages/core`
- Affected arc42 sections: `05-building-block-view`, `07-deployment-view`, `08-cross-cutting-concepts`

## Dependencies

- Requires: `setup-iam-identity-auth` (Identity-Basis)
- Blocks: `add-iam-authorization-rbac-v1`, `add-iam-abac-hierarchy-cache`

## Status

🟡 Draft Proposal
