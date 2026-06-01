# Change: Lokale Runtime-Drift-Reparatur ohne Neuaufsetzen

## Why

Lokale `local-keycloak`-Umgebungen drifteten zuletzt in mehreren Schichten gleichzeitig: Registry-Identitaet, tenant-spezifische Secrets und der eingecheckte DB-Snapshot hatten jeweils unterschiedliche Fehlerbilder. Der normale Startpfad wurde bewusst read-only gemacht, es fehlte aber ein ebenso klarer, idempotenter Repair-Pfad.

## What Changes

- fuehrt einen expliziten lokalen Repair-Befehl fuer `local-keycloak` ein
- erweitert den Doctor-Vertrag um maschinenlesbare Driftklassen, Reason-Codes und Handlungsempfehlungen
- verankert den DB-Snapshot als abgeleitetes Artefakt und ergaenzt einen separaten Snapshot-Verifikationsbefehl
- sperrt gefaehrliche Runtime- und Bootstrap-Pfade standardmaessig hinter expliziten Approval-Tokens
- dokumentiert den Betriebsvertrag `up -> doctor -> repair -> reset`

## Impact

- Affected specs:
  - `deployment-topology`
  - `instance-provisioning`
- Affected code:
  - `scripts/ops/runtime-env.ts`
  - `scripts/ops/runtime-env.shared.ts`
  - `scripts/ops/runtime/db-schema-snapshot.ts`
  - `package.json`
  - `docs/development/runtime-profile-betrieb.md`
  - `docs/guides/lokale-instanz-db-initialisierung.md`
  - `docs/guides/troubleshooting.md`
  - `docs/architecture/10-quality-requirements.md`
- Affected arc42 sections:
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
