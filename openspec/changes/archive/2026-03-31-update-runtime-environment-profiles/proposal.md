# Change: Runtime-Profile für Lokal, Builder und Abnahme vereinheitlichen

## Why

Die aktuellen Start- und Betriebswege sind auf mehrere `.env`-Dateien, Compose-Aufrufe und Runbooks verteilt. Dadurch bleiben Profilwechsel, Smoke-Checks und serverseitige Updates uneinheitlich und fehleranfällig.

## What Changes

- führt drei kanonische Runtime-Profile ein: `local-keycloak`, `local-builder`, `acceptance-hb`
- ergänzt ein einheitliches `env:*:<profil>`-Operations-Interface für Start, Stop, Update, Status, Smoke und Migration
- versioniert die nicht-sensitiven Profildefinitionen unter `config/runtime/`
- dokumentiert das Modell zentral unter `docs/development/runtime-profile-betrieb.md`

## Impact

- Affected specs: `monorepo-structure`, `architecture-documentation`
- Affected code: `package.json`, `scripts/ops/runtime-env.ts`, `packages/sdk`, `packages/auth`, `apps/sva-studio-react`
- Affected arc42 sections: `08-cross-cutting-concepts`
