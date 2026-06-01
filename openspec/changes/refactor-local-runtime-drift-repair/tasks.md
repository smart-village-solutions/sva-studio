## 1. Runtime-Mechanik

- [x] 1.1 `runtime-env` um `repair` und `verify-schema-snapshot` erweitern
- [x] 1.2 Doctor-Checks um maschinenlesbare Driftmetadaten ergaenzen
- [x] 1.3 lokalen Secret-Sync fuer aktive Tenants auf bestehende Keycloak-/Registry-Helfer aufbauen
- [x] 1.4 gefaehrliche Runtime-Mutationen hinter expliziten Approval-Tokens sperren

## 2. Snapshot-Governance

- [x] 2.1 objektbasierten Snapshot-Diff implementieren
- [x] 2.2 `graphile_worker` im Snapshot-Check explizit ignorieren
- [x] 2.3 Snapshot-Drift als eigener Diagnosebefund sichtbar machen

## 3. Dokumentation und Spezifikation

- [x] 3.1 Betriebsdoku auf `up -> doctor -> repair -> reset` aktualisieren
- [x] 3.2 OpenSpec-Deltas fuer Deployment und Instance-Provisioning anlegen
- [x] 3.3 Repo-Plan im Plansbereich dokumentieren
- [x] 3.4 gefaehrliche Bootstrap- und Runtime-Pfade mitsamt Approval-Tokens dokumentieren

## 4. Verifikation

- [x] 4.1 `pnpm exec vitest run scripts/ops/runtime/db-schema-snapshot.test.ts scripts/ops/runtime-env.test.ts`
- [x] 4.2 `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
- [x] 4.3 `pnpm env:verify:db-schema-snapshot -- --json`
- [x] 4.4 `pnpm env:doctor:local-keycloak --json`
- [x] 4.5 `pnpm env:repair:local-keycloak -- --json`
