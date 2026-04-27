# Capability: monorepo-structure

## Purpose
Definiert die Nx-basierte Monorepo-Struktur für SVA Studio, inklusive Package-Management, Build-Konventionen und Generatoren für konsistente Entwicklungs-Workflows.
## Requirements
### Requirement: Monorepo-Grundstruktur
Das System SHALL eine Nx Integrated Monorepo-Struktur mit getrennten Bereichen für Apps und Packages bereitstellen.

#### Scenario: Workspace-Struktur vorhanden
- **WHEN** das Repository initialisiert ist
- **THEN** existieren mindestens apps/, packages/, tooling/ und scripts/

### Requirement: Publishable Packages und Plugins

Das System SHALL Packages als eigenstaendige npm-Module organisieren, inklusive klarer Namenskonventionen fuer Core, UI und Plugins. Plugins SHALL dabei Host-Metadaten ausschliesslich ueber `@sva/plugin-sdk` konsumieren und gemeinsame React-UI ausschliesslich ueber `@sva/studio-ui-react` nutzen. Direkte Abhaengigkeiten auf `@sva/core`, alte Sammelpackages oder App-interne Module sind fuer Plugins nicht zulaessig. Ein Beispiel-Plugin ist dafuer keine verpflichtende Workspace-Komponente.

#### Scenario: Package-Namensschema
- **WHEN** ein neues Paket erstellt wird
- **THEN** verwendet es ein Scope wie `@sva/*`
- **AND** Plugins verwenden `@sva/plugin-*`
- **AND** die gemeinsame Studio-UI verwendet den Importpfad `@sva/studio-ui-react`

#### Scenario: Plugin-Dependency-Regel
- **WHEN** ein Plugin-Package erstellt oder aktualisiert wird
- **THEN** listet seine `package.json` fuer Host-Metadaten `@sva/plugin-sdk`
- **AND** listet seine `package.json` fuer Plugin-Custom-Views optional `@sva/studio-ui-react`
- **AND** direkte Abhaengigkeiten auf `@sva/core`, alte Sammelpackages oder App-interne Module sind nicht vorhanden

#### Scenario: Kein Beispiel-Plugin als Workspace-Pflicht
- **WHEN** der Workspace produktiv konfiguriert wird
- **THEN** ist kein `plugin-example`-Package als verpflichtender Bestandteil vorausgesetzt
- **AND** das Monorepo kann produktive Plugins ohne ein mitgefuehrtes Referenz-Plugin betreiben

### Requirement: App-Stack Definition
Das System SHALL eine Web-App unter apps/sva-studio-react mit React und TanStack Start bereitstellen.

#### Scenario: Start-App vorhanden
- **WHEN** das Workspace-Setup abgeschlossen ist
- **THEN** existiert apps/sva-studio-react als TanStack-Start-App

### Requirement: Build- und Target-Konventionen
Das System SHALL standardisierte Nx Targets für build, lint und Testarten bereitstellen, mit klarer Trennung zwischen Unit-, Coverage- und Integrationstests **und Nx-Caching-Unterstützung**.

#### Scenario: Standardisierte Targets (erweitert)
- **WHEN** ein neues Package oder eine App erstellt wird
- **THEN** sind mindestens `build`, `lint` und ein Testtarget definiert
- **AND** Target-Namen folgen Workspace-Konventionen
- **AND** Test-Targets haben korrekte `cache`, `inputs` und `outputs` in nx.json

#### Scenario: Coverage-Target mit Nx Cache
- **WHEN** `test:coverage` Target in project.json definiert wird
- **THEN** ist Cache in nx.json targetDefaults aktiviert
- **AND** inputs umfassen: default, ^production, {workspaceRoot}/vitest.config.ts
- **AND** outputs umfassen: {projectRoot}/coverage
- **AND** zweiter Coverage-Run nutzt Cache (Cache Hit)

#### Scenario: Zentrale Vitest-Workspace-Konfiguration
- **WHEN** neues Package erstellt wird
- **THEN** referenziert es zentrale vitest.workspace.ts im Root
- **AND** Package-spezifische vitest.config.ts enthält nur Overrides
- **AND** Coverage-Reporter sind konsistent über alle Packages

---

### Requirement: Package-Erstellung via @nx/js:lib Generator
Das System SHALL neue Packages primär über `nx g @nx/js:lib` mit SVA-Konventionen erstellen, um automatisch korrekte Targets, TypeScript-Setup und Projektgraph-Integration zu garantieren.

#### Scenario: Standard Library mit @nx/js:lib erstellen
- **GIVEN** ein Entwickler möchte ein neues Package erstellen
- **WHEN** er `nx g @nx/js:lib my-package --directory=packages/my-package --importPath=@sva/my-package --tags=scope:shared,type:lib --bundler=tsc` ausführt
- **THEN** wird ein Package mit korrekter TypeScript-Struktur generiert
- **AND** `project.json` mit build/test/lint Targets wird erstellt
- **AND** tsconfig.base.json wird automatisch mit Path-Mapping aktualisiert
- **AND** Package erscheint sofort im Nx-Projektgraphen

#### Scenario: Schneller Workflow mit npm-Script
- **GIVEN** ein `pnpm new:lib` npm-Script existiert im Root
- **WHEN** ein Entwickler `pnpm new:lib my-package` ausführt
- **THEN** wird der @nx/js:lib Generator mit SVA-Defaults aufgerufen
- **AND** manuelle Flag-Eingaben entfallen

#### Scenario: Plugin mit Peer Dependencies
- **GIVEN** ein Plugin soll @sva/core als Peer Dependency haben
- **WHEN** Generator ausgeführt wird
- **THEN** kann `--tags=scope:plugin` verwendet werden
- **AND** Entwickler ergänzt Peer Dependencies manuell nach Bedarf in package.json

### Requirement: Manuelles Package-Setup für Sonderfälle
Das System SHALL manuelles Setup dokumentieren und erlauben, wenn Generator nicht passt (z.B. komplexe Build-Setups, externe Packages, Experimentelles).

