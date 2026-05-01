# @sva/iam-admin

Serverseitiges TypeScript-Package für administrative IAM-Abläufe. Das Package bündelt Handler, Queries, Validierungsschemas und Hilfslogik für Benutzer-, Rollen-, Gruppen- und Organisationsverwaltung sowie für die Synchronisation mit einem angebundenen Identity Provider.

## Architektur-Rolle

`@sva/iam-admin` ist eine Bibliothek innerhalb der IAM- und Server-Domäne. Sie stellt keine eigene Transport- oder UI-Schicht bereit, sondern exportiert Fabrikfunktionen und Hilfsbausteine, die von darüberliegenden Server-Adaptern eingebunden werden können.

Die Implementierung sitzt zwischen fachlichen Kernbausteinen wie `@sva/core` und `@sva/iam-core` sowie Infrastrukturzugriffen wie `@sva/data-repositories` und einem injizierten Identity-Provider-Port. Der lokale `QueryClient`-Typ zeigt zudem, dass Datenbankzugriffe bewusst über eine kleine Abstraktionsschicht eingebunden werden.

## Öffentliche API

Der öffentliche Einstiegspunkt ist `src/index.ts`. Er re-exportiert die API in thematischen Gruppen:

- Benutzerverwaltung: unter anderem Read-Handler, Create-/Update-/Deactivate-Handler, Bulk-Deaktivierung, Detail- und Listen-Queries sowie Import- und Synchronisationsbausteine für Benutzer.
- Rollenverwaltung: Read-, Create-, Update- und Delete-Handler, Persistenz für Rollenmutationen, Rollenauflösung, Audit-Hilfen und Abgleichlogik für verwaltete Rollen.
- Gruppen und Organisationen: Read- und Mutation-Handler, Query-Funktionen, Typen und Zod-Schemas für Gruppen, Legacy-Gruppen und Organisationen.
- Querschnittsfunktionen: Actor-Autorisierung und -Auflösung, Profil-Kommandos, Verschlüsselungshilfen, Fehler- und Basistypen sowie SQL-Bausteine für Benutzerdetail-Berechtigungen.

Für Integrationen ist der Barrel-Export `@sva/iam-admin` vorgesehen; zusätzliche Einstiegspunkte sind in `package.json` nicht deklariert.

## Nutzung und Integration

Das Package wird als Workspace-Library eingebunden und als ESM-Paket aus `dist/index.js` veröffentlicht. Die Nutzung erfolgt typischerweise über Fabrikfunktionen, denen abhängige Infrastruktur wie Datenbankzugriffe, Logger oder ein Identity-Provider-Adapter injiziert werden.

```ts
import {
  createRoleReadHandlers,
  createUserReadHandlers,
} from '@sva/iam-admin';

const userHandlers = createUserReadHandlers(/* abhängige Services */);
const roleHandlers = createRoleReadHandlers(/* abhängige Services */);
```

Für Identity-Provider-Integrationen definiert `src/identity-provider-port.ts` das erwartete Port-Interface, einschließlich Benutzer- und Rollenoperationen. Für Datenbankabfragen nutzt das Package einen kleinen `QueryClient`-Vertrag aus `src/query-client.ts`.

## Projektstruktur

- `src/index.ts`: zentraler Barrel-Export der öffentlichen API.
- `src/user-*`, `src/role-*`, `src/group-*`, `src/organization-*`: domänenspezifische Handler, Queries, Persistenz, Mappings und Schemas.
- `src/legacy-group-*`: separate Kompatibilitätsbausteine für Legacy-Gruppen.
- `src/*.test.ts`: colocated Unit-Tests für die jeweiligen Module.
- `project.json`, `tsconfig.lib.json`, `vitest.config.ts`: Nx-, TypeScript- und Test-Konfiguration des Packages.

## Nx-Konfiguration

Das Nx-Projekt heißt `iam-admin`, hat `packages/iam-admin/src` als `sourceRoot` und ist als Library mit den Tags `scope:iam-admin`, `type:lib` und `pii:yes` markiert.

Konfigurierte Targets in `project.json`:

- `build`: kompiliert das Package mit `tsc -p packages/iam-admin/tsconfig.lib.json` nach `dist/`.
- `check:runtime`: prüft nach dem Build die Server-Package-Runtime-Regeln über `scripts/ci/check-server-package-runtime.ts`.
- `lint`: lintet die Quellmodule unter `src/`.
- `test:unit`: führt die Vitest-Unit-Tests des Packages aus.
- `test:types`: führt einen TypeScript-Typcheck ohne Emit aus.
- `test:coverage`: startet die Unit-Tests mit Coverage-Erhebung.

## Verwandte Dokumentation

- [DEVELOPMENT_RULES.md](../../DEVELOPMENT_RULES.md): verbindliche Entwicklungsregeln für Logging, Sicherheit, Dokumentation und Server-Runtime.
- [AGENTS.md](../../AGENTS.md): Repository-spezifische Arbeitsregeln, Test-Gates und Dokumentationsvorgaben.
- [docs/architecture/README.md](../../docs/architecture/README.md): Einstiegspunkt für die Architektur-Dokumentation des Workspaces.
