# Package-Zielarchitektur

## Ziel und Einordnung

Dieses Dokument beschreibt das Zielbild für die Package-Struktur des SVA Studio. Es ergänzt die Bausteinsicht in `./05-building-block-view.md` und dient als Leitplanke für funktionales Wachstum, Refactorings und OpenSpec-Changes mit Architekturwirkung.

Das Ziel ist nicht, sofort alle bestehenden Packages aufzuteilen. Das Ziel ist, neue Funktionalität ab jetzt konsequent in fachlich tragfähige Grenzen zu lenken und bestehende Hotspots schrittweise zu entlasten.

## Architekturziele

- Fachliche Verantwortlichkeiten sollen pro Package klar erkennbar sein.
- Framework-agnostische Kernlogik bleibt von React-, TanStack- und Node-Runtime-Bindings getrennt.
- Serverseitig von Node geladene Packages bleiben ESM-strikt und verwenden explizite Runtime-Endungen.
- Plugins konsumieren Host-Verträge nur über das SDK und nicht direkt über interne Core- oder App-Module.
- Autorisierung, Routing, Datenzugriff, Runtime-Kontext und UI-Komposition bleiben getrennte Änderungsachsen.
- Große IAM- und Instanz-Funktionalität wächst nicht weiter unkontrolliert in `@sva/auth`.
- PII-Datenflüsse werden bei Package-Schnitten explizit klassifiziert; nur autorisierte Fachmodule dürfen personenbezogene Daten im Klartext verarbeiten (siehe [PII-Datenfluss-Regel](#pii-datenfluss-regel)).
- `@sva/iam-core` ist der einzige Ort für zentrale Autorisierungsentscheidungen (`authorize()`); Fachmodule konsumieren diesen Vertrag, duplizieren ihn nicht (Fail-closed bei fehlendem Autorisierungskontext).

## Aktuelle Ausgangslage

Die aktuelle Struktur ist grundsätzlich tragfähig:

- `@sva/core` enthält framework-agnostische Verträge und reine Kernlogik.
- `@sva/sdk` stellt Host-, Plugin-, Logging- und Server-Kontext-Verträge bereit.
- `@sva/data` bündelt Datenzugriff, Repositories, Seeds und DB-nahe Hilfen.
- `@sva/auth` enthält Authentifizierung, Session, IAM, Governance, DSR, Instanzverwaltung und Keycloak-nahe Control-Plane-Logik.
- `@sva/routing` stellt Route-Factories, Pfade, Guards und serverseitiges Auth-Routing bereit.
- `@sva/sva-mainserver` kapselt die externe Mainserver-Integration.
- `@sva/plugin-news` zeigt das Zielmuster für fachliche Plugins.
- `apps/sva-studio-react` enthält UI, TanStack-Start-Runtime, Router-Wiring und App-nahe Server-Funktionen.

Die größte strukturelle Last liegt in `@sva/auth`. Dort liegen mehrere fachliche Subdomänen, die langfristig eigene Bausteine verdienen.

## Ziel-Layer

```mermaid
flowchart TB
  App[apps/sva-studio-react]
  Plugins[@sva/plugin-*]
  Routing[@sva/routing]
  PluginSdk[@sva/plugin-sdk / @sva/sdk]
  AuthRuntime[@sva/auth-runtime]
  IamCore[@sva/iam-core]
  IamAdmin[@sva/iam-admin]
  IamGovernance[@sva/iam-governance]
  InstanceRegistry[@sva/instance-registry]
  Integrations[@sva/*-integration]
  DataRepos[@sva/data-repositories]
  DataClient[@sva/data-client]
  ServerRuntime[@sva/server-runtime / @sva/sdk-server]
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

Die Namen `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/data-client` und `@sva/data-repositories` sind Zielrollen. Sie müssen nicht sofort als neue Packages existieren. Solange sie in bestehenden Packages liegen, gelten die Verantwortungsgrenzen trotzdem.

## Ziel-Packages und Verantwortlichkeiten

| Zielbaustein | Verantwortung | Aktueller Ort | Zielregel |
| --- | --- | --- | --- |
| `@sva/core` | Pure Domänenverträge, Value Objects, Validierungslogik ohne Runtime-Bindung | `packages/core` | Bleibt basal und darf keine App-, DB-, SDK- oder Runtime-Abhängigkeiten aufnehmen. |
| `@sva/plugin-sdk` | Öffentlicher Vertrag für Plugins, Registries, Admin-Ressourcen, Content-Type-Erweiterungen, Plugin-i18n | aktuell `packages/sdk` | Plugins dürfen Host-Funktionen nur über diesen Vertrag konsumieren. |
| `@sva/server-runtime` | Request-Kontext, JSON-Fehlerantworten, Logger-Fassade, OTEL-Bootstrap, Workspace-Kontext | aktuell `packages/sdk/server` | Server-Hilfen bleiben fachfrei und dürfen keine IAM-Fachlogik enthalten. |
| `@sva/data-client` | HTTP-Client, Cache, Runtime-Schema-Validierung für Browser-/Universal-Zugriff | aktuell `packages/data/src/index.ts` | Keine DB-Treiber, keine serverseitigen Repositories, keine IAM-Fachlogik. |
| `@sva/data-repositories` | Postgres-Repositories, Migration-nahe Typen, DB-Operationen | aktuell `packages/data` | Keine UI- oder Routing-Abhängigkeiten; nur serverseitige Konsumenten. |
| `@sva/auth-runtime` | OIDC, Login, Logout, Session, Cookies, Silent-Reauth, Auth-Middleware | aktuell `packages/auth` | Authentifizierung und Session bleiben getrennt von IAM-Fachverwaltung. |
| `@sva/iam-core` | Permission Engine, Authorize-Verträge, effektive Rechte, IAM-Basisregeln | aktuell `packages/core` und `packages/auth` | Fachliche Entscheidung bleibt zentral; Fachmodule duplizieren keine Berechtigungsauflösung. |
| `@sva/iam-admin` | Benutzer, Rollen, Gruppen, Organisationen, Keycloak-Admin-Abstraktion, Reconcile | aktuell `packages/auth/src/iam-account-management`, `iam-groups`, `iam-organizations`, `keycloak-admin-client` | Admin-Funktionalität wird aus Auth-Runtime herausgelöst. |
| `@sva/iam-governance` | Governance-Cases, DSR, Legal Texts, Audit-nahe IAM-Fachfälle | aktuell `packages/auth/src/iam-governance`, `iam-data-subject-rights`, `iam-legal-texts`, `iam-auditing` | Compliance-nahe Fachlogik bekommt eigene Ownership und eigene Tests. |
| `@sva/instance-registry` | Instanzmodell, Host-Klassifikation, Registry, Provisioning, Keycloak-Tenant-Control-Plane | aktuell `packages/core`, `packages/data`, `packages/auth`, App-UI | Instanzverwaltung wird als eigene Control-Plane behandelt, nicht als Unterfunktion von Auth. |
| `@sva/routing` | Route-Verträge, Search-Param-Normalisierung, Route-Factories, Guard-Schnittstellen | aktuell `packages/routing` | Routing kennt Verträge, aber keine Auth-Runtime-Implementierung. |
| `@sva/*-integration` | Downstream-Integrationen mit getrennten client-sicheren Typen und serverseitigen Adaptern | aktuell `packages/sva-mainserver` | Integrationspakete kapseln OAuth2, GraphQL, Secret-Lookups und Fehlerabbildung. |
| `@sva/plugin-*` | Fachliche Erweiterungen über SDK-Verträge | aktuell `packages/plugin-news` | Keine Direktimporte aus `@sva/core`, `@sva/auth`, `@sva/data` oder App-Modulen. |
| `apps/sva-studio-react` | UI, TanStack Start, Router-Wiring, App-Shell, Server-Funktionen als Adapter | aktuell `apps/sva-studio-react` | Keine dauerhafte Domänenlogik, keine rohen DB-/Keycloak-/GraphQL-Zugriffe im Browser-Bundle. |

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

- `@sva/routing` importiert `@sva/auth` für Pfade oder Runtime-Handler.
- Plugins importieren `@sva/core`, `@sva/auth`, `@sva/data` oder App-Code direkt.
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

## Zielbild für aktuelle Hotspots

### Auth und IAM

`@sva/auth` wird langfristig in zwei Rollen getrennt:

- Auth-Runtime: Login, Session, OIDC, Cookies, Middleware, Runtime-Routes.
- IAM-Fachmodule: Administration, Autorisierung, Governance, DSR, Instanzen.

Neue Endpunkte im IAM-Umfeld sollen nicht mehr pauschal in `packages/auth/src` ergänzt werden. Sie sollen einem fachlichen Zielbaustein zugeordnet werden. Wenn der Zielbaustein noch kein eigenes Package ist, wird die Struktur im bestehenden Package mit einem klaren Unterordner und öffentlicher Fassade vorbereitet.

### Routing

`@sva/routing` soll Auth-Pfade und Handler nicht aus `@sva/auth` beziehen. Auth-Routen sind als Contract in einem neutralen Baustein zu führen:

- kurzfristig: Contract nach `@sva/core` oder in einen neutralen Subpath verschieben
- mittelfristig: `@sva/routing` hängt nicht mehr von `@sva/auth` ab
- langfristig: App und Auth-Runtime registrieren Routen über deklarative Verträge

Boundary-Disables für `@nx/enforce-module-boundaries` in Routing-Dateien sind als technische Schuld zu behandeln und schrittweise zu entfernen.

### SDK

`@sva/sdk` bleibt vorerst ein Bündel aus Plugin-Vertrag und serverseitigen Runtime-Hilfen. Wachstum in diesem Package ist nur akzeptabel, wenn die neue Funktion fachfrei ist oder explizit ein öffentlicher Host-/Plugin-Vertrag ist.

Bei weiterem Wachstum wird getrennt:

- `@sva/plugin-sdk` für Plugin- und Host-Erweiterungsverträge
- `@sva/server-runtime` für Logging, Request-Kontext, OTEL und Fehlerantworten

### Data

`@sva/data` wird fachlich in zwei Rollen behandelt:

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

## Migrationsstrategie

Die Zielarchitektur wird inkrementell umgesetzt.

### Phase 1: Grenzen stabilisieren

- Keine neue große Fachlogik mehr direkt in `@sva/auth` ohne Zielbaustein.
- Neue OpenSpec-Changes benennen betroffene Zielpackages.
- Boundary-Disables werden inventarisiert und mit Abbaupfad versehen.
- `@sva/routing -> @sva/auth` wird als zu entfernende Abhängigkeit markiert.

**Exit-Kriterium:** Alle bestehenden Boundary-Disables sind inventarisiert, `pnpm lint` ist grün, keine neue IAM-Fachlogik ohne Zielbaustein-Zuordnung.

### Phase 2: Verträge herausziehen

- Auth-Routenpfade und route-nahe Contracts in einen neutralen Baustein verschieben.
- IAM-Admin-, Governance- und Instance-Contracts öffentlich stabilisieren.
- DataClient- und Repository-Exports klarer trennen.
- SDK-Subpaths für Plugin- und Server-Runtime-Verträge dokumentieren.

**Security-Gate:** Contract-Tests müssen Autorisierungs-Invarianten und PII-Grenzen abdecken.
**Exit-Kriterium:** Alle öffentlichen Verträge der Zielbausteine sind stabilisiert und getestet.

### Phase 3: Packages schneiden

- `@sva/instance-registry` als erstes neues Fachpackage herauslösen, wenn weitere Instanzfunktionen anstehen.
- Danach `@sva/iam-governance` oder `@sva/iam-admin` anhand des nächsten größeren Feature-Drucks herauslösen.
- Erst nach stabilen Verträgen `@sva/sdk` in `plugin-sdk` und `server-runtime` trennen.
- Pro neuem Package: `project.json` mit Scope-Tag, Nx-Targets (`build`, `lint`, `test:unit`, `test:types`, `check:runtime`) und Pipeline-Validierung.

**Security-Gate:** Herausgelöste Packages bestehen sofort `check:server-runtime` und alle bestehenden Security-Tests.
**Rollback-Strategie:** Deprecated-Re-Exports am alten Pfad als Übergangslösung; alter und neuer Import-Pfad parallel nutzbar.
**Observability-Übergang:** `createSdkLogger({ component: '...' })`-Komponentennamen für neue Packages vorab festlegen. Bestehende Dashboard-Queries und Alerts parallel um neue Bezeichner erweitern, bevor alte entfernt werden.
**Exit-Kriterium:** Neues Package ist in Nx-Graph, CI/CD und `depConstraints` vollständig integriert; bestehende Tests grün.

### Phase 4: Grenzen erzwingen

- Nx-`depConstraints` an die Zielstruktur anpassen (neue Scope-Tags: `scope:iam-core`, `scope:iam-admin`, `scope:iam-governance`, `scope:instance-registry`, `scope:auth-runtime` etc.).
- PII- und Credential-Grenzen über `depConstraints` durchsetzen.
- Tests auf Package-Contracts ausrichten.
- Veraltete Importpfade deprecaten und entfernen.
- Architektur- und OpenSpec-Dokumentation nachziehen.

**Security-Gate:** Nx-`depConstraints` erzwingen die PII- und Credential-Grenzen aus der PII-Datenfluss-Regel.
**Exit-Kriterium:** Alle Boundary-Disables entfernt, `pnpm lint` erzwingt Zielarchitektur.

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
| P1 | `@sva/routing` hängt direkt an `@sva/auth`. | Routenverträge liegen neutral; Routing kennt keine Auth-Runtime. |
| P1 | Neue IAM-Funktionalität landet standardmäßig in `@sva/auth`. | Neue IAM-Funktionalität wird einem Zielbaustein zugeordnet. |
| P2 | Instanz-Registry ist über Core, Data, Auth und App verteilt. | Eigene Control-Plane mit klaren Contracts und Fassaden. |
| P2 | Governance, DSR und Legal Texts liegen in Auth. | Eigenes Governance-Package oder klar abgegrenzter Zielbaustein. |
| P3 | SDK bündelt Plugin-Verträge und Server-Runtime-Hilfen. | Trennung bei weiterem Wachstum. |
| P3 | DataClient und serverseitige Repositories teilen ein Package. | Trennung nach Browser-/Server-Vertrag bei weiterem Wachstum. |

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