#### Scenario: Externe Library ins Monorepo integrieren
- **GIVEN** eine bestehende npm-Library soll als Workspace-Package integriert werden
- **WHEN** die Library spezielle package.json-Konfiguration benötigt
- **THEN** kann manuelles Setup statt Generator verwendet werden
- **AND** Dokumentation warnt vor Nachteilen (keine Targets, kein Full-Graph-Support)
- **AND** dev muss Projekt manuell in nx.json/project.json registrieren

#### Scenario: Dokumentation von Generator vs. Manuell
- **GIVEN** Dokumentation in docs/monorepo.md
- **WHEN** ein Entwickler konsultiert sie
- **THEN** klare Guidance: Generator als Standard (~90%), Manuell nur wenn nötig (~10%)
- **AND** Nachteile der manuellen Methode sind erklärt
- **AND** Beispiele für beide Wege vorhanden

### Requirement: Generator-Workflows in Dokumentation
Das System SHALL klare, wiederverwendbare Generator-Commands und Workflows dokumentieren.

#### Scenario: Dokumentierte Generator-Commands
- **GIVEN** Entwickler liest docs/monorepo.md
- **WHEN** er ein neues Package erstellen möchte
- **THEN** findet er Copy-Paste-Ready Commands mit SVA-Defaults
- **AND** Erklärungen für jeden Flag sind vorhanden
- **AND** Verlinkung zu Nx-Dokumentation ist enthalten

### Requirement: Plugin-SDK-Boundary
Plugins (Packages mit Tag `scope:plugin` oder Namensschema `@sva/plugin-*`) SHALL Host-Metadaten, Registries, Admin-Ressourcen, Actions, Guard-Metadaten und Plugin-i18n ausschliesslich ueber `@sva/plugin-sdk` konsumieren. Gemeinsame React-UI fuer Custom-Views SHALL ueber `@sva/studio-ui-react` konsumiert werden. Direkte Imports aus `@sva/core`, alten Sammelpackages, fachlichen Zielpackages oder App-internen Modulen sind fuer Plugins nicht zulaessig.

#### Scenario: Plugin importiert Host-Metadaten aus Plugin SDK
- **WHEN** ein Plugin eine Funktion oder einen Typ fuer Host-Registrierung, Actions, i18n, Admin-Ressourcen oder Routing-Metadaten benötigt
- **THEN** importiert es ausschliesslich aus `@sva/plugin-sdk` oder dessen Sub-Exports
- **AND** interne Implementierungsdetails von `@sva/core` werden nicht exponiert

#### Scenario: Plugin importiert gemeinsame UI aus Studio UI
- **WHEN** ein Plugin eine Custom-View mit Studio-Layout, Formularen, Tabellen, Aktionen oder Zuständen rendert
- **THEN** importiert es diese Bausteine aus `@sva/studio-ui-react`
- **AND** es importiert keine Komponenten aus `apps/sva-studio-react/src/**`

#### Scenario: Direktimport aus Core wird durch Lint verhindert
- **WHEN** ein Plugin-Entwickler versucht, direkt aus `@sva/core` zu importieren
- **THEN** schlägt die ESLint-Boundary-Prüfung fehl
- **AND** eine aussagekräftige Fehlermeldung verweist auf `@sva/plugin-sdk` als korrekte Metadaten-Schnittstelle

#### Scenario: Direktimport aus App-UI wird durch Lint verhindert
- **WHEN** ein Plugin-Entwickler versucht, direkt aus App-internen UI-Pfaden zu importieren
- **THEN** schlägt die ESLint-Boundary-Prüfung fehl
- **AND** eine aussagekräftige Fehlermeldung verweist auf `@sva/studio-ui-react` als korrekte UI-Schnittstelle

### Requirement: Nx Caching für Test-Targets
Das System SHALL Nx Caching für Test-Targets standardmäßig aktivieren und korrekte Cache-Inputs/-Outputs definieren.

#### Scenario: Named Inputs für Testing
- **GIVEN** `nx.json` im Root existiert
- **WHEN** namedInputs definiert sind
- **THEN** existiert ein `testing` Named Input
- **AND** `testing` umfasst Test-Files (`**/*.{test,spec}.{ts,tsx}`)
- **AND** `testing` umfasst zentrale Test-Configs (vitest.config.ts, vitest.workspace.ts)

#### Scenario: Cache-Output-Definition
- **WHEN** Coverage-Target in nx.json definiert wird
- **THEN** sind outputs explizit gesetzt: `["{projectRoot}/coverage"]`
- **AND** Nx restored Coverage-Verzeichnis bei Cache Hit
- **AND** Coverage-Artefakte sind identisch zu Fresh-Run

#### Scenario: Cache-Debugging
- **GIVEN** ein Entwickler vermutet falsche Cache-Hits
- **WHEN** er `--skip-nx-cache` Flag nutzt
- **THEN** wird Cache komplett umgangen
- **AND** Fresh-Run zeigt, ob Fehler reproduzierbar ist
- **AND** `nx reset` cleared Cache lokal

---

### Requirement: Zentrale Vitest-Workspace-Konfiguration
Das System SHALL eine vitest.workspace.ts im Root bereitstellen, die als Single Source of Truth für Test-Konfiguration dient.

#### Scenario: Workspace-Config im Root
- **GIVEN** Monorepo-Root
- **WHEN** `vitest.workspace.ts` existiert
- **THEN** definiert es globale Test-Defaults (environment, coverage provider)
- **AND** entdeckt automatisch alle Package-Configs (`apps/*/vitest.config.ts`, `packages/*/vitest.config.ts`)
- **AND** alle Test-Runs nutzen konsistente Reporter

#### Scenario: Package-Config-Vereinfachung
- **GIVEN** ein Package hat vitest.config.ts
- **WHEN** zentrale Workspace-Config existiert
- **THEN** kann Package-Config auf Projekt-spezifische Overrides reduziert werden
- **AND** `cwd` Parameter in project.json Targets ist nicht mehr erforderlich
- **AND** Coverage-Reporter-Definitionen entfallen (zentral definiert)

