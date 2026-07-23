## Context

`Promote` validiert bereits Environment, Image-Vertrag und Änderungsbereich. PR #676 hat `run` jedoch bewusst nur als Gate-Modus eingeführt: Migrationen werden blockiert, und Bootstrap ist nur für Dev inline implementiert. Die Runtime enthält inzwischen getestete Bausteine für isolierte Migration- und Bootstrap-Stacks. Diese werden für Staging wiederverwendet, nicht neu implementiert.

## Goals

- Staging-Änderungen mit Migration oder Bootstrap sicher über den vorhandenen `Promote`-Workflow ausrollen.
- Live-App erst nach abgeschlossenen One-shot-Jobs und fachlichen Postconditions verändern.
- Evidenz, Cleanup und eine belastbare Verbindung zwischen Source-Commit und Image herstellen.
- Production in der Architektur berücksichtigen, ohne dessen `run`-Autorisierung zu lockern.

## Non-Goals

- Keine neue Orchestrierungsplattform, kein zweiter Workflow und kein Ersatz des lokalen Recovery-Pfads.
- Kein automatisches DB-Rollback.

## Decisions

### Ein Workflow, drei explizite Umgebungsverträge

`Promote` bleibt der gemeinsame Einstieg. Der konkrete Vertrag ist:

| Umgebung | App-Deploy | `migration_mode=run` / `bootstrap_mode=run` |
| --- | --- | --- |
| `dev` | erlaubt | erlaubt über denselben Executor |
| `staging` | erlaubt | erlaubt nach Environment-Freigabe und Wartungsfenster |
| `prod` | erlaubt, App-only | fail-closed; spätere Aktivierung ist ein separater Change |

Für den automatisch durch `main` ausgelösten Dev-Promote ergänzt `auto` die expliziten Modi `assert-none` und `run`: Der Workflow klassifiziert den Commit-Diff anhand derselben Risiko-Regeln. Ohne Risiko wird der betreffende Job übersprungen; bei Migrations- oder Bootstrap-Risiko wird der zugehörige gehärtete One-shot-Job ausgeführt. `auto` ist ausschließlich für `dev` zulässig. Fehler in einem benötigten Job verhindern den App-Deploy und lassen den vorherigen Dev-Stand aktiv.

### Artefaktbindung vor Mutation

Vor einer Mutation validiert der Workflow, dass `change_base` und `change_head` konkrete Git-Commits bilden und der ausgecheckte Executor-Code `change_head` entspricht. Für Staging löst er die Image-Eingabe in der Registry zu einem Manifest-Digest auf und prüft das OCI-Label `org.opencontainers.image.revision` gegen `change_head`. Job- und App-Stack erhalten exakt dieselbe aufgelöste Digest-Referenz.

### Isolierte One-shot-Jobs

Migration und Bootstrap starten jeweils mit einem eindeutigen Namen aus Run-ID und Attempt. Sie verwenden ausschließlich das vorhandene interne Overlay-Netzwerk des Zielstacks und dessen Datenbank-Hostname. Ihre gerenderten Compose-Dokumente enthalten keinen `app`-, `postgres`- oder `redis`-Service. Der Executor verfolgt Tasks bis zu einem eindeutigen Terminalzustand, sammelt Task-ID, Exit-Code und redigierten Log-Tail und entfernt die temporären Ressourcen im `finally`-Pfad.

### Kontrollfluss und Fehlerverhalten

Bei `migration_mode=run` ist `maintenance_window` verpflichtend und wird als nicht-sensitiver Ticket-/Zeitfenster-Verweis validiert. Der Bootstrap wird nur bei `bootstrap_mode=run` und nach erfolgreicher Migration gestartet. Fehlende Tasks, nicht lesbarer Status, Timeout, Exit-Code ungleich null, fehlerhafte Postcondition oder Cleanup-Fehler machen den Lauf rot und verhindern den nachfolgenden App-Deploy. Vor dem App-Deploy wird dessen laufendes Digest aus der Remote-Service-Spec als Rollback-Hinweis erfasst.

Nach dem App-Deploy prüfen Servicezustand, erwartetes Image-Digest und interne/externe Staging-Smokes. Automatisches App-Rollback wird in diesem Change nicht aktiviert; bei fehlgeschlagener Verifikation bleiben der vorherige Digest und der dokumentierte Recovery-Pfad verfügbar. Datenbankmigrationen werden nie automatisch zurückgerollt.

### Evidenz und Geheimnisschutz

Step Summary und maschinenlesbare Artefakte enthalten ausschließlich redigierte und strukturierte Fakten: Environment, Ziel- und vorheriges Digest, Commit, Job-/Task-IDs, Terminalzustände, Dauer, Check-Ergebnisse, Cleanup und Recovery-Hinweis. `.env`, `APP_CONFIG`, vollständige Remote-Logs, SQL-Fehler mit sensitiven Daten und personenbezogene Daten werden weder hochgeladen noch ausgegeben.

## Risks / Trade-offs

- GitHub Actions erhält für den mutierenden Staging-Pfad Quantum-Zugang. Required Reviewers für das GitHub-Environment `staging` sind eine externe Merge-Voraussetzung; Secrets werden nur dort bezogen.
- Ein fehlgeschlagener App-Healthcheck kann einen manuell zu behandelnden Staging-Zustand hinterlassen. Das ist gegenüber einem ungetesteten automatischen Rollback die bewusst konservative Wahl; die Entscheidung wird für Production erneut bewertet.
- Das bestehende Spezifikationsziel "lokaler Final-Deploy als Standard" wird für Staging gezielt ersetzt. Lokal bleibt Diagnose und Recovery, nicht kanonischer Staging-Rollout.

## Migration Plan

1. CI-Einstieg über die vorhandenen Job-Executor etablieren und Dev-Bootstrap darauf umstellen.
2. Staging-Gates, Wartungsfenster, Artefaktbindung und One-shot-Phasen im bestehenden Workflow ergänzen.
3. Strukturierte Evidenz, Pre-/Postflight und garantierten Cleanup ergänzen.
4. Tests, statische Workflow-Vertragsprüfungen und Compose-Rendering ergänzen.
5. arc42 und Swarm-Runbook auf den kanonischen Staging-Pfad aktualisieren.
6. Nach Merge exakt ein Main-Image mit `environment=staging`, beiden `run`-Modi, explizitem Base/Head und Wartungsfenster ausrollen und Smoke-Nachweise prüfen.

## Open Questions

- Soll ein fehlgeschlagener Staging-Postflight in einem Folgechange automatisches App-Rollback auslösen, oder bleibt der dokumentierte manuelle Recovery-Pfad dauerhaft die Regel?
