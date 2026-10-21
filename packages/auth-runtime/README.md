# @sva/auth-runtime

Serverseitiges Laufzeitpaket für Authentifizierung, Session-Auflösung und IAM-HTTP-Endpunkte im SVA-Studio-Monorepo. Das Package bündelt OIDC-Login/Callback/Logout, Redis-gestützte Session-Verarbeitung, tenantfähige Auth-Konfiguration sowie die Handler für IAM-Bereiche wie Benutzer, Rollen, Gruppen, Organisationen, Inhalte, Medien, Governance, Betroffenenrechte und Instanz-Registry.

## Architektur-Rolle

`@sva/auth-runtime` sitzt im direkten Serverpfad zwischen Routing, Request-Kontext und fachlichen IAM-Operationen. Laut [Request-Flow-Szenarien](../../docs/architecture/request-flow-szenarien.mmd) wird das Package sowohl für direkte Auth-/IAM-Endpunkte als auch für Session- und Guard-Auflösung innerhalb von Server Functions verwendet.

Die Laufzeit trennt dabei mehrere Verantwortungen:

- Host- und Scope-Auflösung für Root-Domain und Tenant-Hosts über `src/config.ts`, `src/request-hosts.ts` und `src/config-request.ts`
- OIDC-Flow mit PKCE und Session-Cookies über `src/auth-server/` und die sieben HTTP-Handler aus `src/auth-route-handlers.ts`. Deren interne `auth-route-*`-Module trennen Login/Account-Action, Callback, `/auth/me`, Logout sowie gemeinsame Response-, Cookie- und State-Hilfen; der bestehende Entrypoint initialisiert OTEL beim Import.
- Auth-Middleware mit Tenant-Validierung, Session-Hydration und Legal-Text-Compliance über `src/middleware.ts`
- IAM-v1-HTTP-Handler für Benutzer, Rollen, Gruppen, Organisationen, Inhalte, Medien, Governance, Data Subject Rights und Instanzverwaltung über die jeweiligen `src/iam-*/`-Module
- Betriebsnahe Readiness-/Liveness-Prüfungen für Postgres, Redis, Keycloak und den Authorization-Cache über `src/runtime-health.ts`

Damit ist das Package die serverseitige Integrationsschicht, die Auth-Zustand, Runtime-Abhängigkeiten und IAM-Fachlogik in einen konsistenten HTTP-Vertrag überführt.

## Öffentliche API

Die Hauptoberfläche wird über [src/index.ts](./src/index.ts) exportiert. Wesentliche Exportgruppen sind:

- Routen und Route-Typen: `authRoutePaths`, `AuthRoutePath`
- Auth-Konfiguration: `getAuthConfig`, `resolveAuthConfigForRequest`, `resolveAuthConfigForInstance`, `resolveAuthConfigFromSessionAuth`, `resolveBaseAuthConfig`
- Middleware und Session-Kontext: `withAuthenticatedUser`, `resolveSessionUser`, `validateTenantHost`, `shouldEnforceLegalTextCompliance`, `withLegalTextCompliance`
- Audit und Logging: `emitAuthAuditEvent`, `persistAuthAuditEventToDb`, `persistAuthAuditEventWithClient`, `buildLogContext`
- Scope- und Session-Hilfen: `DEFAULT_WORKSPACE_ID`, `PLATFORM_WORKSPACE_ID`, `getRuntimeScopeRef`, `getScopeFromAuthConfig`, `getWorkspaceIdForScope`, Session- und Auth-Typen aus `src/types.ts`
- Krypto- und Mocking-Helfer: `encryptToken`, `decryptToken`, `generateEncryptionKey`, `isEncrypted`, `createMockSessionUser`, `isMockAuthEnabled`
- Redis- und Runtime-Fehleroberfläche: `getRedisClient`, `isRedisAvailable`, `getRedisHealthSnapshot`, `SessionStoreUnavailableError`, `SessionUserHydrationError`, `TenantAuthResolutionError`, `TenantScopeConflictError`
- JIT-Provisionierung und Mainserver-Credentials: `jitProvisionAccount`, `jitProvisionAccountWithClient`, `readSvaMainserverCredentials`, `readSvaMainserverCredentialsWithStatus`
- Medienintegration: `createMediaService`, `withMediaRepository`, `withMediaService`, `completeMediaUploadHandler`

Zusätzlich stellt das Package Subpath-Exports für spezifische Laufzeitflächen bereit:

- `@sva/auth-runtime/routes`
- `@sva/auth-runtime/runtime-routes`
- `@sva/auth-runtime/runtime-health`
- `@sva/auth-runtime/server`