#### Scenario: Migration bestehender Configs
- **GIVEN** bestehende Packages mit individuellen vitest.config.ts
- **WHEN** Workspace-Config eingeführt wird
- **THEN** bleiben alte Configs kompatibel (Backward-Compat)
- **AND** schrittweise Migration ist möglich (Package für Package)
- **AND** beide Ansätze koexistieren während Übergangsphase

---

### Requirement: TypeScript-basiertes Tooling
Das System SHALL TypeScript für kritisches Monorepo-Tooling verwenden, inklusive Coverage-Gate-Scripts.

#### Scenario: TypeScript-Script-Execution via tsx
- **GIVEN** `scripts/ci/coverage-gate.ts` existiert
- **WHEN** Script via `pnpm coverage-gate` ausgeführt wird
- **THEN** wird TypeScript via `tsx` transparent kompiliert
- **AND** kein Pre-Build-Step erforderlich
- **AND** Entwickler hat IDE-Support (Autocomplete, Type-Checking)

#### Scenario: Type-sichere Konfigurationen
- **GIVEN** Coverage-Policy als JSON-Datei
- **WHEN** TypeScript-Script Policy lädt
- **THEN** validiert TypeScript-Interface Struktur zur Compile-Zeit
- **AND** invalide Policy führt zu Type-Error (nicht Runtime-Error)
- **AND** Refactorings (z.B. neues Policy-Feld) sind IDE-unterstützt

### Requirement: Einheitliche Workspace-Konfiguration
Das System SHALL eine konsistente Nx-Workspace-Konfiguration über alle Packages hinweg sicherstellen.

#### Scenario: TypeScript-Path-Mappings vollständig
- **WHEN** ein Package als `@sva/<name>` im Workspace referenziert wird
- **THEN** existiert ein korrespondierender Path-Eintrag in `tsconfig.base.json`
- **AND** IDE-Auflösung und Build funktionieren ohne zusätzliche Konfiguration

#### Scenario: Sub-Path-Exports gemappt
- **WHEN** ein Package Sub-Path-Exports in `package.json` definiert (z. B. `@sva/auth-runtime/server`)
- **THEN** existieren korrespondierende Path-Einträge in `tsconfig.base.json`
- **AND** die Sub-Path-Imports werden von IDE und Build korrekt aufgelöst

#### Scenario: Konsistente Nx-Tags
- **WHEN** ein Library-Package im Workspace konfiguriert ist
- **THEN** trägt es den Tag `type:lib`
- **AND** der Scope-Tag entspricht dem Package-Zweck (z. B. `scope:routing`, `scope:core`)

#### Scenario: Konsistente Target-Benennung
- **WHEN** ein Package Unit-Tests bereitstellt
- **THEN** ist das Target als `test:unit` benannt
- **AND** `nx affected --target=test:unit` erfasst das Package korrekt

#### Scenario: Konsistente Lint-Executors
- **WHEN** ein Package ein `lint`-Target definiert
- **THEN** nutzt es den `@nx/eslint:lint`-Executor
- **AND** die Lint-Konfiguration ist workspace-weit einheitlich

### Requirement: Nx-native Frontend-Targets
Die Web-App `apps/sva-studio-react` SHALL ihre zentralen Entwicklungs- und Qualitäts-Tasks Nx-nativ abbilden. Dafür SOLLEN fachlich passende Nx-Executor bevorzugt werden; falls für einen Task kein passender Executor genutzt wird, MUSS `nx:run-commands` den zugrunde liegenden Tool-Aufruf, Inputs und Outputs explizit und wartbar definieren.

#### Scenario: Zentrale App-Targets nutzen passende Nx-Integration
- **WHEN** `apps/sva-studio-react/project.json` geprüft wird
- **THEN** verwenden `serve`, `lint`, `test:unit` und `test:e2e` jeweils einen fachlich passenden Nx-Executor
- **AND** weitere zentrale Targets wie `build` oder `test:coverage` sind entweder ebenfalls über dedizierte Executor angebunden oder als dokumentierte `nx:run-commands` mit klaren Tool-Aufrufen modelliert

#### Scenario: Frontend-Tooling ist Nx-nativ eingebunden
- **WHEN** die Frontend-App über Nx lokal oder in CI ausgeführt wird
- **THEN** sind Dev-Server und Vorschau an Vite-basierte Nx-Executor gebunden
- **AND** Unit-Tests an einen Vitest-basierten Nx-Test-Executor
- **AND** E2E-Tests an einen Playwright-basierten Nx-Executor
- **AND** Build- und Coverage-Läufe bleiben über Nx reproduzierbar, auch wenn sie intern direkte Vite- oder Vitest-Kommandos verwenden

### Requirement: Vollständige Frontend-Targets mit expliziten Inputs und Outputs
Die Web-App `apps/sva-studio-react` SHALL alle wesentlichen Frontend-Aufgaben als explizite Nx-Targets mit nachvollziehbaren `inputs` und `outputs` in `project.json` definieren.

#### Scenario: Zielmenge ist vollständig
- **WHEN** `apps/sva-studio-react/project.json` geprüft wird
- **THEN** sind mindestens `build`, `serve`, `lint`, `test:unit`, `test:coverage` und `test:e2e` vorhanden
- **AND** jedes dieser Targets definiert explizite `inputs`
- **AND** jedes dieser Targets definiert explizite `outputs`

#### Scenario: Artefakt-Targets deklarieren ihre Ergebnisse
- **WHEN** `build`, `test:coverage` oder `test:e2e` ausgeführt werden
- **THEN** verweisen ihre `outputs` auf die tatsächlich erzeugten Artefaktverzeichnisse der Frontend-App
- **AND** Nx kann diese Artefakte bei Cache-Hits wiederherstellen

