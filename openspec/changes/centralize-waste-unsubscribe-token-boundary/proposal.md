# Change: Waste-Abmeldetoken an einer gemeinsamen Contracts-Grenze zentralisieren

## Why

Das Studio erzeugt signierte Abmeldetoken für den öffentlichen E-Mail-Erinnerungsdienst, während die Public-Waste-App dieselben Token liest und verifiziert. Die beiden Apps besitzen dafür derzeit getrennte Implementierungen. Ein Studio-Test importiert zusätzlich direkt aus `apps/public-waste-calendar-web/src/**`.

Dieser Cross-App-Import erzeugt im Nx-Projektgraphen die sachlich falsche Kante `sva-studio-react -> public-waste-calendar-web`. Weil `sva-studio-react:test:types` vorgelagerte Builds über `^build` ausführt, kann dadurch eine lokale Public-Waste-Konfigurationsabweichung den Studio-Typecheck stoppen, bevor dessen eigentlicher TypeScript-Lauf startet. Gleichzeitig kann die doppelte kryptografische Implementierung zwischen Erzeugung und Verifikation auseinanderlaufen.

## What Changes

- verlagert Erzeugung, Lesen und Verifikation signierter Waste-Abmeldetoken in den leichten serverseitigen Export `@sva/waste-management-contracts/unsubscribe-token`
- stellt Studio und Public-Waste-App auf denselben kanonischen Tokenvertrag um
- entfernt die beiden app-lokalen Tokenimplementierungen und den direkten Cross-App-Quellimport
- ergänzt `@sva/waste-management-contracts` als deklarierte `workspace:*`-Dependency beider Apps
- führt gemeinsame Token-, Job- und Importprofildefinitionen in einem eigenständigen Contracts-Paket zusammen, das Browser-Plugin und Job-Runtime konsumieren, ohne einen Plugin-/UI-Baum in den Public-Waste-Produktions-Deploy einzuziehen
- erhält Tokenversion, Signaturverfahren und bestehende `v1`-Tokenkompatibilität ohne fachliche oder persistenzseitige Migration
- ergänzt einen generischen, getesteten Boundary-Check gegen Quellimporte zwischen unterschiedlichen Apps
- aktualisiert die betroffene arc42-Bausteinsicht und Paketdokumentation

## Out of Scope

- keine Änderung der Public-Waste-Konfigurationsvalidierung oder Abschwächung von `public_waste_config_invalid`
- keine Änderung von `dependsOn: ["^build"]` oder der Nx-Buildreihenfolge
- keine Änderung an Secret-Werten, Datenbankrollen, Tabellen oder Migrationen
- keine Änderung der fachlichen DOI-, Reminder- oder Abmeldeabläufe
- keine Rotation, zeitliche Begrenzung oder neue Versionierung bestehender Abmeldetoken
- kein breites Aufräumen anderer App- oder Package-Grenzen

## Impact

- Affected specs:
  - `monorepo-structure`
- Affected code:
  - `packages/waste-management-contracts/src/**`
  - `packages/waste-management-contracts/tests/**`
  - `packages/waste-management-runtime/src/runtime-job-helpers.ts`
  - `apps/sva-studio-react/src/lib/waste-management-email-reminder-dispatch.server.ts`
  - `apps/sva-studio-react/src/lib/waste-management-email-reminders.server.test.ts`
  - `apps/sva-studio-react/src/lib/waste-management-unsubscribe-token.server.ts`
  - `apps/public-waste-calendar-web/src/server/public-waste-email-reminders.server.ts`
  - `apps/public-waste-calendar-web/src/server/public-waste-email-reminders.server.test.ts`
  - `apps/public-waste-calendar-web/src/server/public-waste-unsubscribe-token.server.ts`
  - `apps/public-waste-calendar-web/package.json`
  - `pnpm-lock.yaml`
  - `scripts/ci/check-app-boundaries.ts` und zugehörige Vitest-Tests
  - Root-Skripte und CI-Gates, die den App-Boundary-Check aufrufen
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/package-gesamtuebersicht.md`
  - `docs/architecture/package-zielarchitektur.md`

## Success Criteria

- Studio und Public-Waste-App konsumieren denselben serverseitigen Tokenvertrag aus `@sva/waste-management-contracts/unsubscribe-token`.
- Bestehende `v1`-Testvektoren werden nach der Verlagerung unverändert erzeugt und akzeptiert.
- Im Nx-Projektgraphen existiert keine Kante `sva-studio-react -> public-waste-calendar-web` mehr.
- `sva-studio-react:test:types` zieht `public-waste-calendar-web:build` nicht mehr als vorgelagerten Task heran.
- Der verbindliche `check:app-boundaries`-Check lehnt direkte Quellimporte zwischen unterschiedlichen Apps ab.
- Die strikte Public-Waste-Konfigurationsvalidierung bleibt unverändert bestehen.
