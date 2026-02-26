# Change: IAM Authorization API und RBAC v1

## Why

Nach dem Datenfundament wird eine zentrale, wiederverwendbare Authorize-Schnittstelle benötigt, damit Module konsistent und schnell Berechtigungen prüfen können.

## What Changes

- API-Endpunkte: `GET /iam/me/permissions`, `POST /iam/authorize`
- RBAC-basierte Auswertung pro aktiver Instanz mit organisationsspezifischem Kontext
- Einfache Reason-Codes für nachvollziehbare Denials
- SDK-nahe Integrationsschicht für modulübergreifende Nutzung
- Verbindliche Mandanten-Scoping-Regel: `instanceId` als Primärfilter

## Impact

- Affected specs: `iam-access-control`
- Affected code: `packages/core`, `packages/sdk`, `apps/studio`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `10-quality-requirements`

## Dependencies

- Requires: `add-iam-core-data-layer`
- Blocks: `add-iam-abac-hierarchy-cache`

## Status

🟡 Draft Proposal