#### Scenario: Nicht-artefaktproduzierende Targets sind explizit markiert
- **WHEN** `serve`, `lint` oder `test:unit` geprüft werden
- **THEN** definieren diese Targets `outputs: []`
- **AND** ihre Wirkung bleibt für Entwickler und Reviewer in `project.json` eindeutig

### Requirement: Cache-relevante Frontend-Inputs sind dokumentiert
Das System SHALL cache-relevante Konfigurations- und Environment-Einflüsse der Frontend-App über `namedInputs` oder target-spezifische `inputs` deklarieren.

#### Scenario: Frontend-Konfiguration invalidiert Cache
- **WHEN** sich `apps/sva-studio-react/vite.config.ts`, `apps/sva-studio-react/vitest.config.ts`, `apps/sva-studio-react/playwright.config.ts`, `apps/sva-studio-react/tailwind.config.cjs`, `apps/sva-studio-react/postcss.config.cjs`, `apps/sva-studio-react/tsconfig.json` oder `apps/sva-studio-react/package.json` ändern
- **THEN** werden betroffene Frontend-Targets nicht aus einem veralteten Nx-Cache bedient

#### Scenario: Environment-Einflüsse sind Teil des Cache-Modells
- **WHEN** sich für Build, Serve, Test oder E2E relevante Environment-Einflüsse ändern
- **THEN** invalidiert Nx den Cache für die betroffenen Frontend-Targets
- **AND** die betroffenen Env-Einflüsse sind in `nx.json` oder `apps/sva-studio-react/project.json` nachvollziehbar deklariert

### Requirement: Dediziertes SVA-Mainserver-Integrationspaket

Das System SHALL ein eigenes Workspace-Paket `packages/sva-mainserver` mit dem
Importpfad `@sva/sva-mainserver` bereitstellen.

#### Scenario: Paket und Nx-Projekt vorhanden

- **WHEN** das Workspace geladen wird
- **THEN** existiert ein Nx-Projekt `sva-mainserver`
- **AND** das Package trägt den Namen `@sva/sva-mainserver`
- **AND** das Projekt ist mit `scope:integration` und `type:lib` getaggt

#### Scenario: Öffentliche Root- und Server-Exports sind getrennt

- **WHEN** ein Modul Typen und Verträge des Mainserver-Pakets importiert
- **THEN** kann es `@sva/sva-mainserver` für client-sichere Exporte verwenden
- **AND** serverseitige Adapter werden ausschließlich über `@sva/sva-mainserver/server` importiert

### Requirement: Konsistente Workspace-Auflösung für Mainserver-Integrationen

Das System SHALL die Mainserver-Integrationspfade in der Workspace-Konfiguration
typsicher auflösen.

#### Scenario: TypeScript-Path-Mappings vorhanden

- **WHEN** ein Workspace-Modul `@sva/sva-mainserver` oder `@sva/sva-mainserver/server` importiert
- **THEN** existieren korrespondierende Einträge in `tsconfig.base.json`
- **AND** Build, Type-Check und IDE-Auflösung funktionieren ohne lokale Sonderkonfiguration

### Requirement: Datenbankzugriff ausschließlich über `@sva/data-repositories`

Das System SHALL alle Datenbankzugriffe des Mainserver-Pakets über das
bestehende Repository in `@sva/data-repositories` abwickeln. Das Paket `@sva/sva-mainserver`
führt keine eigene `pg`-Dependency und keinen eigenen Connection-Pool.

#### Scenario: Keine direkte pg-Dependency im Mainserver-Paket

- **WHEN** die `package.json` von `@sva/sva-mainserver` geprüft wird
- **THEN** enthält sie `pg` weder in `dependencies` noch in `peerDependencies`
- **AND** Zugriffe auf `iam.instance_integrations` laufen über das Repository in `@sva/data-repositories`

### Requirement: Coverage-Baseline für Mainserver-Paket

Das System SHALL eine Coverage-Baseline für `@sva/sva-mainserver` in
`coverage-policy.json` führen, damit der Coverage-Gate das Paket validiert.

#### Scenario: Coverage-Policy-Eintrag vorhanden

- **WHEN** der Coverage-Gate ausgeführt wird
- **THEN** existiert ein Eintrag für `@sva/sva-mainserver` in `tooling/testing/coverage-policy.json`
- **AND** die definierten Schwellwerte werden geprüft

### Requirement: Dockerfile enthält Build-Step für Mainserver-Paket

Das System SHALL den Build des Mainserver-Pakets im Produktions-Dockerfile
berücksichtigen, damit der Container korrekt deployed werden kann.

#### Scenario: Build-Step im Dockerfile vorhanden

- **WHEN** das Produktions-Dockerfile ausgeführt wird
- **THEN** wird `pnpm nx run sva-mainserver:build` als Build-Step ausgeführt
- **AND** der Step steht in der korrekten Abhängigkeitsreihenfolge (nach `auth-runtime:build` und den IAM-Zielpackages, vor `routing:build` und dem App-Build)

### Requirement: Standardisierter Runtime-Doctor pro Profil

Das System SHALL für jedes kanonische Runtime-Profil ein offizielles `doctor`-Kommando bereitstellen, das nicht nur Erreichbarkeit, sondern auch Schema-, Kontext- und Migrationsdiagnostik ausführt.

#### Scenario: Root-Scripts bilden den Diagnosepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:doctor:<profil>`-Skripte für `local-keycloak`, `local-builder` und `studio`
- **AND** die Skripte delegieren an eine gemeinsame Implementierung statt an profilindividuelle Ad-hoc-Debug-Kommandos

#### Scenario: Doctor-Ausgabe ist maschinenlesbar

- **WHEN** ein `env:doctor:<profil>`-Befehl mit `--json` ausgeführt wird
- **THEN** liefert das System pro Check mindestens `status`, `code`, `message` und optionale `details`
- **AND** die Ausgabe enthält keine Secrets oder PII

#### Scenario: Doctor meldet Goose-Migrationsstatus

