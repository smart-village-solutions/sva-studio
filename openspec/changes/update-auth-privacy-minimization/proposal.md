# Change: Auth-, Logging- und Profil-Sync auf Datenminimierung ausrichten

## Why
Die bestehende Auth-/Observability-Architektur war funktional, aber aus DSGVO- und Security-Sicht zu unscharf. Besonders problematisch waren tokenhaltige Redirect-URLs im Logging, zu breit verstandene Session-Nutzerdaten und Dokumentation, die das minimale Auth-Modell noch nicht konsistent beschrieben hat.

## What Changes
- Reduziert den Session- und Auth-Kern auf Identitaet, Instanzkontext und Rollen.
- Trennt Profil-Synchronisation (Name, E-Mail) explizit vom Login- und Logging-Pfad.
- Schaerft Logger- und OTEL-Redaction gegen JWTs, tokenhaltige URLs und sensitive Query-Parameter.
- Verbietet tokenhaltige Strings und sicherheitsrelevante Redirect-URLs im operativen Logging verbindlich.
- Synchronisiert OpenSpec, Development Rules und aktive Architektur-/Package-Doku auf das neue Privacy-Modell.

## Impact
- Affected specs: `iam-core`, `iam-auditing`, `monitoring-client`
- Affected code: `packages/auth`, `packages/sdk`, `packages/monitoring-client`, `apps/sva-studio-react`
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, Logging-Architektur, Privacy-/Auth-Dokumentation
