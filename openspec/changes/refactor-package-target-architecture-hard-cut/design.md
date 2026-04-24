# Design: Package-Zielarchitektur Hard Cut

## Context

SVA Studio ist fachlich gewachsen, bevor alle Package-Grenzen final geschnitten waren. Dadurch tragen einzelne Packages mehrere Rollen:

- `@sva/auth` enthält Auth-Runtime, IAM-Administration, Governance, DSR, Instanz-Control-Plane und Keycloak-nahe Logik.
- `@sva/data` enthält sowohl client-nahe Datenverträge als auch serverseitige Repository- und DB-Hilfen.
- `@sva/sdk` bündelt Plugin-Verträge und serverseitige Runtime-Hilfen.
- `apps/sva-studio-react` muss zu viele Details zusammenführen und läuft Gefahr, Fachlogik dauerhaft zu besitzen.

Die Zielarchitektur ist in `docs/architecture/package-zielarchitektur.md` beschrieben. Dieser Change macht die Transition verbindlich und bewusst hart: Ziel ist keine langfristige Koexistenz, sondern ein klarer Schnitt mit kurzer, kontrollierter Umstellungsphase.

## Goals

- Fachliche Verantwortlichkeiten werden in dedizierte Packages geschnitten.
- Neue Funktionalität wird ab Beginn dieses Changes ausschließlich entlang der Zielgrenzen umgesetzt.
- Alte Sammelpackages bleiben nur als Migrationsquelle bestehen und verlieren ihre öffentliche Rolle.
- Autorisierung, PII-Verarbeitung, Server-Runtime, Data-Client, Repositories, Routing, Plugins und UI-Komposition werden getrennte Änderungsachsen.
- Nx, ESLint, TypeScript-Paths, Package-Exports und CI erzwingen die Grenzen.

## Non-Goals

- Keine fachliche Neuentwicklung während des Package-Schnitts.
- Keine dauerhafte Backward-Compatibility für alte Sammelimporte.
- Keine Umbenennung ohne Verhaltens- und Testabdeckung.
- Keine parallele zweite Plugin- oder Auth-Architektur neben den Zielpackages.

## Target Package Roles

| Package | Rolle | Darf nicht |
| --- | --- | --- |
| `@sva/core` | Framework-agnostische Basisverträge und reine Kernlogik | App-, DB-, SDK-, Auth- oder Runtime-Implementierungen aufnehmen |
| `@sva/plugin-sdk` | Öffentlicher Vertrag für Plugins und Host-Erweiterungen | Fachliche IAM-, Daten- oder Routing-Entscheidungen treffen |
| `@sva/server-runtime` | Request-Kontext, Logger-Fassade, JSON-Fehler, OTEL, technische Server-Konventionen | Fachlogik enthalten |
| `@sva/data-client` | Browser-/universal nutzbarer HTTP- und Schema-validierter Datenzugriff | DB-Treiber oder serverseitige Repositories exportieren |
| `@sva/data-repositories` | Serverseitige DB-Repositories und migrationsnahe Zugriffe | UI, Routing oder Fachentscheidungen enthalten |
| `@sva/auth-runtime` | Login, Logout, OIDC, Session, Cookies, Auth-Middleware | IAM-Admin-, Governance- oder Instanz-Fachlogik besitzen |
| `@sva/iam-core` | Autorisierungsvertrag, Permission Engine, PII-/Verschlüsselungsinvarianten | Fachmodul-Workflows oder Keycloak-Admin-Flows implementieren |
| `@sva/iam-admin` | Benutzer, Rollen, Gruppen, Organisationen, Reconcile, Tenant-Admin-Client | Auth-Session oder Instance-Provisioning besitzen |
| `@sva/iam-governance` | DSR, Legal Texts, Audit-nahe IAM-Fachfälle | Login oder allgemeine Account-Runtime besitzen |
| `@sva/instance-registry` | Instanzen, Host-Klassifikation, Registry, Provisioning, Platform-Admin-Client | Auth-Runtime oder IAM-Admin-Flows vermischen |
| `@sva/routing` | Route-Verträge, Pfade, Search-Params, Guard-Schnittstellen | Auth-Runtime-Implementierungen importieren |
| `@sva/*-integration` | Externe Systeme und deren Adapter | Fachlogik in App/Auth/Data verteilen |
| `apps/sva-studio-react` | UI, App-Shell, Router-Wiring und Server-Funktionsadapter | dauerhafte Domänenlogik besitzen |

## Decisions

### Decision: Harter Schnitt statt langfristiger Adapter

Alte Importpfade werden nur für die aktive Migration geduldet. Sie erhalten kein dauerhaftes Stabilitätsversprechen. Nach Abschluss dieses Changes müssen neue und bestehende Consumers die Zielpackages direkt nutzen.

Rationale: Dauerhafte Re-Exports würden die neue Architektur optisch einführen, aber die alte Kopplung erhalten.

### Decision: `@sva/iam-core` wird der zentrale Autorisierungspunkt

Autorisierungsentscheidungen laufen über einen gemeinsamen `authorize()`-Vertrag. Fachpackages dürfen Anforderungen formulieren, aber keine eigene Tabellen- oder Rollenlogik als zweite Entscheidungsquelle pflegen.

