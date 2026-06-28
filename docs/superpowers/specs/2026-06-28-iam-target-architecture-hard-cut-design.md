# IAM-Zielarchitektur-Hard-Cut

## Kontext

Der IAM-Code wurde bereits stark modularisiert, aber die Umsetzung hängt noch an mehreren Übergangsstellen. Die dokumentierte Zielarchitektur nennt `@sva/iam-core` als zentralen Ort für Autorisierungsentscheidungen, während die eigentliche Engine aktuell noch in `@sva/core` liegt. `@sva/auth-runtime` ist zudem breiter geworden als der Name nahelegt und enthält neben Authentifizierung und Session auch viele hostgeführte IAM-Route-Adapter.

Diese Spec beschreibt einen harten Architektur-Schnitt: alte Importpfade und Fassaden werden nicht langfristig parallel erhalten. Interne und package-public Consumer werden im selben Change auf die Zielgrenzen migriert.

## Ziele

- `@sva/iam-core` wird der einzige Ort für zentrale Authorize-Verträge und die reine Authorize-Engine.
- `@sva/core` verliert IAM-Authorize-Ownership und bleibt bei framework-agnostischen, nicht-IAM-spezifischen Kernverträgen.
- `@sva/auth-runtime` bleibt für Authentifizierung, OIDC, Session, Cookies, Auth-Middleware, Runtime-Route-Wiring und Request-Kontext verantwortlich.
- `@sva/iam-admin` verantwortet User, Roles, Groups, Organizations, Actor-Resolution, Tenant-Keycloak-Admin-Port und Reconcile.
- `@sva/iam-governance` verantwortet DSR, Legal Texts, Governance Workflows und audit-nahe IAM-Fachfälle.
- Performance im `authorize`-Hot-Path bleibt mindestens auf dem aktuellen Niveau.

## Nicht-Ziele

- Keine dauerhaften Deprecation-Bridges für alte Imports.
- Kein funktionaler Umbau der Permission-Snapshot-Persistenz, solange sie Runtime-Infrastruktur bleibt.
- Keine vollständige Zerlegung der Frontend-Datei `iam-api.ts` als Pflichtteil der ersten Umsetzung.
- Keine neuen externen Dependencies.

## Zielarchitektur

`@sva/iam-core` enthält nach dem Cut die Authorize-Engine, Authorize-Contracts, Reason Codes, Permission-/Resource-Typen und alle reinen Regeln, die ohne Runtime-, DB-, Redis-, React- oder Keycloak-Abhängigkeit auswertbar sind. Fachpackages konsumieren diese API direkt.

`@sva/auth-runtime` importiert Authorize-Verträge aus `@sva/iam-core`. Permission-Store, Redis-Snapshot, HMAC-Prüfung, DB-Recompute und Runtime-Route-Handler bleiben zunächst dort, weil sie Runtime-Infrastruktur und operative Abhängigkeiten besitzen. Die eigentliche Entscheidung wird aber durch `@sva/iam-core` getroffen.

`@sva/iam-admin` und `@sva/iam-governance` stellen fachliche APIs bereit. Die Root-Barrels werden verkleinert oder durch fachliche Subpath-Exports ergänzt, zum Beispiel `@sva/iam-admin/users`, `@sva/iam-admin/roles`, `@sva/iam-admin/groups`, `@sva/iam-admin/organizations` und passende Governance-Subpfade. Breite Datei-Re-Exports ohne fachliche Grenze werden entfernt.

## Naming-Regeln

- Runtime-Wiring in `auth-runtime` heißt `*RouteAdapter` oder `*RuntimeHandler`.
- Fachliche Factories in `iam-admin` und `iam-governance` heißen `create*Handler`, `create*UseCase` oder fachlich konkreter, aber nicht `create*Internal`.
- Doppelte Dateinamen zwischen Runtime-Adapter und Fachpackage werden aufgelöst, wenn sie die Ownership verschleiern.
- Neue öffentliche Exporte müssen an fachliche Capabilities gebunden sein, nicht an historisch gewachsene Dateinamen.

## Migrationsphasen

### Phase 1: Core Extraction

`authorization-contract`, `authorization-engine`, Authorize-Reason-Codes, Performance-/Authorize-Verträge und zugehörige Tests ziehen nach `packages/iam-core/src`. Consumer von `AuthorizeRequest`, `AuthorizeResponse`, `EffectivePermission`, `IamAction`, `evaluateAuthorizeDecision` und verwandten Typen werden auf `@sva/iam-core` migriert. `@sva/core` bietet keine neue Kompatibilitätsfassade für diese Exporte.