`src/server.ts` ist dabei die serverseitige Fassade für häufige Handler und Guards, während `src/runtime-routes.ts` die einzelnen IAM- und Auth-Handler nach Endpunktgruppen exportiert.

## Nutzung und Integration

Typische Integrationspunkte im Monorepo sind:

- Auth- und IAM-Routing bindet die Handler aus `src/runtime-routes.ts` ein, etwa `loginHandler`, `callbackHandler`, `authorizeHandler`, `instanceRegistryHandlers` oder die CRUD-Handler aus `iam-account-management`, `iam-groups`, `iam-organizations`, `iam-contents`, `iam-media` und `iam-legal-texts`.
- Serverseitige Fachpfade schützen geschützte Operationen über `withAuthenticatedUser(request, handler)`. Die Middleware liest das Session-Cookie aus, hydriert den Benutzer über Redis, validiert Tenant-Hosts fail-closed und erzwingt bei Bedarf offene Rechtstext-Bestätigungen.
- Multi-Host-Auth wird über `resolveAuthConfigForRequest()` und `resolveAuthConfigForInstance()` aufgelöst. Das Package unterscheidet Plattform- und Instanz-Scope und folgt dem kanonischen Auth-Host aus [ADR-020](../../docs/adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md).
- Health-Endpunkte verwenden `healthReadyHandler` und `healthLiveHandler` aus dem Subpath `runtime-health`. `ready` prüft Datenbank, Redis, Keycloak und den Authorization-Cache und liefert bei Fehlern diagnostische `reasonCode`s.
- Per-User-Mainserver-Credentials werden serverseitig über `mainserver-credentials.ts` aus Keycloak-Attributen gelesen. Das schließt an [ADR-021](../../docs/adr/ADR-021-per-user-sva-mainserver-delegation.md) an.

Vorausgesetzte Laufzeitabhängigkeiten sind insbesondere:

- Postgres für IAM-Daten (`src/db.ts`)
- Redis für Session-Store und Cache-nahe Hilfspfade (`src/redis.ts`, `src/redis-session.ts`); der öffentliche Session-Import bündelt intern Speicherung, Login-State und Session-Kontrolle
- ein OIDC-/Keycloak-Setup für Login, Logout, User-Attribute und Admin-Zugriffe (`src/oidc.ts`, `src/keycloak-admin-client/`)
- `@sva/server-runtime` fuer Request-Kontext, Logger und OTEL-Initialisierung

## Projektstruktur

Die fachliche Struktur ist im `src/`-Verzeichnis in klar getrennte Laufzeitsegmente zerlegt:

- `src/auth-server/`: Login-, Callback-, Logout- und Session-Bausteine für den OIDC-Flow
- `src/iam-account-management/`: Benutzer-, Rollen-, Gruppenbezug-, Profil-, Reconcile- und Sync-Handler
- `src/iam-authorization/`: Authorize-Endpunkte, Permission-Store und Redis-basierter Snapshot-Cache
- `src/iam-contents/`: Inhalts-CRUD, History, Content-Type-Registry und serverseitige Autorisierung
- `src/iam-data-subject-rights/`: DSGVO-/Betroffenenrechte, Exporte, Legal Holds und Self-Service-Pfade
- `src/iam-groups/`, `src/iam-organizations/`, `src/iam-legal-texts/`, `src/iam-governance/`: modulare IAM-Fachsegmente
- `src/iam-instance-registry/`: Instanz- und Keycloak-nahe Registry-Handler
- `src/iam-media/`: Medienrepository, Upload-Sessions, Delivery und Autorisierung
- `src/keycloak-admin-client/`: eigener Admin-Client für Keycloak-nahe Runtime-Aufrufe
- `src/shared/`: Request-Sicherheit, Rate Limits, Validatoren und Input-Helfer

Tests liegen ko-lokal als `*.test.ts` neben den jeweiligen Implementierungen. `vitest.config.ts` schließt `dist/`, `coverage/` und `node_modules/` aus und testet die Quellen direkt über Alias-Auflösungen auf andere Workspace-Pakete.

## Nx-Konfiguration

Die Nx-Definition steht in [project.json](./project.json) und beschreibt das Package als Library mit `sourceRoot` `packages/auth-runtime/src`.

Verfügbare Targets:

