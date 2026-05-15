# Change: Auth-Session-Diagnostik und korrelierter Browser-Trail

## Why

Unerwartete Reauths und Logout-Häufungen lassen sich derzeit nur als Endsymptom beobachten. Für `/auth/me`, Silent-SSO und Session-Auflösung fehlt ein durchgehender Diagnosevertrag, der Browser- und Serverursachen korrelierbar macht.

## What Changes

- strukturierten Auth-Fehlervertrag für `/auth/me` und die Auth-Middleware ergänzen
- auth-spezifische `reason_code`-Diagnostik in den bestehenden IAM-Runtime-Vertrag integrieren
- lokalen Browser-Ringpuffer für Auth-Recovery-Ereignisse mit `authFlowId` einführen
- Session-Expired- und Self-Service-Oberflächen um schlanke Diagnose-IDs ergänzen

## Impact

- Affected specs: `iam-core`, `account-ui`
- Affected code: `packages/core`, `packages/auth-runtime`, `apps/sva-studio-react`
- Affected arc42 sections: `docs/architecture/08-cross-cutting-concepts.md`
