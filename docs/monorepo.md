# Monorepo Struktur

Dieses Dokument beschreibt die aktuelle Organisation des Nx-/pnpm-Workspaces, die Paketrollen und die verbindlichen Konventionen für neue Projekte.

## Aktueller Workspace

### Nx-Projekte

| Projekt | Typ | Pfad | Zweck |
| --- | --- | --- | --- |
| `sva-studio-react` | App | `apps/sva-studio-react/` | TanStack-Start-Frontend |
| `auth-runtime` | Library | `packages/auth-runtime/` | Authentifizierung, Session, OIDC, Runtime-Routen und Auth-Middleware |
| `core` | Library | `packages/core/` | Framework-agnostische Kernlogik |
| `data` | Library | `packages/data/` | Datenzugriff, Migrationen, Seeds |
| `data-client` | Library | `packages/data-client/` | Client-sicherer HTTP-/Schema-Client |
| `data-repositories` | Library | `packages/data-repositories/` | Serverseitige Repositories und DB-nahe Operationen |
| `iam-admin` | Library | `packages/iam-admin/` | Benutzer-, Rollen-, Gruppen- und Organisationsverwaltung |
| `iam-core` | Library | `packages/iam-core/` | Zentrale Autorisierungsverträge und Permission-Entscheidungen |
| `iam-governance` | Library | `packages/iam-governance/` | Governance, Rechtstexte und Data-Subject-Rights |
| `instance-registry` | Library | `packages/instance-registry/` | Instanzverwaltung und Keycloak-Provisioning |
| `media` | Library | `packages/media/` | Hostseitiger Medienvertrag und Referenz-Capability |
| `monitoring-client` | Library | `packages/monitoring-client/` | Logging, Metriken, OTel-Anbindung |
| `plugin-events` | Library | `packages/plugin-events/` | Produktives Events-Plugin für CMS-Erweiterungspunkte |
| `plugin-news` | Library | `packages/plugin-news/` | Produktives News-Plugin für CMS-Erweiterungspunkte |
| `plugin-poi` | Library | `packages/plugin-poi/` | Produktives POI-Plugin für CMS-Erweiterungspunkte |
| `plugin-sdk` | Library | `packages/plugin-sdk/` | Kanonische Plugin-/Host-Boundary für Metadaten, Registries und Admin-Ressourcen |
| `routing` | Library | `packages/routing/` | Typsichere Routing-Factories und Route-Definitionen |
| `server-runtime` | Library | `packages/server-runtime/` | Kanonische Server-Runtime-Boundary für Logging, Kontext und Fehlerantworten |
| `studio-ui-react` | Library | `packages/studio-ui-react/` | Öffentliche React/UI-Basis für Host-Seiten und Plugin-Custom-Views |
| `sva-mainserver` | Library | `packages/sva-mainserver/` | Serverseitige Integration des externen SVA-Mainservers |
| `tooling-testing` | Library | `tooling/testing/` | Interne Test-Huelle fuer CI-, Coverage- und Ops-nahe Skriptpruefungen |

## Ordner
- apps/: laufende Anwendungen (z. B. sva-studio-react)
- packages/: publishable Libraries und Plugins
- tooling/: gemeinsame Tools und Konfigurationen
- scripts/: Automations-Skripte

## Package-Konventionen und Entscheidungsregeln
Wir unterscheiden Packages nach Rolle und Wiederverwendbarkeit.

### 1) Platform Packages (strategisch)
Beispiele: `@sva/core`, `@sva/plugin-sdk`, `@sva/server-runtime`

Kriterien:
- werden von mehreren Projekten genutzt
- definieren stabile Public APIs und zentrale Contracts
- sind kritisch für Architektur und langfristige Wartbarkeit
- haben klare Ownership und verbindliche Tests

Konvention:
- `tags`: `scope:core`, `scope:plugin-sdk` oder `scope:server-runtime`, plus `type:lib`
- keine app-spezifische UI-/Route-Logik
- Breaking Changes nur mit Doku- und Migrationshinweis

Historischer Hinweis:

- `@sva/sdk` ist aus dem aktiven Workspace entfernt; alte Importpfade werden direkt auf `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/core` oder `@sva/monitoring-client/logging` migriert.

### 2) Domain Packages (fachlich)
Beispiele: `@sva/data`, `@sva/auth-runtime`, `@sva/iam-admin`, `@sva/iam-governance`, `@sva/instance-registry`

Kriterien:
- kapseln wiederverwendbare Fachlogik oder Datenzugriff
- sind nicht nur für eine einzelne App relevant
- haben klaren Fachfokus (kein "misc"-Sammelpaket)

Konvention:
- `tags`: domain-spezifisch (`scope:data`) plus `type:lib`
- dürfen nur in erlaubte niedrigere Layer importieren (Boundary-Regeln)

