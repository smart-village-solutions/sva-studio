## 1. Discovery

- [x] 1.1 Aktive Referenzen auf `@sva/auth`, `packages/auth` und das Nx-Projekt `auth` außerhalb historischer Archive erfassen
- [x] 1.2 Bestätigen, dass App, Routing, Mainserver und aktive Packages ausschließlich Zielpackages verwenden
- [x] 1.3 Entfernbare Konfigurationsstellen in Root-Scripts, Runtime-Checks, Coverage, Complexity und Workspace-Docs listen
- [x] 1.4 Aktive OpenSpec-Specs und nicht-archivierte OpenSpec-Changes mit `packages/auth`-Bezug als Blocker oder Migrationspunkt erfassen

## 2. Implementation

- [x] 2.1 `auth` aus aktiven Root-Scripts und Workspace-Gates entfernen oder durch Zielpackage-Gates ersetzen (`test:types`, `check:server-runtime`, Nx-Projektgraph)
- [x] 2.2 CI-Skripte mit Direktimports oder `createRequire` gegen `packages/auth` auf Zielpackages oder dedizierte Script-Fixtures umstellen (`scripts/ci/run-iam-acceptance.ts`, `scripts/ci/check-openapi-iam.ts`)
- [x] 2.3 Coverage-/Complexity-Konfiguration und Baselines von `auth` und `packages/auth/src/**` bereinigen oder auf fachliche Zielpackages migrieren
- [x] 2.4 Aktive OpenSpec-Specs von aktuellem `packages/auth`-Vertrag bereinigen, insbesondere `iam-access-control`
- [x] 2.5 Nicht-archivierte OpenSpec-Changes mit `packages/auth`-Impact vor dem Löschen auf Zielpackages korrigieren oder als blockierend dokumentieren
- [x] 2.6 Falls Tests explizit `@sva/auth` als Beispielpackage erwarten, auf ein temporäres Fixture oder `@sva/auth-runtime` umstellen (`packages/sdk/tests/check-server-package-runtime.test.ts`)
- [x] 2.7 Aktive Dokumentation unter `docs/` von aktuellem `@sva/auth`-Vertrag bereinigen und verbleibende Nennungen eindeutig als historisch markieren
- [x] 2.8 `packages/auth` samt Package-, Nx-, Source-, Test-, Bench-, Dist- und Coverage-Dateien löschen
- [x] 2.9 Workspace-Install-State und `pnpm-lock.yaml` nach Entfernung des Workspace-Packages aktualisieren

## 3. Validation

- [x] 3.1 `pnpm nx show projects` ausführen und bestätigen, dass `auth` nicht mehr gelistet ist
- [x] 3.2 `pnpm test:types` ausführen
- [x] 3.3 `pnpm check:server-runtime` ausführen
- [x] 3.4 `pnpm test:unit` oder mindestens `pnpm nx affected --target=test:unit --base=origin/main` ausführen
- [x] 3.5 Quality-Gates für Coverage/Complexity ausführen (`pnpm test:coverage:pr` oder `pnpm test:pr`)
- [x] 3.6 `pnpm install --lockfile-only` oder einen äquivalenten pnpm-Lockfile-Check ausführen und sicherstellen, dass `pnpm-lock.yaml` keine aktive `packages/auth`-Importer-Spur mehr enthält
- [x] 3.7 `pnpm check:file-placement` ausführen
- [x] 3.8 `rg "@sva/auth|packages/auth|auth:test|auth:build|projects=.*auth"` ausführen und verbleibende Treffer als historisch, archiviert oder nicht-produktiv klassifizieren
- [x] 3.9 `pnpm test:pr` vor PR-Erstellung nach Möglichkeit ausführen
- [x] 3.10 `openspec validate remove-legacy-auth-package --strict` ausführen
