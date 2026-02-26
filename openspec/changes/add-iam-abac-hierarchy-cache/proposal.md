# Change: IAM ABAC, Hierarchie-Vererbung und Cache-Invalidierung

## Why

RBAC allein deckt die fachliche Komplexität (Org-/Geo-Hierarchie, Kontextattribute, Laufzeitbedingungen) nicht vollständig ab. Für Ziel-Performance und Skalierung ist zusätzlich ein konsistenter Caching-Ansatz nötig.

## What Changes

- ABAC-Erweiterung mit Kontextattributen
- Vererbungslogik über Organisations- und Geo-Hierarchien
- Permission-Snapshots im Cache + Event-basierte Invalidierung
- Performance-Härtung für `authorize` mit Ziel < 50 ms
- Primärer Mandanten-Scope `instanceId`; Organisation als untergeordneter Kontext

## Impact

- Affected specs: `iam-access-control`, `iam-organizations`
- Affected code: `packages/core`, `packages/data`, ggf. Infra-Integration
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, `10-quality-requirements`

## Dependencies

- Requires: `add-iam-authorization-rbac-v1`
- Blocks: `add-iam-governance-workflows` (teilweise)

## Status

🟡 Draft Proposal
