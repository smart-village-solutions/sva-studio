# Change: IAM Governance-Workflows und Compliance-Flows

## Why

Für Enterprise- und Behördenkontext reichen reine Berechtigungsentscheidungen nicht aus. Benötigt werden nachvollziehbare Governance-Prozesse (Vier-Augen-Prinzip, Delegationen, Impersonation) sowie rechtskonforme Nachweise.

## What Changes

- Permission-Change-Requests mit Approval-Flow
- Delegationen (temporäre Vertretungen) mit Gültigkeitsfenstern
- Sichere Impersonation mit starker Auditierbarkeit
- Legal-Text-Akzeptanzen und Compliance-Events
- Governance-Workflows instanzgebunden modellieren (`instanceId` als Primärscope)

## Impact

- Affected specs: `iam-auditing`, `iam-core`, `iam-access-control`
- Affected code: `packages/core`, `packages/data`, `apps/studio`
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`

## Dependencies

- Requires: `add-iam-abac-hierarchy-cache`

## Status

🟡 Draft Proposal