- **WHEN** ein `env:doctor:<profil>`-Befehl ausgeführt wird
- **THEN** enthält die Diagnose einen separaten Check für `goose`-Verfügbarkeit und Migrationsstatus
- **AND** `details` enthalten mindestens die verwendete `goose`-Version oder den Remote-Status

### Requirement: Kanonischer Studio-Deploypfad

Das System SHALL für das Runtime-Profil `studio` einen offiziellen zweigeteilten Releasepfad bereitstellen, der GitHub-basiertes Build/Verify und einen lokalen Operator-Deploy in fixer Reihenfolge verbindet.

#### Scenario: Root-Scripts bilden den Studio-Releasepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:precheck:studio`, `env:deploy:studio` und `env:release:studio:local`
- **AND** `env:release:studio:local` delegiert an dieselbe gemeinsame `runtime-env`-Implementierung für `precheck`, `deploy`, `smoke` und `feedback`
- **AND** GitHub-Workflows `studio-image-build.yml`, `studio-artifact-verify.yml` und optional `studio-release.yml` bilden den vorbereitenden, nicht mutierenden Teil des Releasepfads ab

#### Scenario: Schemaänderung erfordert Wartungsfenster

- **WHEN** `env:release:studio:local` mit `--release-mode=schema-and-app` ausgeführt wird
- **THEN** verlangt das System ein dokumentiertes Wartungsfenster
- **AND** startet ohne dieses Wartungsfenster keinen Rollout

### Requirement: Standardisierte Deploy-Evidenz für Studio

Das System SHALL für jeden orchestrierten Studio-Deploy maschinenlesbare und menschenlesbare Evidenz erzeugen.

#### Scenario: Lokaler Operator-Deploy schreibt Evidenz-Artefakte

- **WHEN** `env:release:studio:local` ausgeführt wird
- **THEN** schreibt das System JSON- und Markdown-Artefakte unter `artifacts/runtime/deployments/`
- **AND** die Artefakte enthalten mindestens Image-Referenz, Actor, Workflow, Release-Modus, Schrittstatus und Stack-Zusammenfassung
- **AND** die Artefakte enthalten keine Secrets oder PII

#### Scenario: Migrations-Evidenz enthält Goose-Status

- **WHEN** ein Studio-Deploy mit oder ohne Migrationsschritt dokumentiert wird
- **THEN** enthalten die Artefakte den `goose`-Status der Migration
- **AND** die Migrationsevidenz kann die verwendete `goose`-Version ausweisen

### Requirement: Direkte Studio-`up`/`update`-Deploys sind gesperrt

Das System SHALL direkte Serverdeploys für `studio` über die Kommandos `up` und `update` standardmäßig verhindern.

#### Scenario: Legacy-Deploypfad wird blockiert

- **WHEN** `runtime-env.ts up studio` oder `runtime-env.ts update studio` ausgeführt wird
- **THEN** beendet das System den Lauf mit einer klaren Fehlermeldung
- **AND** verweist auf `env:release:studio:local` als einzigen dokumentierten produktionsnahen Einstiegspunkt

### Requirement: Einheitliche Runtime-Profile für Entwicklungs- und Betriebsmodi

Das System SHALL drei kanonische Runtime-Profile (`local-keycloak`, `local-builder`, `studio`) bereitstellen und deren nicht-sensitive Konfiguration versioniert im Repository führen.

#### Scenario: Profildefinitionen sind versioniert

- **WHEN** das Repository geprüft wird
- **THEN** existieren versionierte Profildefinitionen unter `config/runtime/`
- **AND** jedes Profil setzt `SVA_RUNTIME_PROFILE` eindeutig
- **AND** lokale standortspezifische Overrides bleiben außerhalb der versionierten Basisdateien

### Requirement: Standardisierte Runtime-Kommandos pro Profil

Das System SHALL für jedes Runtime-Profil standardisierte Befehle für `up`, `down`, `update`, `status`, `smoke` und `migrate` bereitstellen. Der kanonische Migrationspfad SHALL über einen repository-lokalen, versionsgepinnnten `goose`-Wrapper laufen und keine globale Tool-Installation voraussetzen.

#### Scenario: Root-Scripts bilden das Operations-Interface ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:*:<profil>`-Skripte für alle drei Runtime-Profile
- **AND** die Skripte delegieren an eine gemeinsame Implementierung statt an profilindividuelle Ad-hoc-Kommandos

#### Scenario: Smoke-Checks prüfen Kernabhängigkeiten

- **WHEN** ein Runtime-`smoke`-Befehl ausgeführt wird
- **THEN** prüft er mindestens Live-/Ready-Health, Auth-Verhalten und Mainserver-Basisfunktion
- **AND** lokale Profile prüfen zusätzlich den OTEL-Collector
- **AND** das `studio`-Profil prüft den serverseitigen Stack-Zustand

#### Scenario: Migrationspfad nutzt gepinnten Goose-Wrapper

- **WHEN** ein lokaler oder Acceptance-`migrate`-Pfad ausgelöst wird
- **THEN** ruft das System nur einen repository-lokalen `goose`-Wrapper auf
- **AND** der Wrapper installiert bzw. verwendet eine gepinnte `goose`-Version
- **AND** es ist keine globale `goose`-Installation Voraussetzung

### Requirement: Plugin-Action-Contracts bleiben an der SDK-Grenze
Plugin-Packages SHALL ihre Action-Definitionen ausschließlich über SDK-Contracts deklarieren und dieselben Definitionen sowohl für Registrierung als auch für UI-nahe Bindings wiederverwenden.

#### Scenario: Plugin wiederverwendet eine deklarierte Action-Definition
- **WHEN** ein Plugin eine Create/Edit/Delete-Oberfläche rendert
- **THEN** stammen Action-ID und Title-Key aus derselben SDK-basierten Action-Definition wie bei der Registrierung
- **AND** das Plugin führt keine zweite, ungebundene Action-Liste außerhalb des SDK-Vertrags

