# Inventar zur Package-Zielarchitektur-Transition

Stand: 2026-04-24

> Historischer Vorzustandsbericht: Dieses Inventar beschreibt den Stand vor dem Hard-Cut der Zielarchitektur. Seit 2026-05-02 ist `@sva/sdk` aus dem aktiven Workspace entfernt; maßgeblich für den Abschluss ist `./sdk-removal-report.md`.

## Zweck

Dieser Bericht dokumentiert Phase 0 des OpenSpec-Changes `refactor-package-target-architecture-hard-cut`. Er hält den aktuellen Zuschnitt, die wichtigsten Importkanten, Boundary-Ausnahmen und Sicherheitsgrenzen fest, bevor die Package-Zielarchitektur hart umgesetzt wird.

Der Bericht ist bewusst kein Zielbild. Er beschreibt die heutige Ausgangslage und die daraus folgenden ersten Schnittkanten.

## Aktuelle Workspace-Projekte

| Projekt | Package | Aktueller Scope-Tag | Zielrolle |
| --- | --- | --- | --- |
| `core` | `@sva/core` | `scope:core` | bleibt Core-Fundament |
| `data` | `@sva/data` | `scope:data` | aufzuteilen in `data-client` und `data-repositories` |
| `sdk` | `@sva/sdk` | `scope:sdk` | aufzuteilen in Plugin-SDK und Server-Runtime |
| `auth` | `@sva/auth` | `scope:auth` | aufzuteilen in Auth-Runtime, IAM-Core, IAM-Admin, IAM-Governance und Instance-Registry |
| `routing` | `@sva/routing` | `scope:routing` | soll von Auth-Runtime-Implementierungen entkoppelt werden |
| `plugin-news` | `@sva/plugin-news` | `scope:plugin` | bleibt fachliches Plugin über SDK-Vertrag |
| `sva-mainserver` | `@sva/sva-mainserver` | `scope:integration` | bleibt Integration, muss Credential-Vertrag entkoppeln |
| `monitoring-client` | `@sva/monitoring-client` | `scope:monitoring` | bleibt Monitoring-Baustein |
| `sva-studio-react` | App | `scope:app` | bleibt UI, Router-Wiring und Server-Funktionsadapter |

## Aktuelle Sammelpackages

### `@sva/auth`

`@sva/auth` enthält heute mehrere Zielrollen gleichzeitig:

- Auth-Runtime: `auth-server`, OIDC, Session, Middleware, Runtime-Routen, Runtime-Health.
- IAM-Core: Autorisierung, effektive Rechte, Permission-Snapshots, `evaluateAuthorizeDecision`-Nutzung.
- IAM-Admin: Account-Management, Rollen, Gruppen, Organisationen, User-Sync, Reconcile.
- IAM-Governance: Governance, DSR, Legal Texts, Auditing.
- Instance-Registry: Instanzmodell, Provisioning, Keycloak-Control-Plane.
- Shared Server-Hilfen: Request-Kontext, Runtime-Secrets, Logging-Anbindung.

Erste Zielkanten:

- `packages/auth/src/auth-server/**`, `middleware.server.ts`, `oidc.server.ts`, `redis-session.server.ts`, `runtime-routes.server.ts`, `runtime-health.server.ts` nach `@sva/auth-runtime`.
- `packages/auth/src/iam-authorization/**` nach `@sva/iam-core`.
- `packages/auth/src/iam-account-management/**`, `iam-groups/**`, `iam-organizations/**`, `keycloak-admin-client/**` nach `@sva/iam-admin`.
- `packages/auth/src/iam-governance/**`, `iam-data-subject-rights/**`, `iam-legal-texts/**`, `iam-auditing/**` nach `@sva/iam-governance`.
- `packages/auth/src/iam-instance-registry/**` nach `@sva/instance-registry`.

### `@sva/data`

`@sva/data` enthält heute:

- universelle Einstiegspunkte über `src/index.ts`;
- serverseitige Repository-Exports über `src/server.ts`;
- IAM-Repositories unter `src/iam/**`;
- Instance-Registry-Repositories unter `src/instance-registry/**`;
- Integrationsdaten unter `src/integrations/**`;
- DB- und Migrations-nahe Nx-Targets.

Erste Zielkanten:

- client-sichere Typen, HTTP-/Schema-Verträge und universelle Hilfen nach `@sva/data-client`;
- Postgres-Repositories, Registry-Repositories und DB-nahe Operationen nach `@sva/data-repositories`;
- serverseitige Secrets und Ciphertext-Felder bleiben serverseitig und dürfen nicht über client-sichere Exports erreichbar sein.

### `@sva/sdk`

`@sva/sdk` enthält heute:

- Plugin-Verträge: Plugins, Admin-Ressourcen, Content-Types, Plugin-i18n, Build-Time-Registry.
- Browser-nahe Logging-Hilfen.
- Server-Runtime: Logger, Request-Kontext, JSON-Fehlerantworten, Bootstrap, OTEL-/Monitoring-Bridge.
- Instance-Konfiguration unter `src/instance/config.server.ts`.

Erste Zielkanten:

- Plugin- und Host-Erweiterungsverträge nach `@sva/plugin-sdk`.
- serverseitige Runtime-Hilfen nach `@sva/server-runtime`.
- Browser-Logging muss entweder als client-sicherer SDK-Export explizit bleiben oder in einen klar benannten Client-Runtime-Vertrag.

## Aktuelle kritische Importkanten

| Quelle | Ziel | Bewertung | Zielzustand |
| --- | --- | --- | --- |
| `@sva/routing` | `@sva/auth` | verletzt Zielbild | Routing nutzt neutrale Route-/Handler-Contracts, Auth-Implementierung bleibt in `auth-runtime` |
| `@sva/routing` | `@sva/sdk/server` | teilweise legitim für serverseitige Diagnostics | auf `server-runtime` umstellen oder per injiziertem Diagnostics-Vertrag entkoppeln |
| `@sva/sva-mainserver` | `@sva/auth/server` | Credential-Vertrag hängt an Auth-Sammelpackage | Credential-Port in Zielvertrag verschieben |
| `@sva/sva-mainserver` | `@sva/data/server` | Integration liest serverseitige Konfiguration | künftig über `data-repositories` oder integrationsspezifischen Repository-Port |
| App | `@sva/auth/server` | Server-Funktionen nutzen Auth-Sammelpackage | auf `auth-runtime` und Fachpackage-Server-Verträge umstellen |
| App | `@sva/sdk/server` | Server-Funktionen nutzen SDK-Server-Runtime | auf `server-runtime` umstellen |
| App | `@sva/core` für viele IAM-Typen | kurzfristig tragfähig | prüfen, welche Typen nach `iam-core`, `iam-admin` oder client-sichere Contracts gehören |
| Plugins | `@sva/sdk` | heute korrekt | später auf finalen Plugin-SDK-Namen festlegen |

## Boundary-Disables

Produktive Ausnahmen:

- `packages/routing/src/auth.routes.ts`
- `packages/routing/src/route-paths.ts`

Diese Ausnahmen erlauben aktuell Routing-Imports aus `@sva/auth`. Sie sind die erste konkrete Schnittkante für die Routing-Transition.

Test-/Tooling-Ausnahmen:

- `packages/sdk/tests/check-server-package-runtime.test.ts`
- `packages/sdk/tests/image-platform.test.ts`
- `packages/sdk/tests/deploy-feedback-loop.test.ts`
- `packages/sdk/tests/remote-stack-state.test.ts`
- `packages/sdk/tests/check-file-placement.test.ts`
- `packages/sdk/tests/studio-release-local.test.ts`
- `packages/sdk/tests/bootstrap-job.test.ts`
- `packages/sdk/tests/remote-service-spec.test.ts`
- `packages/sdk/tests/check-openapi-iam.test.ts`
- `packages/sdk/tests/deploy-project.test.ts`
- `packages/sdk/tests/migration-job.test.ts`
- `packages/sdk/tests/runtime-env.shared.test.ts`
- `packages/sdk/tests/complexity-gate.test.ts`

Diese Ausnahmen liegen überwiegend in Tooling-/CI-Tests. Sie sind niedriger priorisiert als produktive Routing-Ausnahmen, müssen aber vor dem finalen Hard Cut entweder entfernt oder bewusst als Tooling-Ausnahme neu begründet werden.

## Aktuelle `depConstraints`

Die aktuelle Boundary-Regel erlaubt noch alte Kanten:

- `scope:routing` darf `scope:auth` importieren.
- `scope:integration` darf `scope:auth` importieren.
- `scope:app` darf `scope:auth` und `scope:sdk` direkt importieren.
- `scope:sdk` darf `scope:data` importieren.
- Es gibt noch keine Ziel-Tags für `auth-runtime`, `iam-core`, `iam-admin`, `iam-governance`, `instance-registry`, `plugin-sdk`, `server-runtime`, `data-client` und `data-repositories`.
- Es gibt noch keine expliziten PII- oder Credential-Tags.

Die Enforcement-Phase muss diese Regeln ersetzen, nicht nur ergänzen.

## PII- und Credential-Flüsse

Aktuelle klare PII-/Credential-Hotspots:

- `packages/auth/src/iam-account-management/encryption.ts` verarbeitet IAM-PII-Verschlüsselung.
- `packages/auth/src/iam-account-management/user-update-utils.ts` schützt E-Mail-Felder.
- `packages/auth/src/iam-account-management/user-detail-query.mapping.ts` entschlüsselt Account-Daten.
- `packages/auth/src/iam-data-subject-rights/**` und `iam-governance/**` benötigen PII für Betroffenenrechte und Governance-Fälle.
- `packages/auth/src/iam-instance-registry/service-keycloak.ts` entschlüsselt Tenant-/Auth-Client-Secrets aus der Registry.
- `packages/data/src/instance-registry/index.ts` persistiert Ciphertext-Felder und Tenant-Admin-E-Mail.
- `packages/sva-mainserver/src/server/service.ts` lädt und cached Mainserver-Credentials und Access Tokens.
- `packages/monitoring-client/src/otel.server.ts` enthält Redaction-Regeln für Token, Secrets, E-Mail und Authorization-Daten.

Zielklassifikation:

| Zielpackage | Klassifikation |
| --- | --- |
| `@sva/iam-core` | definiert Autorisierungs- und Verschlüsselungsinvarianten |
| `@sva/iam-admin` | darf autorisiert Klartext-PII verarbeiten |
| `@sva/iam-governance` | darf autorisiert Klartext-PII für DSR/Governance verarbeiten |
| `@sva/auth-runtime` | darf Session-, Token- und OIDC-Claims verarbeiten |
| `@sva/instance-registry` | darf Credentials/Secrets nur für Provisioning-Control-Plane verarbeiten; kein allgemeiner PII-Klartext |
| `@sva/data-repositories` | persistiert Ciphertext und DB-Daten, trifft aber keine fachliche Entschlüsselungsentscheidung |
| `@sva/data-client` | keine Entschlüsselungsfähigkeit, keine DB-Treiber |
| `@sva/server-runtime` | Redaction und Request-Kontext, keine fachliche PII-Verarbeitung |
| `@sva/*-integration` | konsumiert explizite Credential-Ports, keine Auth-Runtime-Interna |

## Freeze-Regel ab diesem Change

Neue Funktionalität darf nicht mehr ohne Zielpackage-Zuordnung in `@sva/auth`, `@sva/data` oder `@sva/sdk` landen.

Zulässige Ausnahmen während der Transition:

- reine Bugfixes, die bestehendes Verhalten stabilisieren;
- mechanische Vorbereitung für Package-Schnitte;
- Tests, die bestehende Migrationsrisiken absichern;
- temporäre Re-Exports mit dokumentierter Entfernungsvoraussetzung.

Nicht zulässig:

- neue IAM-Fachlogik direkt unter `packages/auth/src` ohne Zielpackage-Zuordnung;
- neue serverseitige DB-Hilfen im universal importierbaren `@sva/data`-Entry;
- neue Server-Runtime-Hilfen im Plugin-SDK-Vertrag;
- neue Routing-Imports aus Auth- oder IAM-Implementierungen.

## Empfohlene erste Umsetzungsschritte

1. Ziel-Tags und Package-Namensentscheidungen finalisieren.
2. `@sva/iam-core` als erstes Zielpackage schneiden, weil Autorisierung alle IAM-Fachpackages stabilisiert.
3. `@sva/server-runtime` aus `@sva/sdk/server` vorbereiten, weil fast alle Serverpackages davon abhängen.
4. Routing-zu-Auth-Kopplung über neutrale Route-Contracts brechen.
5. Erst danach große Fachmodule aus `@sva/auth` verschieben.
