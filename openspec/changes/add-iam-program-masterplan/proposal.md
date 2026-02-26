# Change: IAM-Programm-Masterplan für mehrstufige Umsetzung

## Why

Das IAM-Vorhaben ist fachlich und technisch zu groß für ein einzelnes Proposal. Ein monolithischer Change erhöht Risiko, Review-Last und Umsetzungsunsicherheit. Daher wird ein steuernder Master-Plan benötigt, der das Gesamtziel verbindlich beschreibt und in umsetzbare Child-Changes zerlegt.

## What Changes

- Etabliert einen **Master-Change** als Programmrahmen für IAM.
- Definiert verbindliche Phasen, Abhängigkeiten und Exit-Kriterien.
- Zerlegt das Vorhaben in eigenständige Child-Changes mit klaren Schnittstellen.
- Verankert Governance-Regeln: Implementierung nur über freigegebene Child-Changes.

### Programmstruktur (Child-Changes)

1. `setup-iam-identity-auth` (bestehend, als Child A weiterführen)
   - Fokus: OIDC, Token-Handling, Session-Lifecycle, Identity-Basis
2. `add-iam-core-data-layer`
   - Fokus: `iam`-Schema, Migrationen, RLS-Baseline, Seeds (7 Personas)
3. `add-iam-authorization-rbac-v1`
   - Fokus: `GET /iam/me/permissions`, `POST /iam/authorize`, RBAC + Org-Scoping
4. `add-iam-abac-hierarchy-cache`
   - Fokus: ABAC, Vererbung (Org/Geo), Cache-Invalidierung, Performance < 50 ms
5. `add-iam-governance-workflows`
   - Fokus: Permission-Change-Requests, Delegation, Impersonation, Legal Acceptances, Audit-Hardening

## Impact

- Affected specs: `iam-core`, `iam-organizations`, `iam-access-control`, `iam-auditing` (über Child-Changes konkretisiert)
- Affected code: `packages/auth`, `packages/core`, `packages/data`, `packages/sdk`, `apps/studio`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`

## Governance / Guardrails

- Der Master-Change enthält **keine direkte Feature-Implementierung**.
- Jede Umsetzung erfolgt ausschließlich über Child-Changes mit eigenen Spec-Deltas und Tasks.
- Child-Changes werden in definierter Reihenfolge umgesetzt, außer eine explizite Entkopplung wurde in deren Design dokumentiert.

## Success Criteria

- Für jede Phase existiert ein eigenständiger, reviewbarer Child-Change.
- Abhängigkeiten und Reihenfolge sind transparent und stabil.
- Sicherheits-, Performance- und Compliance-Ziele sind pro Child-Change testbar hinterlegt.

## Status

🟡 Proposal (Masterplanung) – bereit für Review
