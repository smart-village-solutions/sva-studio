# Package-Zielarchitektur

## Ziel und Einordnung

Dieses Dokument beschreibt die umgesetzte Zielstruktur für die Package-Struktur des SVA Studio. Es ergänzt die Bausteinsicht in `./05-building-block-view.md` und dient als verbindliche Leitplanke für funktionales Wachstum, Refactorings und OpenSpec-Changes mit Architekturwirkung.

Der harte Package-Schnitt ist durch den OpenSpec-Change `refactor-package-target-architecture-hard-cut` umgesetzt: neue fachliche Arbeit nutzt die Zielpackages direkt. Das frühere Sammelpackage `@sva/auth` ist aus dem aktiven Workspace entfernt; `@sva/data` und `@sva/sdk` behalten nur ausdrücklich dokumentierte Altpfade.

## Architekturziele

- Fachliche Verantwortlichkeiten sollen pro Package klar erkennbar sein.
- Framework-agnostische Kernlogik bleibt von React-, TanStack- und Node-Runtime-Bindings getrennt.
- Serverseitig von Node geladene Packages bleiben ESM-strikt und verwenden explizite Runtime-Endungen.
- Plugins konsumieren Host-Verträge nur über `@sva/plugin-sdk` und nicht direkt über interne Core- oder App-Module.
- Autorisierung, Routing, Datenzugriff, Runtime-Kontext und UI-Komposition bleiben getrennte Änderungsachsen.
- Große IAM- und Instanz-Funktionalität liegt in den fachlichen Zielpackages und wächst nicht mehr in historischen Sammelpackages.
- PII-Datenflüsse werden bei Package-Schnitten explizit klassifiziert; nur autorisierte Fachmodule dürfen personenbezogene Daten im Klartext verarbeiten (siehe [PII-Datenfluss-Regel](#pii-datenfluss-regel)).
- `@sva/iam-core` ist der einzige Ort für zentrale Autorisierungsentscheidungen (`authorize()`); Fachmodule konsumieren diesen Vertrag, duplizieren ihn nicht (Fail-closed bei fehlendem Autorisierungskontext).

## Umgesetzter Stand

Die aktuelle Struktur trennt die vorherigen Sammelrollen in eigenständige Pakete:

- `@sva/core` enthält framework-agnostische Verträge und reine Kernlogik.
- `@sva/plugin-sdk` stellt Host-, Plugin-, Registry- und Content-Type-Verträge bereit.
- `@sva/server-runtime` stellt Request-Kontext, Logging, Fehlerantworten und OTEL-Bootstrap bereit.
- `@sva/data-client` stellt den client-sicheren HTTP-/Schema-Client bereit.
- `@sva/data-repositories` bündelt serverseitige Repositories, Migration-nahe Typen und DB-Zugriffe.
- `@sva/auth-runtime` enthält Authentifizierung, Session, OIDC, Cookies, Auth-Middleware und Runtime-Routen.
- `@sva/iam-core` enthält zentrale Autorisierungsverträge und die Permission-Entscheidung.
- `@sva/iam-admin` enthält Benutzer, Rollen, Gruppen, Organisationen, Actor-Auflösung, Reconcile und Keycloak-nahe Admin-Orchestrierung.
- `@sva/iam-governance` enthält Governance, Legal Texts, DSR und audit-nahe IAM-Fachfälle.
- `@sva/instance-registry` enthält Instanzmodell, Host-Klassifikation, Registry, Provisioning und Tenant-Keycloak-Control-Plane.
- `@sva/routing` stellt Route-Factories, Pfade, Guards und serverseitiges Auth-Routing bereit.
- `@sva/sva-mainserver` kapselt die externe Mainserver-Integration.
- `@sva/plugin-news` zeigt das Zielmuster für fachliche Plugins.
- `apps/sva-studio-react` enthält UI, TanStack-Start-Runtime, Router-Wiring und App-nahe Server-Funktionen.

Die größte frühere strukturelle Last aus `@sva/auth` ist fachlich aufgelöst. Das Package ist kein aktiver Workspace-Baustein mehr.

## Ziel-Layer

```mermaid
flowchart TB
  App[apps/sva-studio-react]
  Plugins[@sva/plugin-*]
  Routing[@sva/routing]
  PluginSdk[@sva/plugin-sdk]
  AuthRuntime[@sva/auth-runtime]
  IamCore[@sva/iam-core]
  IamAdmin[@sva/iam-admin]
  IamGovernance[@sva/iam-governance]
  InstanceRegistry[@sva/instance-registry]
  Integrations[@sva/*-integration]
  DataRepos[@sva/data-repositories]
  DataClient[@sva/data-client]
  ServerRuntime[@sva/server-runtime]
  Core[@sva/core]
  Monitoring[@sva/monitoring-client]

  App --> Routing
  App --> PluginSdk
  App --> AuthRuntime
  App --> Integrations
  App --> DataClient
  App -.->|über Server-Funktionen| IamAdmin
  App -.->|über Server-Funktionen| IamGovernance
  App -.->|über Server-Funktionen| InstanceRegistry
  Plugins --> PluginSdk
  Routing --> Core
  Routing --> PluginSdk
  AuthRuntime --> IamCore
  AuthRuntime --> ServerRuntime
  AuthRuntime --> DataRepos
  IamCore --> Core
  IamCore --> ServerRuntime
  IamAdmin --> IamCore
  IamAdmin --> ServerRuntime
  IamAdmin --> DataRepos
  IamGovernance --> IamCore
  IamGovernance --> ServerRuntime
  IamGovernance --> DataRepos
  InstanceRegistry --> IamCore
  InstanceRegistry --> ServerRuntime
  InstanceRegistry --> DataRepos
  Integrations --> Core
  Integrations --> ServerRuntime
  Integrations -.->|nur Credential-Vertrag| AuthRuntime
  Integrations --> DataRepos
  DataRepos --> Core
  DataRepos --> ServerRuntime
  DataClient --> Core
  ServerRuntime --> Core
  ServerRuntime --> Monitoring
  PluginSdk --> Core
  Monitoring --> Core
```

Die Zielrollen sind als Workspace-Packages vorhanden und werden über Nx-, ESLint- und Runtime-Gates abgesichert.

## Ziel-Packages und Verantwortlichkeiten

| Zielbaustein | Verantwortung | Aktueller Ort | Zielregel |
| --- | --- | --- | --- |
| `@sva/core` | Pure Domänenverträge, Value Objects, Validierungslogik ohne Runtime-Bindung | `packages/core` | Bleibt basal und darf keine App-, DB-, SDK- oder Runtime-Abhängigkeiten aufnehmen. |
| `@sva/plugin-sdk` | Öffentlicher Vertrag für Plugins, Registries, Admin-Ressourcen, Content-Type-Erweiterungen, Plugin-i18n | `packages/plugin-sdk` | Plugins dürfen Host-Funktionen nur über diesen Vertrag konsumieren. |
| `@sva/server-runtime` | Request-Kontext, JSON-Fehlerantworten, Logger-Fassade, OTEL-Bootstrap, Workspace-Kontext | `packages/server-runtime` | Server-Hilfen bleiben fachfrei und dürfen keine IAM-Fachlogik enthalten. |
| `@sva/data-client` | HTTP-Client, Cache, Runtime-Schema-Validierung für Browser-/Universal-Zugriff | `packages/data-client` | Keine DB-Treiber, keine serverseitigen Repositories, keine IAM-Fachlogik. |
| `@sva/data-repositories` | Postgres-Repositories, Migration-nahe Typen, DB-Operationen | `packages/data-repositories` | Keine UI- oder Routing-Abhängigkeiten; nur serverseitige Konsumenten. |
| `@sva/auth-runtime` | OIDC, Login, Logout, Session, Cookies, Silent-Reauth, Auth-Middleware, Runtime-Routen | `packages/auth-runtime` | Authentifizierung und Session bleiben getrennt von IAM-Fachverwaltung. |
| `@sva/iam-core` | Permission Engine, Authorize-Verträge, effektive Rechte, IAM-Basisregeln | `packages/iam-core` | Fachliche Entscheidung bleibt zentral; Fachmodule duplizieren keine Berechtigungsauflösung. |
| `@sva/iam-admin` | Benutzer, Rollen, Gruppen, Organisationen, Keycloak-Admin-Abstraktion, Reconcile | `packages/iam-admin` | Admin-Funktionalität bleibt aus Auth-Runtime herausgelöst. |
| `@sva/iam-governance` | Governance-Cases, DSR, Legal Texts, Audit-nahe IAM-Fachfälle | `packages/iam-governance` | Compliance-nahe Fachlogik hat eigene Ownership und eigene Tests. |
| `@sva/instance-registry` | Instanzmodell, Host-Klassifikation, Registry, Provisioning, Keycloak-Tenant-Control-Plane | `packages/instance-registry` | Instanzverwaltung ist eine eigene Control-Plane, nicht eine Unterfunktion von Auth. |
| `@sva/routing` | Route-Verträge, Search-Param-Normalisierung, Route-Factories, Guard-Schnittstellen | `packages/routing` | Routing kennt Verträge und verdrahtet Runtime-Routen über `@sva/auth-runtime`. |
| `@sva/*-integration` | Downstream-Integrationen mit getrennten client-sicheren Typen und serverseitigen Adaptern | `packages/sva-mainserver` | Integrationspakete kapseln OAuth2, GraphQL, Secret-Lookups und Fehlerabbildung. |
| `@sva/plugin-*` | Fachliche Erweiterungen über Plugin-SDK-Verträge | `packages/plugin-news` | Keine Direktimporte aus `@sva/core`, `@sva/auth-runtime`, `@sva/iam-*`, `@sva/instance-registry`, `@sva/data` oder App-Modulen. |
| `apps/sva-studio-react` | UI, TanStack Start, Router-Wiring, App-Shell, Server-Funktionen als Adapter | `apps/sva-studio-react` | Keine dauerhafte Domänenlogik, keine rohen DB-/Keycloak-/GraphQL-Zugriffe im Browser-Bundle. |

## Erlaubte Abhängigkeitsrichtung

Die Zielrichtung ist eine gerichtete Schichtung:

1. App und Plugins konsumieren öffentliche Verträge.
2. Routing konsumiert Core- und SDK-Verträge, aber keine Auth-Runtime-Implementierung.
3. Fachmodule konsumieren `@sva/iam-core`, Server-Runtime und serverseitige Repositories.
4. `@sva/iam-core` konsumiert Core und Server-Runtime, aber keine Fachmodule.
5. Repositories konsumieren Core und Server-Runtime, aber keine Fachmodule.
6. Core bleibt ohne Workspace-Abhängigkeiten.

Ergänzende Regeln:

- App greift auf IAM-Fachmodule (`iam-admin`, `iam-governance`, `instance-registry`) **ausschließlich über Server-Funktionen** zu, nicht über direkte Package-Imports im Browser-Bundle.
- Integrations-Packages (`@sva/*-integration`) dürfen Auth-Runtime **nur für den Credential-Vertrag** konsumieren (z. B. `getPerUserCredentials()`), nicht für Session- oder Middleware-Zugriff.

Nicht zulässig im Zielbild:

- `@sva/routing` importiert historische Auth-Sammelpackages für Pfade oder Runtime-Handler.
- Plugins importieren `@sva/core`, `@sva/auth-runtime`, `@sva/iam-*`, `@sva/instance-registry`, `@sva/data` oder App-Code direkt.
- App-Komponenten modellieren IAM-, Instanz- oder Integrationsregeln selbst.
- `@sva/sdk` nimmt fachliche IAM-, Daten- oder Routing-Entscheidungen auf.
- Fachmodule greifen direkt auf fremde Fachmodul-Interna zu, statt über öffentliche Verträge zu gehen.

## PII-Datenfluss-Regel

Bei der Package-Aufteilung gelten folgende PII-Klassifikationsgrenzen (vgl. `./iam-datenklassifizierung.md`, ADR-010):

| Zielpackage | PII-Verarbeitungsrecht | Begründung |
| --- | --- | --- |
| `@sva/iam-core` | Definiert Verschlüsselungsvertrag und Autorisierungs-Invariante | Zentraler Entscheidungspunkt |
| `@sva/iam-admin` | Darf PII entschlüsseln und im Klartext verarbeiten | Verwaltung von Benutzerkonten, Profilen, Rollen |
| `@sva/iam-governance` | Darf PII entschlüsseln und im Klartext verarbeiten | DSR, Löschanfragen, Audit erfordern Klartextzugriff |
| `@sva/auth-runtime` | Darf Session- und Token-Claims verarbeiten (Name, E-Mail aus OIDC) | Authentifizierungsflow |
| `@sva/instance-registry` | Kein PII im Klartext | Registry-Daten sind mandantenbezogen, nicht personenbezogen |
| `@sva/routing` | Kein PII im Klartext | Routing ist fachfrei |
| `@sva/plugin-sdk` | Kein PII im Klartext | Plugins erhalten PII nur über Host-Verträge, nie direkt |
| `@sva/data-repositories` | Stellt nur verschlüsselte Felder bereit | Entschlüsselung geschieht in der Fachschicht (`iam-admin`, `iam-governance`) |
| `@sva/data-client` | Kein PII im Klartext | Browser-/Universal-Zugriff ohne Entschlüsselungsfähigkeit |

Neue Packages, die PII verarbeiten, müssen dies in ihrer `project.json` mit einem `pii:yes`-Tag kennzeichnen und den Verschlüsselungsvertrag aus `@sva/iam-core` konsumieren.

## Autorisierungs-Invariante

`@sva/iam-core` ist der **einzige** Ort für `authorize()`-Entscheidungen:

- Fachmodule (`iam-admin`, `iam-governance`, `instance-registry`) **konsumieren** diesen Vertrag.
- Keine Fachmodul-internen Berechtigungsprüfungen gegen IAM-Tabellen.
- Fail-closed bei fehlendem Autorisierungskontext (vgl. `./08-cross-cutting-concepts.md`).
- Keycloak-Admin-Zugriffe laufen über einen singulären IdP-Port (vgl. ADR-016):
  - `@sva/iam-admin` nutzt den **Tenant-Admin-Client**.
  - `@sva/instance-registry` nutzt den **Platform-Admin-Client**.
  - Beide konsumieren denselben Port, halten aber keine eigenen Keycloak-Credentials.

## Ehemalige Hotspots und heutige Zielgrenzen

### Auth und IAM

Das frühere Sammelpackage `@sva/auth` ist nicht mehr der fachliche Sammelort. Die Rollen sind getrennt:

- Auth-Runtime: Login, Session, OIDC, Cookies, Middleware, Runtime-Routes.
- IAM-Fachmodule: Administration, Autorisierung, Governance, DSR, Instanzen.

Neue Endpunkte im IAM-Umfeld werden einem fachlichen Zielpackage zugeordnet. Kompatibilitätsadapter über `@sva/auth` sind nicht mehr Teil des aktiven Workspace-Vertrags.

### Routing

`@sva/routing` bezieht Auth-Pfade und Runtime-Handler über `@sva/auth-runtime`.

Boundary-Disables für `@nx/enforce-module-boundaries` in produktiven Routing-Dateien sind nicht zulässig; bekannte Ausnahmen müssen blockierend dokumentiert werden.

### SDK

`@sva/sdk` ist nicht mehr Zielort für neue Plugin- oder Server-Runtime-Verträge. Die Zielrollen sind getrennt:

- `@sva/plugin-sdk` für Plugin- und Host-Erweiterungsverträge
- `@sva/server-runtime` für Logging, Request-Kontext, OTEL und Fehlerantworten

### Data

`@sva/data` ist nicht mehr Zielort für neue DataClient- oder Repository-Funktionalität. Die Zielrollen sind getrennt:

- universeller HTTP- und Schema-validierter DataClient
- serverseitige Postgres-Repositories und Migration-nahe Datenzugriffe

Neue DB-nahe Funktionen sollen nicht im universal importierbaren Entry landen. Browser- und Server-Exports bleiben getrennt.

### Instanz-Registry

Die Instanz-Registry ist eine eigene Control-Plane und kein Nebenbereich von Auth. Host-Klassifikation, Registry-Daten, Provisioning, Keycloak-Tenant-Verträge und Admin-UI müssen gemeinsam betrachtet werden.

Neue Instanzfunktionen sollen das Zielpackage `@sva/instance-registry` vorbereiten:

- Core-Verträge und Statusmodelle bleiben framework-agnostisch.
- Repositories liegen serverseitig.
- Keycloak-Provisioning wird über eine Fassade gekapselt.
- UI ruft nur öffentliche Server-Funktionen oder HTTP-Verträge auf.

## Umsetzungs- und Betriebsregel

Die Zielarchitektur ist durch den harten OpenSpec-Schnitt umgesetzt. Für laufende Entwicklung gelten jetzt diese Regeln:

- Neue Fachlogik wird direkt im fachlichen Zielpackage umgesetzt.
- Alte Sammelimporte werden nicht für neue Consumer verwendet.
- Kompatibilitätsadapter in `@sva/data` und `@sva/sdk` dürfen keine neue Ownership begründen; `@sva/auth` ist kein aktiver Kompatibilitätspfad mehr.
- Pro neuem oder geändertem serverseitigem Package bleiben `build`, `lint`, `test:unit`, `test:types` und `check:runtime` Teil des lokalen Gates.
- Nx-`depConstraints`, `no-restricted-imports` und `check:server-runtime` sind die durchsetzenden Grenzen.
- Architektur- und OpenSpec-Dokumentation werden im selben Change aktualisiert, wenn sich Package-Grenzen ändern.

## Entscheidungsregeln für neue Funktionalität

Vor jeder funktionalen Erweiterung ist zu klären:

| Frage | Konsequenz |
| --- | --- |
| Betrifft die Änderung Authentifizierung oder Session? | Zielbaustein `auth-runtime`. |
| Betrifft sie Rechte, Rollen, Gruppen, Organisationen oder Reconcile? | Zielbaustein `iam-admin` oder `iam-core`. |
| Betrifft sie DSR, Legal, Governance oder Audit-Fachfälle? | Zielbaustein `iam-governance`. |
| Betrifft sie Instanzen, Hosts, Provisioning oder Tenant-Keycloak? | Zielbaustein `instance-registry`. |
| Betrifft sie Plugin-Erweiterungen, Content-Type-Definitionen oder Admin-Ressourcen? | Zielbaustein `plugin-sdk`; Fachlogik in Plugin oder Fachmodul. |
| Betrifft sie Downstream-Systeme wie den SVA-Mainserver? | Eigenes Integrationspackage. |
| Betrifft sie nur UI-Zustand und Darstellung? | App-Layer; Domänenentscheidungen bleiben außerhalb. |

Wenn mehr als zwei Zielbausteine betroffen sind, benötigt die Änderung ein OpenSpec-`design.md` und eine Prüfung der arc42-Abschnitte 04, 05, 06, 08, 10 und 11.

## Qualitäts- und Testregeln

- Jedes neue Package erhält `build`, `lint`, `test:unit` und bei Node-Runtime-Relevanz `check:runtime`.
- Server-Package-Exports müssen Node-ESM-konforme Runtime-Imports mit expliziter `.js`-Endung verwenden.
- Cross-Package-Verträge erhalten Contract-Tests.
- Herausgelöste Packages behalten zunächst die bestehenden Tests, bevor Tests fachlich neu zugeschnitten werden.
- Für UI-nahe Änderungen bleiben i18n-, Accessibility- und E2E-Gates relevant.
- Vor PR-Erstellung ist bevorzugt `pnpm test:pr` auszuführen; bei gezielter Modularisierung mindestens die betroffenen Nx-Targets plus `pnpm check:server-runtime`.

## Technische Schulden und Abbaupriorität

| Priorität | Schuld | Zielzustand |
| --- | --- | --- |
| P1 | Rückfall auf alte Sammelimporte in neuen Consumer-Pfaden. | Lint, Nx-Boundaries und Review-Regel verhindern neue Kanten. |
| P1 | Fachlogik wächst wieder in Kompatibilitätsadapter. | Adapter bleiben dünn; Ownership liegt im Zielpackage. |
| P2 | Zielpackages und alte README-/Architekturhinweise driften auseinander. | Arc42, Package-READMEs und OpenSpec-Tasks werden im selben Change gepflegt. |
| P2 | Server-Runtime-Imports verlieren Node-ESM-Konformität. | `check:server-runtime` bleibt Teil der Gates für serverseitige Packages. |
| P3 | Tests bleiben historisch nach Altpackage gruppiert. | Neue Tests werden fachlich im Zielpackage ergänzt; alte Tests werden nur bei Bedarf nachgezogen. |

## Pflege-Regeln

- Dieses Dokument wird aktualisiert, wenn Packages geschnitten, Abhängigkeitsrichtungen geändert oder neue Zielbausteine eingeführt werden.
- OpenSpec-Changes mit Package- oder Boundary-Wirkung müssen dieses Dokument in `proposal.md` unter betroffenen arc42-Abschnitten referenzieren.
- Abweichungen vom Zielbild sind möglich, müssen aber im Change oder ADR begründet werden.
- Neue Architekturentscheidungen mit dauerhafter Wirkung werden zusätzlich als ADR dokumentiert und in `./09-architecture-decisions.md` verlinkt.

## Verweise

### Arc42-Abschnitte

- `./04-solution-strategy.md`
- `./05-building-block-view.md`
- `./08-cross-cutting-concepts.md`
- `./09-architecture-decisions.md`
- `./11-risks-and-technical-debt.md`
- `./iam-service-architektur.md`
- `./iam-datenklassifizierung.md`

### Relevante ADRs

- ADR-010 — Verschlüsselung IAM Core Data Layer (PII-Datenfluss)
- ADR-016 — IAM-IdP-Abstraktion für Keycloak-Admin-Pfade (Keycloak-Port-Zuordnung)
- ADR-017 — Modulare IAM-Server-Bausteine (Fassade-plus-Kernmodul-Strategie)
- ADR-030 — Registry-basierte Instance-Freigabe und Provisioning (Instance-Registry)
- ADR-034 — Plugin-SDK-Vertrag v1 (Plugin-Isolation)
- ADR-036 — Kanonischer IAM-Projektions- und Reconcile-Vertrag (IAM-Admin)

### Entwicklungsdokumentation

- `../development/iam-server-modularization.md`
- `../development/server-package-runtime-guards.md`

### OpenSpec-Specs

- `../../openspec/specs/monorepo-structure/spec.md`
- `../../openspec/specs/iam-server-modularization/spec.md`
- `../../openspec/specs/plugin-actions/spec.md`