- `build`: kompiliert das Package mit `tsc -p packages/auth-runtime/tsconfig.lib.json`
- `check:runtime`: führt nach dem Build den Server-Runtime-Check für das Package aus
- `lint`: lintet `src/**/*.{ts,tsx,js,jsx}`
- `test:unit`: startet die Vitest-Suite im Package
- `test:types`: prüft die Typkompatibilität über `tsc --noEmit`
- `test:coverage`: führt die Unit-Tests mit Coverage aus

Das veröffentlichte `package.json` exportiert neben dem Root-Entry gezielt die Subpaths `./routes`, `./runtime-routes`, `./runtime-health` und `./server`.

## Verwandte Dokumentation

- [docs/architecture/request-flow-szenarien.mmd](../../docs/architecture/request-flow-szenarien.mmd)
- [docs/architecture/08-cross-cutting-concepts.md](../../docs/architecture/08-cross-cutting-concepts.md)
- [docs/architecture/12-glossary.md](../../docs/architecture/12-glossary.md)
- [docs/adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md](../../docs/adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md)
- [docs/adr/ADR-021-per-user-sva-mainserver-delegation.md](../../docs/adr/ADR-021-per-user-sva-mainserver-delegation.md)

## Interne feste App-Kataloge

`executeAppTranslationOperation(request, input)` aus `@sva/auth-runtime/server` bietet intern die Operationen `overview`, `import`, `createMunicipal`, `changeBase`, `read`, `readRelease`, `edit`, `reset`, `confirm` und `seal`. `appTranslationCatalogHandler` bindet den lokalen Editor über `/api/v1/iam/app-translations` an dieselbe Fassade: GET nur für Übersicht/Entwurf/Prüfstand, POST für Mutationen. POST begrenzt den gestreamten JSON-Body auf 1 MiB und verlangt CSRF sowie `X-SVA-Catalog-Scope` als Bindung an den zuvor geladenen Sessionbereich; dieser Header vergibt keine Rechte. Ein inzwischen geänderter Scope führt zu `409 catalog_conflict`. Instanz und Organisation kommen ausschließlich aus der gespeicherten Session; Payload-Scopefelder werden abgewiesen. Mutationen benötigen POST/CSRF. Der Header `X-SVA-Catalog-Mode: source` bindet an Deutsch und eigenständige Hostrechte `app-texts.catalog.read/write/publish`, ohne Pluginpflicht. Der Server filtert Fremdsprachen und weist nichtdeutsche Mutationen ab; Deutsch-only-Versiegelung wartet nicht auf Übersetzungen. `translations` benötigt die expliziten `app-translations.catalog.read/write/publish`, aktuellen Pluginzugang und zentral/instanzweit freigegebene Sprachen. Dieser Modus darf keine deutschen Texte ändern. `configureLocales` übernimmt erlaubte Sprachen ausdrücklich in den Entwurf, ohne ausgeschlossene Texte zu löschen. Root importiert ausschließlich Deutsch. Keine dieser UI-Optionen vergibt Rechte.

`/api/v1/iam/languages` erlaubt ausschließlich verifizierten Root-Sessions zentrale Verfügbarkeitsänderungen und instanzweite Zuordnungen. POST verlangt CSRF, strikt validierte Codes/Revisionen und höchstens 4 KiB. Die Aktivierung benötigt aktiven bereiten Pluginzugang; Repositoryprüfungen sperren die aktuellen Freigabe-/Modul-/Lifecyclezeilen. Deutsch ist unveränderlich verfügbar. Keine automatische Instanzauswahl, keine Anbieteranfrage oder Mobile-App-Auslieferung.

Manifestformat und zulässige Werte sind in `@sva/core` typisiert und streng validiert. Revisionen sind Dezimalstrings. Fehlende Sprachwerte oder prüfbedürftige Korrekturen verhindern `seal`; das Ergebnis bleibt ausschließlich lokal `sealed`. Keine DeepL-/Main-Server-/Buildintegration in diesem Abschnitt.

Abschnitt 2B ergänzt den aktuellen Pluginzugang vor kommunalem Repositoryzugriff. `readAppTranslationsLocalReadiness(instanceId)` ist ein Hostaufruf für aktive Instanz und vorhandenes Katalogschema; er liefert ausschließlich `schemaReady` und `providerConfigured`. Der Key wird über `APP_TRANSLATIONS_DEEPL_API_KEY` oder `/run/secrets/sva_studio_app_translations_deepl_api_key` gelesen und niemals als Status ausgegeben. Kein Provideraufruf und keine Remotebereitschaft werden dadurch behauptet. Die Studio-Composition injiziert diese Funktion in den lokalen Pluginjob; neue Service-/Statusrouten gehören nicht zu 2B.