#### Scenario: Host-App baut Registry aus Plugin-Definitionen
- **WHEN** die Host-App Plugin-Metadaten zusammenführt
- **THEN** entsteht die Plugin-Action-Registry aus den exportierten Plugin-Definitionen
- **AND** Plugins benötigen dafür keine direkte Host-Abhängigkeit außerhalb von `@sva/plugin-sdk`

### Requirement: Final-Artifact-Verify als offizieller App-Target

Das System SHALL fuer `apps/sva-studio-react` einen dedizierten Nx-Target bereitstellen, der den finalen Runtime-Vertrag gegen den gebauten `.output/server/**`-Output prueft.

#### Scenario: App-Target prueft finalen Node-Output

- **WHEN** `pnpm nx run sva-studio-react:verify:runtime-artifact` ausgefuehrt wird
- **THEN** baut das Target zuerst die App
- **AND** startet danach den finalen Node-Output aus `.output/server/index.mjs`
- **AND** klassifiziert Fehler mindestens als `artifact-contract-failed`, `dependency-failed`, `runtime-start-failed` oder `http-dispatch-failed`

#### Scenario: Root-Skript delegiert an denselben Verify-Target

- **WHEN** das Root-`package.json` geprueft wird
- **THEN** existiert ein Skript `verify:runtime-artifact`
- **AND** dieses delegiert an `pnpm nx run sva-studio-react:verify:runtime-artifact`

### Requirement: Toolchain-Drift wird vor dem Runtime-Verify fail-fast erkannt

Das System SHALL vor dem produktionsnahen Runtime-Verify pruefen, ob lokale Toolchain und Lockfile denselben Abhaengigkeitsgraphen verwenden.

#### Scenario: Toolchain-Check stoppt bei veraltetem `node_modules`

- **WHEN** `pnpm check:toolchain-consistency` oder `pnpm nx run sva-studio-react:build` ausgefuehrt wird
- **AND** installierte Build-Tooling-Pakete von `pnpm-lock.yaml` abweichen
- **THEN** bricht der Check vor dem eigentlichen App-Build mit einer klaren Aufforderung zu `pnpm install --frozen-lockfile` ab

### Requirement: Root-Scripts bilden den Studio-Releasepfad ab

Das System SHALL fuer `studio` einen Root-Skript-Einstieg bereitstellen, der den lokalen Operator-Schritt fuer produktionsnahe Mutationen kapselt.

#### Scenario: Lokaler Studio-Release ist als Root-Skript verfuegbar

- **WHEN** ein Operator den finalen `studio`-Deploy aus dem Repository heraus starten will
- **THEN** existiert ein dediziertes Root-Skript fuer den lokalen Release-Einstieg
- **AND** dieses Skript verlangt explizit `image_digest`, `release_mode` und `rollback_hint`
- **AND** es fuehrt `env:precheck:studio`, `env:deploy:studio`, `env:smoke:studio` und `env:feedback:studio` in fester Reihenfolge aus

### Requirement: Plugin Registration Phases
The system SHALL define explicit build-time registration phases for workspace plugins so that content, admin, audit, and routing contributions are collected and validated in a deterministic order before the build-time registry snapshot is published.

The canonical phase order SHALL be contribution preflight, content, admin, audit, routing, and snapshot publication. The preflight step SHALL normalize plugin namespaces and guardrail-safe contribution shapes before domain phases run.

The phases SHALL organize the existing `BuildTimeRegistry` outputs instead of introducing a new public plugin system.

#### Scenario: Plugin contributions follow phase order
- **GIVEN** a plugin declares contributions for multiple phases
- **WHEN** the build-time registry snapshot is created
- **THEN** the host processes preflight, content, admin, audit, routing, and snapshot publication in that order
- **AND** later phases consume only outputs validated by earlier phases

#### Scenario: Plugin declares phase-incompatible contribution
- **GIVEN** a plugin declares a contribution in a phase that does not support it
- **WHEN** the registry snapshot is validated
- **THEN** validation fails with a deterministic `plugin_guardrail_*` diagnostic before the snapshot is published

#### Scenario: Routing consumer receives validated snapshot
- **GIVEN** the build-time registry snapshot was published successfully
- **WHEN** the routing package materializes plugin and admin routes
- **THEN** it can consume validated phase outputs instead of raw plugin definitions
- **AND** existing direct-plugin-definition callers remain supported while they are still validated fail-fast

#### Scenario: Existing build-time registry API remains compatible
- **GIVEN** a consumer calls `createBuildTimeRegistry()` and reads existing fields such as `routes`, `contentTypes`, `auditEvents`, `adminResources`, or `pluginActionRegistry`
- **WHEN** the registry is created through the phased implementation
- **THEN** those existing fields remain available with the same meaning
- **AND** no consumer is required to adopt a new public snapshot type for this change

### Requirement: Verbindliche Package-Zielarchitektur

Das System MUST die in `docs/architecture/package-zielarchitektur.md` beschriebenen Zielpackages als verbindliche Workspace-Grenzen umsetzen. Neue fachliche Logik MUST einem Zielpackage zugeordnet werden und darf nicht weiter in historische Sammelpackages wachsen, wenn ein passender Zielbaustein existiert.

#### Scenario: Neues IAM-Feature wird begonnen

- **WHEN** ein neues Feature Benutzerverwaltung, Rollen, Gruppen, Organisationen, Governance, DSR oder Instanzen betrifft
- **THEN** ordnet der Change die Arbeit einem Zielpackage wie `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry` zu
- **AND** die Implementierung landet nicht in einem historischen Sammelpackage

#### Scenario: Neues Datenfeature wird begonnen

- **WHEN** ein neues Feature Datenzugriff erweitert
- **THEN** wird zwischen client-sicherem Datenvertrag und serverseitigem Repository unterschieden
- **AND** Browser- oder Universal-Code importiert keine serverseitigen Repository- oder DB-Hilfen

### Requirement: Hard-Cut-Migration ohne dauerhafte Sammelimporte