### Phase 2: Runtime Adapter Cleanup

`auth-runtime` importiert Authorize-Typen und Engine aus `@sva/iam-core`. Der Permission-Store bleibt unverändert nah an Redis, DB und Runtime-Kontext. Account-Management-Dateien in `auth-runtime` werden als Adapter-Schicht benannt und auf Dependency-Wiring, Request-Kontext, Auth-Guards und Response-Mapping begrenzt.

### Phase 3: Domain Package API Cut

`iam-admin` und `iam-governance` erhalten kleinere, fachliche Entry-Points. Alte breite Re-Exports werden entfernt. App, Routing, Scripts und Tests werden direkt auf die Zielimporte migriert. Buildfehler während der Migration sind akzeptiert, bis alle Consumer umgestellt sind.

### Phase 4: Frontend and Routing Cleanup

Frontend- und Routing-Consumer importieren Authorize- und IAM-Typen aus den Zielpackages. `apps/sva-studio-react/src/lib/iam-api.ts` wird nur soweit angepasst, wie es für korrekte Imports und Zielgrenzen erforderlich ist. Eine spätere fachliche Aufteilung in `iam-users-api`, `iam-roles-api`, `iam-governance-api`, `iam-content-api` und `iam-media-api` bleibt ein Folge-Refactoring.

## Performance-Anforderungen

- Der `authorize`-Hot-Path darf keine zusätzlichen DB- oder Redis-Roundtrips erhalten.
- `evaluateAuthorizeDecision` bleibt synchron, rein und ohne Runtime-Abhängigkeiten.
- Snapshot-Keying, L1/L2-Cache, Redis-HMAC und Recompute-Verhalten bleiben im ersten Cut funktional unverändert.
- Bestehende Performance-Baselines und SLOs bleiben maßgeblich, insbesondere Cache-Hit-Pfade unter 50 ms, wo dies bereits spezifiziert ist.
- Vor und nach der Migration werden die vorhandenen Authorize-/Permission-Store-Tests und, soweit lokal praktikabel, der IAM-Authorize-Performance-Run verglichen.

## Fehlerbehandlung und Logging

- Fehlender oder unvollständiger Autorisierungskontext bleibt fail-closed.
- Error-Codes und öffentliche Fehlerverträge werden durch den Cut nicht umbenannt.
- Es werden keine Runtime-Fallbacks für alte Importpfade eingeführt.
- Operative Logs bleiben über `@sva/server-runtime` strukturiert und PII-/Token-redacted.
- Neue `console.*`-Pfade in Server-Code sind ausgeschlossen.

## Tests und Gates

Nach Phase 1:

- `pnpm nx run iam-core:test:unit`
- `pnpm nx run iam-core:test:types`
- `pnpm nx run iam-core:check:runtime`

Nach Phase 2:

- gezielte `auth-runtime:test:unit`-Runs für `src/iam-authorization/**`
- `pnpm nx run auth-runtime:test:types`
- `pnpm nx run auth-runtime:check:runtime`

Nach Phase 3:

- betroffene `iam-admin`, `iam-governance`, `routing` und App-Unit-/Type-Tests
- Server-Runtime-Gates für alle geänderten serverseitigen Packages

Vor PR-Reife:

- mindestens affected Unit- und Type-Gates
- bevorzugt `pnpm test:pr`, wenn Zeit und Ressourcen passen
- Performance-Nachweis für Authorize, falls der Hot-Path strukturell berührt wurde

## OpenSpec-Folgeschritt

Die Umsetzung benötigt ein OpenSpec Change Proposal, weil sie Package-Grenzen, öffentliche APIs und Architekturverträge betrifft. Der Change sollte mindestens die Specs `iam-core`, `iam-server-modularization`, `iam-access-control`, `architecture-documentation` und bei Bedarf `monorepo-structure` referenzieren. Als Change-ID bietet sich `refactor-iam-target-architecture-hard-cut` an.

## Risiken und Gegenmaßnahmen

- Breiter Compile-Radius durch Hard Cut: Umsetzung in den oben beschriebenen Phasen und nach jeder Phase kleinste relevante Gates ausführen.
- Performance-Regression im Authorize-Pfad: Engine rein halten und Snapshot-/Redis-/DB-Pfad nicht gleichzeitig fachlich umbauen.
- Verdeckte Importzyklen durch neue Barrels: nach API-Cut Fallow für Circular Dependencies und Re-export-Cycles ausführen.
- Unklare Ownership bei Route-Adaptern: Adapter-Naming verbindlich machen und Fachlogik in Zielpackages halten.