### 3) Plugin Packages (optional/erweiterbar)
Beispiele: `@sva/plugin-*`

Kriterien:
- optionales Feature oder Erweiterungspunkt
- klarer Integrationspunkt (z. B. Feature Extension)
- kein Zugriff auf interne App-Details

Konvention:
- Name: `@sva/plugin-<name>`
- `tags`: `scope:plugin`, plus `type:lib`
- Host-APIs nur über `@sva/plugin-sdk` importieren; gemeinsame React-UI nur über `@sva/studio-ui-react`; direkte Imports aus `@sva/core` oder App-Code sind verboten

### 4) App-lokaler Code (kein eigenes Package)
Code bleibt in `apps/<app>/src`, wenn:
- nur die eine App ihn nutzt
- API-Stabilität oder Wiederverwendung noch unklar ist
- Experiment/Spike ohne langfristigen Wartungsanspruch

### Entscheidung: Neues Package oder App-lokal?
Nutze diese Checkliste vor dem Anlegen eines neuen Packages:

1. Braucht der Code eine stabile Public API?
2. Gibt es eine klare Ownership und Teststrategie?
3. Passt der Code in eine bestehende Scope-Kategorie?
4. Vermeidet ein eigenes Package duplizierte Logik?

Entscheidung:
- Wenn mindestens 3/4 "Ja": eigenes Package anlegen
- Wenn weniger als 3/4 "Ja": in App lassen und später neu bewerten

### Pflichtstandard für jedes neue Package
- per Nx Generator anlegen
- `project.json` mit mindestens `build`, `lint` und `test:unit`
- `tags` korrekt setzen (`scope:*`, `type:*`)
- `src/index.ts` als klare Public API
- `README.md` mit Purpose, erlaubten Abhängigkeiten, Owner
- Breaking Changes benötigen ADR + Migration-Guide

### Dependency Management
- Interne Deps: workspace:*
- Gemeinsame externe Deps: nur in Root package.json
- Peer Dependencies bei Plugins: In README dokumentieren
- Version-Alignment: pnpm dedupe bei Konflikten

## Neues Package anlegen

### Standard-Workflow: Nx-Generator (empfohlen)

**@nx/js:lib Generator verwenden** — das ist der Nx-Standard und garantiert:
- ✅ Korrekte project.json mit build/test/lint Targets
- ✅ TypeScript-Setup (tsconfig.json, tsconfig.lib.json)
- ✅ Automatische Integration in tsconfig.base.json
- ✅ Sofortige Sichtbarkeit im Nx-Projektgraphen
- ✅ Caching und affected-Commands funktionieren sofort

#### Schnell-Command
```bash
pnpm nx g @nx/js:lib my-package \
  --directory=packages/my-package \
  --bundler=tsc \
  --linter=eslint \
  --unitTestRunner=vitest \
  --strict \
  --useProjectJson
```

#### Vollständiger Command mit allen Options
```bash
nx g @nx/js:lib my-package \
  --directory=packages/my-package \
  --importPath=@sva/my-package \
  --tags=scope:shared,type:lib \
  --bundler=tsc \
  --publishable=false
```

**Was der Generator automatisch macht:**
1. Erstellt `packages/my-package/` mit src/index.ts
2. Generiert `project.json` mit Nx Targets
3. Erstellt `tsconfig.json` und `tsconfig.lib.json`
4. Aktualisiert `tsconfig.base.json` mit Path-Mapping
5. Registriert Package im Nx-Projektgraphen

**Nach dem Generator (falls nötig):**
- Ergänze Abhängigkeiten in `package.json` (z.B. Peer Dependencies für Plugins)
- Implementiere Code in `src/`
- Exportiere Public API über `src/index.ts`