Rationale: IAM-Admin, Governance und Instance-Registry brauchen dieselbe Sicherheitssemantik.

### Decision: PII-Grenzen werden package-seitig sichtbar

Packages mit Klartext-PII-Verarbeitung erhalten explizite Tags und Tests. Repositories liefern verschlüsselte Felder und persistente Daten, aber keine fachliche Entschlüsselungsentscheidung.

Rationale: Der Package-Schnitt ist ein Security-Schnitt. Ohne sichtbare PII-Grenzen würden Datenflussrisiken nur verschoben.

### Decision: App-Imports gehen über Server-Funktionen oder öffentliche Contracts

Die React-App darf IAM-Fachpackages nicht direkt in Browser-Bundles ziehen. Fachzugriffe laufen über Server-Funktionen, HTTP-Verträge oder explizit client-sichere Contracts.

Rationale: UI-Komposition und Fachlogik bleiben getrennt, und serverseitige Geheimnisse gelangen nicht versehentlich in client-shared Code.

### Decision: Nx und ESLint erzwingen die Architektur

Jedes Zielpackage erhält Scope-Tags, eigene Targets und explizite Dependencies. `depConstraints` verhindern unerlaubte Kanten. Boundary-Disables werden entfernt oder mit Ticketbezug blockiert.

Rationale: Architekturgrenzen, die nur dokumentiert sind, erodieren bei Feature-Druck.

## Migration Plan

### Phase 0: Freeze und Inventar

- Neue fachliche Logik in `@sva/auth`, `@sva/data` und `@sva/sdk` wird gestoppt, wenn sie einem Zielpackage zugeordnet werden kann.
- Aktuelle Exporte, Importkanten, Boundary-Disables, PII-Flüsse und Runtime-Imports werden inventarisiert.
- PRs mit Abweichungen müssen explizit begründen, warum sie nicht warten können.

### Phase 1: Zielpackages anlegen

- Zielpackages werden mit Nx-Generatoren angelegt.
- Jedes Package erhält `project.json`, `package.json`, `tsconfig`, Build-, Lint-, Unit-, Type- und Runtime-Targets.
- Package-Exports und `tsconfig.base.json` werden eingerichtet.
- Initiale öffentliche API-Flächen werden minimal gehalten.

### Phase 2: Contracts zuerst verschieben

- Autorisierungsvertrag nach `@sva/iam-core`.
- Server-Runtime-Hilfen nach `@sva/server-runtime`.
- Plugin-Verträge nach `@sva/plugin-sdk`.
- Client-sichere Datenverträge nach `@sva/data-client`.
- Repository-Verträge nach `@sva/data-repositories`.

### Phase 3: Fachlogik schneiden

- Auth-Runtime wird von IAM-Admin, IAM-Governance und Instance-Registry getrennt.
- Keycloak-Ports werden den Fachpackages zugeordnet: Tenant-Admin in `iam-admin`, Platform-Admin in `instance-registry`.
- Governance-/DSR-Flows wandern nach `iam-governance`.
- Instanzmodell, Registry und Provisioning wandern nach `instance-registry`.

### Phase 4: Consumers umstellen

- App, Routing, Plugins, Integrationen und Tests importieren nur noch Zielpackages.
- Alte Sammelimporte werden entfernt.
- CI blockiert neue Verstöße.

### Phase 5: Alte Sammelrollen entfernen

- `@sva/auth`, `@sva/data` und `@sva/sdk` verlieren die migrierten öffentlichen Rollen oder werden zu eng definierten Zielpackages umbenannt.
- Deprecated Re-Exports werden gelöscht.
- Architekturdoku, OpenSpec-Specs und ADRs werden final aktualisiert.

## Risks / Trade-offs

- Mehr Packages erhöhen Setup- und Review-Aufwand.
- Der harte Schnitt kann kurzfristig viele Imports und Tests brechen.
- Zu breite Übergangs-Re-Exports würden den Nutzen verwässern.
- Zu frühe Package-Schnitte ohne Contract-Stabilität können Nacharbeit erzeugen.

Mitigation:

- Contracts zuerst, Fachlogik danach.
- Kleine, reviewbare Migrations-PRs entlang der Zielpackages.
- Strikte CI-Gates erst aktivieren, wenn die jeweilige Phase die Grundlage geschaffen hat.
- Keine Feature-Erweiterung im selben PR wie ein Package-Schnitt.

## Rollback Strategy

Rollback erfolgt nicht über dauerhafte alte Importpfade, sondern über Git-Revert einzelner Migrations-PRs. Jede Phase muss deshalb in isolierten, testbaren Schritten geliefert werden.

## Open Questions

- Soll `@sva/sdk` physisch in `@sva/plugin-sdk` umbenannt werden, oder bleibt `@sva/sdk` als finaler Name für den Plugin-Vertrag bestehen?
- Soll `@sva/data` physisch in zwei Packages geschnitten werden, oder werden `data-client` und `data-repositories` zunächst als getrennte Packages mit späterer Deprecation des alten Namens eingeführt?
- Welche Phase entfernt `@sva/auth` als öffentlichen Importpfad vollständig?
