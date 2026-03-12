# Change: `instanceId` als String statt UUID

## Why
Die aktuelle IAM-Implementierung behandelt `instanceId` extern teilweise als fachlichen String und intern/API-seitig als UUID. Diese Vermischung führt zu Validierungsfehlern, unnötiger Auflösung im Login-Flow und erschwert stabile Integrationen.

## What Changes
- **BREAKING** `instanceId` wird in API, Session, Contracts und Datenmodell als normaler String geführt.
- `iam.instances.id` wird zum kanonischen Text-Schlüssel; `instance_key` entfällt.
- Alle `instance_id`-Referenzen, RLS-Policies und DB-Hilfsfunktionen werden von UUID auf Text umgestellt.
- Relevante OpenAPI-, Guide- und Architekturdokumentation wird angepasst.

## Impact
- Affected specs: `iam-core`, `iam-access-control`, `architecture-documentation`
- Affected code: `packages/auth`, `packages/core`, `packages/data`
- Affected arc42 sections: `docs/architecture/04-solution-strategy.md`, `docs/architecture/05-building-block-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/09-architecture-decisions.md`, `docs/architecture/10-quality-requirements.md`
