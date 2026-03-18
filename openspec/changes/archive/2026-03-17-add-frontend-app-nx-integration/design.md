## Kontext

Die Frontend-App `apps/sva-studio-react` nutzt Vite, Vitest und Playwright, exponiert diese Werkzeuge gegenüber Nx derzeit aber überwiegend über generische Shell-Kommandos. Dadurch verliert der Workspace einen Teil der semantischen Informationen, die für standardisierte Target-Konfiguration, präzise Cache-Invalidierung und klare `affected`-Auswertungen relevant sind.

Gleichzeitig verlangt die Governance für dieses Repo, dass zentrale Frontend-Aufgaben als echte Nx-Targets mit nachvollziehbaren `inputs` und `outputs` dokumentiert sind.

## Entscheidungen

### 1. Dedizierte Nx-Executor statt `nx:run-commands`

Für `sva-studio-react` werden fachlich passende Nx-Executor verwendet:

- `build`: Vite-basierter Build-Executor
- `serve`: Vite-basierter Dev-Server-Executor
- `lint`: `@nx/eslint:lint`
- `test:unit`: Vitest-basierter Nx-Test-Executor
- `test:coverage`: Vitest-basierter Nx-Test-Executor mit Coverage-Konfiguration
- `test:e2e`: Playwright-basierter Nx-Executor

`preview` kann optional ebenfalls auf einen dedizierten Vite-Preview-Executor umgestellt werden, ist aber nicht Teil des Minimal-Scope dieser Änderung.

### 2. Explizite Target-Definition in `project.json`

Obwohl Nx für Teile des Toolings inferierte Targets erzeugen kann, wird für `sva-studio-react` eine explizite Target-Definition in `apps/sva-studio-react/project.json` bevorzugt. Das erfüllt die Governance-Anforderung nach klar sichtbaren Frontend-Targets und erlaubt projektspezifische `inputs`/`outputs` ohne implizite Konventionen.

### 3. Frontend-spezifische Cache-Eingaben

Die Cache-Berechnung der Frontend-Targets muss neben Quell- und Testdateien auch die App-spezifischen Konfigurationen berücksichtigen. Dazu gehören mindestens:

- `apps/sva-studio-react/vite.config.ts`
- `apps/sva-studio-react/vitest.config.ts`
- `apps/sva-studio-react/playwright.config.ts`
- `apps/sva-studio-react/tailwind.config.cjs`
- `apps/sva-studio-react/postcss.config.cjs`
- `apps/sva-studio-react/tsconfig.json`
- `apps/sva-studio-react/package.json`

Zusätzlich werden cache-relevante Environment-Einflüsse explizit modelliert. Nach heutigem Stand sind mindestens folgende Variablen fachlich relevant:

- `TSS_DEV_SERVER` für den Dev-Server-/TanStack-Start-Pfad
- `CI` für Playwright- und Reporter-Verhalten
- `CODECOV_TOKEN` für Build-bezogene Plugin-Aktivierung in `vite.config.ts`

### 4. Outputs nach Artefakt-Typ

Die Targets erhalten konsistente Output-Definitionen:

- `build`: Dist-Artefakte der App
- `test:coverage`: Coverage-Artefakte der App
- `test:e2e`: standardisierte Playwright-Reports/Artefakte, sofern im Zielbild erzeugt
- `serve`, `lint`, `test:unit`: keine persistierten Build-Artefakte; `outputs` werden explizit leer modelliert

## Konsequenzen

### Vorteile

- Bessere Lesbarkeit und Governance der Frontend-Targets
- Präzisere Cache-Invalidierung bei Änderungen an Konfiguration und Environment
- Robusteres `nx affected`-Verhalten für lokale Entwicklung und CI
- Geringere Abhängigkeit von projektlokalen Shell-Skripten für Standard-Tasks

### Kosten und Risiken

- Zusätzliche Nx-Plugins müssen versionsgleich zum Workspace eingebunden werden
- Bestehende Paket-Skripte und Konfigurationsdateien müssen mit den Nx-Executors sauber zusammenspielen
- Playwright-Webserver-Integration muss so umgestellt werden, dass keine doppelte Dev-Server-Orchestrierung entsteht

## Offene Punkte

- Ob `test:e2e` direkt auf `sva-studio-react:serve` referenziert oder einen dedizierten Preview-/Webserver-Pfad nutzt
- Ob `preview` im gleichen Change mitmigriert oder bewusst als Folgeschritt behandelt wird