**Weitere Informationen:**
- 📖 [Nx TypeScript Library Generators](https://nx.dev/nx-api/js/generators/library)
- 📖 [Generator Options](https://nx.dev/nx-api/js/generators/library#options)

#### Tipps für spezifische Cases

**Plugin mit React-Dependencies:**
```bash
pnpm nx g @nx/js:lib plugin-foo \
  --directory=packages/plugin-foo \
  --tags=scope:plugin,type:lib \
  --bundler=tsc \
  --linter=eslint \
  --unitTestRunner=vitest \
  --strict \
  --useProjectJson
# Dann in package.json peerDependencies hinzufügen:
# "@tanstack/react-router": "^1.x", "react": "^19.x", etc.
```

**Publishable Library (für npm Publishing):**
```bash
nx g @nx/js:lib my-lib \
  --directory=packages/my-lib \
  --importPath=@sva/my-lib \
  --publishable=true \
  --bundler=tsc
```

---

### Alternatives Workflow: Manuelles Setup (nur wenn Generator nicht passt)

> ⚠️ **Nur in Ausnahmefällen verwenden.** Der Generator ist flexibel genug für 90% der Fälle.

**Wann manuell?**
- Externe bestehende Library wird ins Monorepo integriert
- Extrem spezifisches Build-Setup (sehr selten)
- Experimentelle Struktur

**Nachteile manueller Setups:**
- ❌ Keine automatischen Targets
- ❌ Keine path-Mapping-Integration
- ❌ Nicht im Nx-Projektgraphen (bis manuell registriert)
- ❌ affected-Commands berücksichtigen es nicht
- ❌ Höhere Fehleranfälligkeit

**Falls du manuell starten musst:**
1. Lege einen Ordner unter packages/ an
2. Erstelle package.json, project.json, tsconfig.json, tsconfig.lib.json
3. Exportiere die Public API über src/index.ts
4. Füge einen Pfad in tsconfig.base.json hinzu
5. Prüfe die Erkennung im Workspace:
   ```bash
   pnpm nx show projects
   ```

**Dann:** Wende den Generator-Workflow retrospektiv an, um Targets zu ergänzen.

## Warum Nx (statt Turborepo)?
Wir nutzen Nx, weil es als integrierte Monorepo-Plattform mehr liefert als „nur“ Task-Running:

- **Projektgraph & affected commands:** Nx modelliert Abhängigkeiten zwischen Apps und Packages und kann dadurch in CI/CD gezielt nur die betroffenen Projekte bauen/testen.
- **Generatoren & Konsistenz:** Neue Apps/Packages lassen sich mit `nx g @nx/js:lib` etc. scaffolden — das bedeutet automatisches Setup von Targets, TypeScript-Konfiguration und Projektgraph-Integration. Das reduziert manuellen Aufwand und hält Konventionen über Zeit konsistent (weniger Copy/Paste, weniger Drift).
- **Architektur-Governance:** Mechanismen wie Tags/Boundaries helfen, Schichten (Core vs. Plugins) langfristig sauber zu halten.
- **Caching & Skalierung:** Lokales Caching ist integriert; im Repository setzen wir auf lokalen Cache plus `affected`-Workflows.

Details und Trade-offs: siehe openspec/specs/monorepo-structure/design.md

## Nx Targets
Standardisierte Targets:
- `build`: produktiver Build oder TypeScript-Kompilierung
- `lint`: ESLint-basierter Qualitätscheck
- `test:unit`: schneller Standard-Testlauf
- optional `test:coverage`: Coverage-Run für Projekte mit Messung
- optional `test:integration`: infra- oder serviceabhängige Tests
- optional `test:types` oder `typecheck`: dedizierte Typprüfung, wenn Projekt-spezifisch nötig
- App-spezifisch zusätzlich z. B. `serve`, `preview`, `test:e2e`, domänenspezifische `check:*` Targets

Die Root-Skripte im Workspace aggregieren diese Targets bewusst nicht 1:1 pro Projekt. `pnpm test:types` bündelt beispielsweise Library-Builds plus `sva-studio-react:typecheck`, obwohl nicht jedes Projekt ein eigenes `test:types` Target besitzt.

## Module Boundaries (verbindlich)
Zur langfristigen Architektur-Governance erzwingen wir Import-Grenzen mit
`@nx/enforce-module-boundaries` in `eslint.config.mjs`.

### Aktive Scope-Regeln
- `scope:core` darf nur von `scope:core` abhängen
- `scope:data` darf von `scope:core`, `scope:data` abhängen
- `scope:plugin-sdk` darf nur von `scope:core`, `scope:plugin-sdk` abhängen
- `scope:server-runtime` darf nur von `scope:core`, `scope:monitoring`, `scope:server-runtime` abhängen
- `scope:plugin` darf von `scope:plugin-sdk`, `scope:studio-ui-react`, `scope:plugin` abhängen
- `scope:app` darf von Zielpackages wie `scope:core`, `scope:data`, `scope:plugin-sdk`, `scope:server-runtime`, `scope:plugin` abhängen

### Wo sind die Regeln hinterlegt?
- Lint-Regel: `eslint.config.mjs`
- Tags pro Projekt: `apps/*/project.json` und `packages/*/project.json` (`tags`)

### Validierung
- Gesamter Workspace: `pnpm test:eslint`
- Einzelprojekt: `pnpm nx run <project>:lint`

### Wenn du ein neues Package anlegst
1. Passende `tags` im `project.json` setzen (z. B. `scope:plugin,type:lib`)
2. Falls eine neue Scope-Kategorie entsteht, `depConstraints` in `eslint.config.mjs` erweitern
3. Lint lokal ausführen und Rule-Verletzungen vor dem Commit beheben

## Hinweise
- TanStack Start läuft im Workspace auf der jeweils aktuellen Node-LTS-Linie
- Routing erfolgt über eine Code-Registry; siehe docs/routing.md
- Package-Manager ist pnpm (siehe pnpm-workspace.yaml)