Das System MUST alte Sammelimporte aus `@sva/auth`, `@sva/data` und `@sva/sdk` für migrierte Verantwortlichkeiten entfernen. Temporäre Re-Exports MAY nur innerhalb der aktiven Migrationsphase existieren und MUST mit Ablaufbedingung dokumentiert werden.

#### Scenario: Consumer nutzt migrierte Funktionalität

- **WHEN** eine Funktionalität in ein Zielpackage verschoben wurde
- **THEN** importieren alle produktiven Consumer den Zielpackage-Pfad
- **AND** der alte Sammelimport ist entfernt oder durch ein blockierendes Migrationsticket mit Ablaufdatum markiert

#### Scenario: Neue API wird veröffentlicht

- **WHEN** eine neue öffentliche API für Plugin-, Server-Runtime-, IAM-, Instanz- oder Datenlogik entsteht
- **THEN** wird sie direkt im passenden Zielpackage exportiert
- **AND** sie wird nicht zusätzlich als dauerhafte Kompatibilitäts-API über ein altes Sammelpackage veröffentlicht

### Requirement: Zielpackage-Tags und Boundary-Enforcement

Das System MUST jedes Zielpackage mit eindeutigen Nx-Tags, expliziten Package-Dependencies und standardisierten Targets versehen. ESLint-/Nx-Boundary-Regeln MUST unerlaubte Importkanten zwischen App, Plugins, Routing, Server-Runtime, Daten, IAM und Instanz-Control-Plane verhindern.

#### Scenario: Zielpackage wird angelegt

- **WHEN** ein Zielpackage wie `@sva/iam-admin` oder `@sva/instance-registry` angelegt wird
- **THEN** besitzt es `project.json`, `package.json`, TypeScript-Konfiguration, Build-, Lint-, Unit-, Type- und erforderliche Runtime-Checks
- **AND** trägt es Scope-Tags, die in `depConstraints` verwendet werden

#### Scenario: Unerlaubter Import wird eingeführt

- **WHEN** ein Package eine verbotene Importkante einführt, etwa Plugin zu internem Auth-Code oder Browser-Code zu serverseitigem Repository
- **THEN** schlägt die Boundary-Prüfung fehl
- **AND** die Fehlermeldung verweist auf den zulässigen öffentlichen Vertrag

### Requirement: PII- und Credential-Grenzen im Monorepo

Das System MUST Packages, die personenbezogene Daten im Klartext oder Credentials verarbeiten, explizit klassifizieren und ihre Importkanten entsprechend begrenzen.

#### Scenario: Package verarbeitet Klartext-PII

- **WHEN** ein Package Klartext-PII entschlüsselt oder verarbeitet
- **THEN** trägt es einen expliziten PII-Tag
- **AND** seine Tests decken Autorisierungs- und Datenflussgrenzen ab
- **AND** nicht autorisierte Packages können die Entschlüsselungsfähigkeit nicht importieren

#### Scenario: Integration benötigt Credentials

- **WHEN** ein Integrationspackage Credentials benötigt
- **THEN** konsumiert es einen expliziten Credential-Vertrag
- **AND** es importiert keine Session-, Middleware- oder Auth-Runtime-Interna

### Requirement: Kanonischer Build-time-Registry-Vertrag fuer Package-Beitraege

Das Monorepo SHALL einen gemeinsamen Build-time-Registry-Vertrag bereitstellen, ueber den der Host statische Package-Beitraege fuer Plugins und Admin-Ressourcen deterministisch materialisiert.

#### Scenario: Host erzeugt einen einzigen Registry-Snapshot

- **WHEN** die Host-App ihre statischen Package-Beitraege initialisiert
- **THEN** verwendet sie einen gemeinsamen Build-time-Registry-Snapshot statt separater Merge-Schritte fuer Routen, Navigation, Content-Typen, Uebersetzungen und Admin-Ressourcen
- **AND** der Snapshot bleibt build-time und hostkontrolliert

#### Scenario: Registry validiert Konflikte vor der Materialisierung

- **WHEN** statische Package-Beitraege doppelte Plugin-IDs oder kollidierende Admin-Ressourcen deklarieren
- **THEN** bricht die Registry-Erzeugung deterministisch mit einem Fehler ab
- **AND** der Host publiziert keinen teilweise inkonsistenten Build-time-Zustand

### Requirement: Plugin-Packages besitzen genau einen kanonischen Namespace

Das Monorepo SHALL fuer jedes Plugin-Package genau eine technische Plugin-Identitaet mit genau einem owning namespace definieren, aus der registrierte Host-Identifier fuer dieses Plugin abgeleitet werden.

#### Scenario: Plugin-Package verwendet einen eindeutigen Namespace

- **WHEN** ein Workspace-Package als Plugin fuer den Host registriert wird
- **THEN** besitzt es genau einen kanonischen Plugin-Namespace
- **AND** dieser Namespace wird fuer weitere registrierte Host-Beitraege desselben Plugins wiederverwendet
- **AND** das Plugin fuehrt keine zweite konkurrierende Namespace-Identitaet fuer dieselben Host-Beitraege ein

#### Scenario: Doppelter Plugin-Namespace wird abgewiesen

- **WHEN** zwei Plugin-Packages denselben kanonischen Namespace beanspruchen
- **THEN** wird die Host- oder Registry-Initialisierung deterministisch mit einem Konfliktfehler abgebrochen
- **AND** kein teilweise inkonsistenter Registry-Zustand wird publiziert

### Requirement: Reservierte Core-Namespaces bleiben hostexklusiv

Das Monorepo MUST reservierte Core-Namespaces fuer hosteigene oder explizit definierte Core-Vertraege schuetzen.

#### Scenario: Plugin beansprucht reservierten Core-Namespace

- **WHEN** ein Plugin-Package einen reservierten Core-Namespace wie `iam`, `content` oder `admin` fuer seine technische Plugin-Identitaet nutzen will
- **THEN** wird die Registrierung abgewiesen
- **AND** der Namespace bleibt dem Host oder einem explizit definierten Core-Vertrag vorbehalten

