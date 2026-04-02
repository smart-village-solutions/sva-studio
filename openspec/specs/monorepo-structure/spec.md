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
Das System SHALL Packages als eigenständige npm-Module organisieren, inklusive klarer Namenskonventionen für Core und Plugins. Plugins SHALL dabei ausschließlich über `@sva/sdk` mit dem Host-System kommunizieren und dürfen keine direkten Abhängigkeiten auf `@sva/core` oder andere interne Packages deklarieren.

#### Scenario: Package-Namensschema
- **WHEN** ein neues Paket erstellt wird
- **THEN** verwendet es ein Scope wie @sva/* und Plugins verwenden @sva/plugin-*

#### Scenario: Plugin-Dependency-Regel
- **WHEN** ein Plugin-Package erstellt oder aktualisiert wird
- **THEN** listet seine `package.json` nur `@sva/sdk` als Workspace-Dependency
- **AND** direkte Abhängigkeiten auf `@sva/core` oder andere interne Packages sind nicht vorhanden

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
Plugins (Packages mit Tag `scope:plugin` oder Namensschema `@sva/plugin-*`) SHALL ausschließlich über `@sva/sdk` mit dem Host-System interagieren. Direkte Imports aus `@sva/core` oder anderen internen Packages sind für Plugins nicht zulässig.

#### Scenario: Plugin importiert aus SDK
- **WHEN** ein Plugin eine Funktion oder einen Typ des Host-Systems benötigt
- **THEN** importiert es ausschließlich aus `@sva/sdk` oder dessen Sub-Exports
- **AND** die `package.json` des Plugins listet nur `@sva/sdk` als Workspace-Dependency (nicht `@sva/core`)

#### Scenario: Direktimport aus Core wird durch Lint verhindert
- **WHEN** ein Plugin-Entwickler versucht, direkt aus `@sva/core` zu importieren
- **THEN** schlägt die ESLint-Boundary-Prüfung fehl
- **AND** eine aussagekräftige Fehlermeldung verweist auf `@sva/sdk` als korrekte Schnittstelle

#### Scenario: SDK stellt Plugin-relevante Exporte bereit
- **WHEN** ein Plugin Zugriff auf Routing-Typen, Versions-Info oder andere Host-APIs benötigt
- **THEN** stellt `@sva/sdk` die entsprechenden Re-Exports bereit
- **AND** interne Implementierungsdetails von `@sva/core` werden nicht exponiert

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
- **WHEN** ein Package Sub-Path-Exports in `package.json` definiert (z. B. `@sva/sdk/server`)
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

### Requirement: Datenbankzugriff ausschließlich über `@sva/data`-Repository

Das System SHALL alle Datenbankzugriffe des Mainserver-Pakets über das
bestehende Repository in `@sva/data` abwickeln. Das Paket `@sva/sva-mainserver`
führt keine eigene `pg`-Dependency und keinen eigenen Connection-Pool.

#### Scenario: Keine direkte pg-Dependency im Mainserver-Paket

- **WHEN** die `package.json` von `@sva/sva-mainserver` geprüft wird
- **THEN** enthält sie `pg` weder in `dependencies` noch in `peerDependencies`
- **AND** Zugriffe auf `iam.instance_integrations` laufen über das Repository in `@sva/data`

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
- **AND** der Step steht in der korrekten Abhängigkeitsreihenfolge (nach `auth:build`, vor `plugin-example:build`)

### Requirement: Standardisierter Runtime-Doctor pro Profil

Das System SHALL für jedes kanonische Runtime-Profil ein offizielles `doctor`-Kommando bereitstellen, das nicht nur Erreichbarkeit, sondern auch Schema-, Kontext- und Migrationsdiagnostik ausführt.

#### Scenario: Root-Scripts bilden den Diagnosepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:doctor:<profil>`-Skripte für `local-keycloak`, `local-builder` und `acceptance-hb`
- **AND** die Skripte delegieren an eine gemeinsame Implementierung statt an profilindividuelle Ad-hoc-Debug-Kommandos

#### Scenario: Doctor-Ausgabe ist maschinenlesbar

- **WHEN** ein `env:doctor:<profil>`-Befehl mit `--json` ausgeführt wird
- **THEN** liefert das System pro Check mindestens `status`, `code`, `message` und optionale `details`
- **AND** die Ausgabe enthält keine Secrets oder PII

#### Scenario: Doctor meldet Goose-Migrationsstatus

- **WHEN** ein `env:doctor:<profil>`-Befehl ausgeführt wird
- **THEN** enthält die Diagnose einen separaten Check für `goose`-Verfügbarkeit und Migrationsstatus
- **AND** `details` enthalten mindestens die verwendete `goose`-Version oder den Remote-Status

### Requirement: Kanonischer Acceptance-Deploypfad

Das System SHALL für das Runtime-Profil `acceptance-hb` einen offiziellen Deploypfad mit `precheck` und `deploy` bereitstellen, der Migration, Rollout und Verifikation in fixer Reihenfolge ausführt.

#### Scenario: Root-Scripts bilden den Acceptance-Releasepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:precheck:acceptance-hb` und `env:deploy:acceptance-hb`
- **AND** beide delegieren an dieselbe gemeinsame `runtime-env`-Implementierung

#### Scenario: Schemaänderung erfordert Wartungsfenster

- **WHEN** `env:deploy:acceptance-hb` mit `--release-mode=schema-and-app` ausgeführt wird
- **THEN** verlangt das System ein dokumentiertes Wartungsfenster
- **AND** startet ohne dieses Wartungsfenster keinen Rollout

### Requirement: Standardisierte Deploy-Evidenz für Acceptance

Das System SHALL für jeden orchestrierten Acceptance-Deploy maschinenlesbare und menschenlesbare Evidenz erzeugen.

#### Scenario: Deploy schreibt Evidenz-Artefakte

- **WHEN** `env:deploy:acceptance-hb` ausgeführt wird
- **THEN** schreibt das System JSON- und Markdown-Artefakte unter `artifacts/runtime/deployments/`
- **AND** die Artefakte enthalten mindestens Image-Referenz, Actor, Workflow, Release-Modus, Schrittstatus und Stack-Zusammenfassung
- **AND** die Artefakte enthalten keine Secrets oder PII

#### Scenario: Migrations-Evidenz enthält Goose-Status

- **WHEN** ein Acceptance-Deploy mit oder ohne Migrationsschritt dokumentiert wird
- **THEN** enthalten die Artefakte den `goose`-Status der Migration
- **AND** die Migrationsevidenz kann die verwendete `goose`-Version ausweisen

### Requirement: Direkte Acceptance-`up`/`update`-Deploys sind gesperrt

Das System SHALL direkte Serverdeploys für `acceptance-hb` über die Kommandos `up` und `update` standardmäßig verhindern.

#### Scenario: Legacy-Deploypfad wird blockiert

- **WHEN** `runtime-env.ts up acceptance-hb` oder `runtime-env.ts update acceptance-hb` ausgeführt wird
- **THEN** beendet das System den Lauf mit einer klaren Fehlermeldung
- **AND** verweist auf `env:deploy:acceptance-hb` als einzigen kanonischen Einstiegspunkt

### Requirement: Einheitliche Runtime-Profile für Entwicklungs- und Betriebsmodi

Das System SHALL drei kanonische Runtime-Profile (`local-keycloak`, `local-builder`, `acceptance-hb`) bereitstellen und deren nicht-sensitive Konfiguration versioniert im Repository führen.

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

#### Scenario: Migrationspfad nutzt gepinnten Goose-Wrapper

- **WHEN** ein lokaler oder Acceptance-`migrate`-Pfad ausgelöst wird
- **THEN** ruft das System nur einen repository-lokalen `goose`-Wrapper auf
- **AND** der Wrapper installiert bzw. verwendet eine gepinnte `goose`-Version
- **AND** es ist keine globale `goose`-Installation Voraussetzung

