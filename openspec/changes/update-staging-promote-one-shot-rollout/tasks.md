## 1. Executor und Gate-Vertrag

- [ ] 1.1 Einen CI-tauglichen Einstieg für die bestehenden Migration- und Bootstrap-Executors erstellen, ohne ihre fachliche One-shot-Logik zu duplizieren.
- [ ] 1.2 Den inline implementierten Dev-Bootstrap auf diesen Einstieg umstellen.
- [ ] 1.3 `promote-deploy-gates.ts` um umgebungsbezogene Executor-Freigaben erweitern: Dev und Staging nur bei real verdrahtetem Executor, Production immer fail-closed.
- [ ] 1.4 Unit-Tests für Gate-Freigaben und Production-Fail-Closed ergänzen.

## 2. Promote-Workflow für Staging

- [ ] 2.1 `maintenance_window` für `workflow_dispatch` und `workflow_call` ergänzen; für Staging-Migrationen mit `run` format- und präsenzvalidieren.
- [ ] 2.2 Git-Base/-Head, Checkout des Executor-Codes und verifiziertes Ziel-Digest vor jeder Mutation verbindlich zusammenführen.
- [ ] 2.3 Temporäre Migration- und Bootstrap-Stacks mit eindeutigen Namen, Zielnetzwerk, Ziel-Datenbankhost und demselben Digest ausführen.
- [ ] 2.4 Terminalzustand, Timeout, fehlende oder unlesbare Task-Information, Exit-Code, redigierte Logs und Cleanup als fail-closed behandeln.
- [ ] 2.5 Schema- und Bootstrap-Postconditions vor dem App-Deploy ausführen.
- [ ] 2.6 Vor dem Deploy den laufenden App-Digest remote erfassen; danach Servicezustand, Ziel-Digest sowie interne und externe Staging-Smokes prüfen.
- [ ] 2.7 GitHub-Step-Summary und redigierte maschinenlesbare Artefakte für Preflight, Jobs, Cleanup, Postflight und Recovery-Hinweis erstellen.

## 3. Tests und Qualitätsgates

- [ ] 3.1 Unit-Tests für Job-Compose-Dokumente, Netzwerkbindung, Datenbankhost, eindeutige Namen, Task-Status, Timeout, Logredaktion und Cleanup-Fehler ergänzen.
- [ ] 3.2 Workflow-Vertrag testen: `migration → bootstrap → postconditions → deploy → verify`, einschließlich dass Fehler den App-Deploy verhindern.
- [ ] 3.3 Staging-Compose und beide One-shot-Dokumente lokal rendern und nachweisen, dass sie keinen `app`-, `postgres`- oder `redis`-Service enthalten.
- [ ] 3.4 Betroffene Unit-, TypeScript-, Server-Runtime-, Workflow- und File-Placement-Gates ausführen; anschließend `pnpm test:pr` ausführen.

## 4. Dokumentation und Abnahme

- [ ] 4.1 `docs/architecture/07-deployment-view.md` auf GitHub Actions als kanonischen Staging-Pfad und die unveränderte Production-App-only-Grenze aktualisieren.
- [ ] 4.2 `docs/architecture/08-cross-cutting-concepts.md` und `11-risks-and-technical-debt.md` um Autorisierung, Evidenz, Geheimnisredaktion, Recovery und Production-Folgeanforderungen ergänzen.
- [ ] 4.3 `docs/guides/swarm-deployment-runbook.md` mit derselben Staging-Reihenfolge und dem lokalen Diagnose-/Recovery-Pfad aktualisieren.
- [ ] 4.4 Nach Merge einen manuellen Staging-Promote des neuen Main-Images mit beiden `run`-Modi, exaktem Git-Bereich und Wartungsfenster durchführen; One-shot-Exit-Codes, Live-Digest und interne/externe Smokes dokumentieren.