### Requirement: Studio UI React Target Package
The system SHALL provide `@sva/studio-ui-react` as a dedicated Workspace package for reusable Studio React UI.

#### Scenario: Studio UI React package exists
- **WHEN** the workspace projects are listed
- **THEN** `packages/studio-ui-react` exists as an Nx library
- **AND** it exposes the import path `@sva/studio-ui-react`
- **AND** it has build, unit-test, type-test, and lint targets consistent with workspace conventions

#### Scenario: Studio UI React package remains UI-only
- **WHEN** `@sva/studio-ui-react` source imports are checked
- **THEN** it has no runtime imports from server runtime, data repositories, IAM implementation packages, or app-internal modules
- **AND** it does not contain domain persistence, route materialization, guard evaluation, or plugin registry logic

### Requirement: Plugin UI Dependency Boundary
Plugins SHALL consume host metadata through `@sva/plugin-sdk` and shared Studio React UI through `@sva/studio-ui-react`.

#### Scenario: Plugin declares allowed workspace dependencies
- **WHEN** a plugin package with name `@sva/plugin-*` provides custom views
- **THEN** its `package.json` may declare `@sva/plugin-sdk` and `@sva/studio-ui-react` as Workspace dependencies
- **AND** it does not declare app-internal modules or deprecated aggregate packages as dependencies

#### Scenario: Plugin imports app internal UI
- **WHEN** a plugin imports from `apps/sva-studio-react/src/**`
- **THEN** the boundary check fails
- **AND** the violation explains that shared UI must be imported from `@sva/studio-ui-react`

#### Scenario: Plugin defines duplicate reusable basis control
- **WHEN** a plugin defines reusable controls that duplicate available Studio UI controls such as Button, Input, Select, Tabs, Dialog, Alert, Badge, Table, or DataTable
- **THEN** lint, CI, or review checks reject the duplicate basis control
- **AND** the plugin may instead define domain-specific wrappers that compose `@sva/studio-ui-react`

### Requirement: Events And POI Are Separate Plugin Packages

The monorepo SHALL provide Events and POI editing as two separate plugin packages with distinct package names, namespaces, routes, action IDs, content types, tests, and ownership boundaries.

#### Scenario: Events plugin package is registered

- **WHEN** the Events plugin is added to the workspace
- **THEN** it uses package name `@sva/plugin-events`
- **AND** it uses canonical namespace `events`
- **AND** it registers routes under `/plugins/events`
- **AND** it does not share its plugin identity with News or POI

#### Scenario: POI plugin package is registered

- **WHEN** the POI plugin is added to the workspace
- **THEN** it uses package name `@sva/plugin-poi`
- **AND** it uses canonical namespace `poi`
- **AND** it registers routes under `/plugins/poi`
- **AND** it does not share its plugin identity with News or Events

#### Scenario: Host build-time registry includes both plugins

- **GIVEN** News, Events, and POI plugins are present in the workspace
- **WHEN** the host build-time registry is created
- **THEN** it registers all three plugins deterministically
- **AND** duplicate plugin IDs, route IDs, navigation IDs, content types, or action IDs are rejected by existing registry guardrails

### Requirement: Events And POI Plugins Preserve SDK And UI Boundaries

Events and POI plugin packages SHALL consume host metadata through `@sva/plugin-sdk` and shared React UI through `@sva/studio-ui-react`.

They SHALL NOT depend on app-internal modules, server-only runtime modules, or another fachplugin for core behavior.

#### Scenario: Allowed plugin dependencies

- **WHEN** `@sva/plugin-events` or `@sva/plugin-poi` declares Workspace dependencies
- **THEN** it lists allowed dependencies with `workspace:*`
- **AND** runtime imports use ESM-strict `.js` endings for relative runtime paths

#### Scenario: Plugin depends on another fachplugin

- **GIVEN** the Events editor optionally references a POI identifier
- **WHEN** dependencies are evaluated
- **THEN** `@sva/plugin-events` does not import `@sva/plugin-poi` for runtime behavior
- **AND** cross-domain selection, if implemented, is mediated by a host-owned data contract or explicit shared SDK capability

#### Scenario: Plugin duplicates base UI controls

- **WHEN** Events or POI plugin code needs buttons, inputs, tables, dialogs, tabs, or form primitives
- **THEN** it uses `@sva/studio-ui-react`
- **AND** it does not introduce a parallel reusable base-control system inside the plugin package

### Requirement: Full News Model Preserves Plugin Package Boundary

The expanded News data model SHALL preserve the package boundary between `@sva/plugin-news`, the host app, auth runtime, and the server-only Mainserver package.

`@sva/plugin-news` SHALL continue to depend only on allowed plugin-facing packages and SHALL NOT import `apps/**`, `@sva/auth-runtime/server`, or `@sva/sva-mainserver/server`.

#### Scenario: Plugin needs full News fields

- **GIVEN** the News plugin needs full Mainserver News fields
- **WHEN** it loads, creates, or updates News
- **THEN** it uses the host-owned HTTP facade
- **AND** it does not import server-only Mainserver adapters or auth runtime server helpers

#### Scenario: Boundary check runs

- **GIVEN** a developer accidentally imports a server-only module from `@sva/plugin-news`
- **WHEN** lint, build, plugin-boundary, or review gates run
- **THEN** the invalid dependency is rejected

### Requirement: Full News Model Reuses Studio UI Foundation

The expanded News editor SHALL use `@sva/studio-ui-react` and the existing Studio UI foundation for full-model fields.

The implementation SHALL NOT introduce a parallel base component system in `@sva/plugin-news`.

#### Scenario: Nested News fields are rendered

- **GIVEN** the News editor renders nested categories, content blocks, media references, source URLs, and address fields
- **WHEN** UI controls are implemented
- **THEN** they use the Studio UI primitives and patterns already established for plugin UI
- **AND** plugin-local UI is limited to composition and field-specific behavior

