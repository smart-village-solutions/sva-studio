# Ursachenbericht: Dev-Bootstrap über den Promote-Workflow

Stand: 22.07.2026

## Kurzfassung

Der Dev-Server ist als laufender App-Stack gesund, der dedizierte Bootstrap wurde aber noch **kein einziges Mal erfolgreich** über den neuen CI-Pfad ausgeführt. Die bisherigen Fehlschläge sind keine fachlichen Bootstrap-Fehler, sondern nacheinander aufgetretene Inkompatibilitäten an der Grenze zwischen GitHub Actions, Quantum-CLI 3.2.1 und dem von Docker Compose erzeugten Stack-Payload.

Der aktuelle Fix in PR [#738](https://github.com/smart-village-solutions/sva-studio/pull/738) adressiert die bislang letzte nachgewiesene Ursache: Der temporäre Bootstrap-Stack übersprang den vorhandenen Quantum-Renderer und enthielt deshalb `bootstrap.command: null`. Quantum lehnt diesen Wert ab.

Ein weiterer Merge und ein erneuter Lauf sind erst dann eine belastbare Verifikation, wenn PR #738 grün ist und der Lauf nachweislich den Bootstrap-Task startet, dessen terminalen Exit-Code ausliest und anschließend den App-Stack prüft. Bis dahin ist nicht belegt, dass die fachliche Bootstrap-Logik oder die Tenant-Reparatur auf Dev erfolgreich ist.

## Aktueller Betriebsstand

| Bereich                  | Stand                          | Evidenz                                                                                      |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------- |
| Dev-Endpoint             | erreichbar                     | Quantum-Endpoint `sva` ist über die CI und die lokale Operator-CLI erreichbar.               |
| Live-Stack               | läuft                          | `studio-dev` hat `app`, `provisioner`, `postgres` und `redis` mit je `1/1` laufender Replik. |
| Aktuelles Live-Image     | `d874b0e1…`                    | `app` und `provisioner` wurden am 22.07.2026 um 11:03 UTC auf dieses Image aktualisiert.     |
| Live-Bootstrap-Service   | erwartungsgemäß `0/0`          | Der Service im Hauptstack ist ein One-shot-Vorlage-Service und läuft nicht dauerhaft.        |
| CI-Bootstrap             | nicht erfolgreich nachgewiesen | Die bisherigen Promote-Läufe scheiterten vor dem Start eines Bootstrap-Containers.           |
| Tenant-Reparatur per MCP | nicht freigegeben              | Sie hängt vom erfolgreichen, reproduzierbaren Bootstrap- und Provisionierungsnachweis ab.    |

Der aktuelle Live-Stack wurde durch die fehlgeschlagenen temporären Bootstrap-Stacks nicht verändert: Die Jobs verwenden eigene Stack-Namen und das bestehende Netzwerk `studio-dev_default`.

## Chronologie und belegte Ursachen

| Zeitpunkt (UTC) | Lauf / Änderung                                                                                                    | Beobachtung                                                                               | Ursache                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 10:06           | [PR #733](https://github.com/smart-village-solutions/sva-studio/pull/733)                                          | Bootstrap-Gate und One-shot-Ausführung eingeführt.                                        | Grundlage geschaffen, aber gegen lokale statt gegen CI-CLI-Syntax entwickelt.                  |
| 10:14–10:16     | [Runs 29911152997 und 29911177540](https://github.com/smart-village-solutions/sva-studio/actions/runs/29911152997) | `flag provided but not defined: -project`                                                 | Die in Actions installierte Quantum-CLI kannte `--project` nicht.                              |
| 10:20           | [PR #734](https://github.com/smart-village-solutions/sva-studio/pull/734)                                          | Wechsel auf `stacks create`.                                                              | Der Aufruf enthielt weiterhin das nicht unterstützte Flag.                                     |
| 10:30           | [Run 29912203106](https://github.com/smart-village-solutions/sva-studio/actions/runs/29912203106)                  | erneut `-project` abgelehnt.                                                              | Gleiche CLI-Inkompatibilität.                                                                  |
| 10:45           | [PR #735](https://github.com/smart-village-solutions/sva-studio/pull/735)                                          | `--project` entfernt.                                                                     | Nächste Inkompatibilität wurde erst im echten Lauf sichtbar.                                   |
| 10:50           | [Run 29913423088](https://github.com/smart-village-solutions/sva-studio/actions/runs/29913423088)                  | `flag provided but not defined: -wait`                                                    | Quantum-CLI 3.2.1 unterstützt beim Stack-Deploy kein `--wait`.                                 |
| 11:16           | [PR #736](https://github.com/smart-village-solutions/sva-studio/pull/736)                                          | CLI auf 3.2.1 gepinnt; Datei-Deploy plus Polling eingeführt.                              | Die CLI-Schnittstelle ist nun reproduzierbar, aber der Payload noch nicht kompatibel.          |
| 11:17           | [Run 29915118126](https://github.com/smart-village-solutions/sva-studio/actions/runs/29915118126)                  | Stack-Deploy erreicht die API, dann `Services.bootstrap.command must be a string`.        | Der Bootstrap-Stack wurde direkt aus Compose-JSON ausgeschnitten und enthielt `command: null`. |
| offen           | [PR #738](https://github.com/smart-village-solutions/sva-studio/pull/738)                                          | Bootstrap-Stack wird vor dem Ausschneiden mit dem vorhandenen Quantum-Renderer bereinigt. | Noch nicht in der Zielumgebung ausgeführt.                                                     |

## Technische Einordnung

### 1. Lokale und CI-CLI waren nicht derselbe Vertrag

Die lokale CLI zeigte eine neuere Schnittstelle mit `--project` und `--wait`. Die GitHub Action `hostwithquantum/setup-quantum-cli@v2.0.0` löste zur Laufzeit dagegen Quantum-CLI 3.2.1 auf. Diese Version behandelt `stacks create` als Alias für `stacks deploy` und akzeptiert nur den Datei-Parameter `--file` bzw. `-f`; sie kennt weder `--project` noch `--wait`.

PR #736 behebt die Reproduzierbarkeit, indem die CI-Version auf 3.2.1 gepinnt wird. Das ist notwendig, aber keine vollständige End-to-End-Absicherung.

### 2. Der Bootstrap hatte einen abweichenden Render-Pfad

Der reguläre Promote-Deploy führt nach `docker compose … config --format json` den vorhandenen Renderer `scripts/ci/render-quantum-stack.ts` aus. Dieser entfernt Compose-Nullwerte und normalisiert Quantum-inkompatible Werte.

Der Bootstrap-Pfad schnitt dagegen den `bootstrap`-Service direkt aus dem Compose-JSON heraus. Dadurch blieb `command: null` im resultierenden Stack. Quantum 3.2.1 weist diesen Payload serverseitig mit HTTP 500 zurück. Der Fehler trat also vor Container-Erstellung auf; ein Exit-Code der Bootstrap-Anwendung liegt noch nicht vor.

PR #738 vereinheitlicht diese beiden Pfade und ergänzt einen Regressionstest für das Entfernen von Nullwerten.

### 3. Die CI-CLI besitzt keinen passenden Offline-Validierungsbefehl

Die gegen die echte Linux-Binärdatei geprüfte Quantum-CLI 3.2.1 liefert für `quantum-cli validate --help` keinen Befehl. Ein CLI-nativer Dry-Run für diesen temporären Stack existiert damit in dieser Version nicht. Der erste vollständige Kompatibilitätscheck ist derzeit der mutierende Create/Deploy-Aufruf gegen Dev.

### 4. Es fehlt ein prüfbarer Vertrag für den abgeleiteten Job-Stack

Der Bootstrap-Stack wird dynamisch aus mehreren Inputs gebildet:

1. Compose-Basisdatei,
2. Dev-Overlay,
3. gerenderte Umgebungsvariablen,
4. Quantum-Normalisierung,
5. `jq`-Reduktion auf einen Service und ein Netzwerk.

Bis PR #738 wurde diese resultierende Datei nicht als eigener Vertrag getestet. Die bisherige Unit-Test-Abdeckung testete den Renderer isoliert, nicht den vollständigen Bootstrap-Payload.

## Warum weitere kleine PRs kein ausreichendes Vorgehen sind

Die Fehlerkette zeigt eine gemeinsame Lücke, nicht vier unabhängige Tippfehler:

- Die Runtime-Abhängigkeit wurde erst nach dem ersten echten Fehler versionsfest gemacht.
- Der temporäre Job-Payload hat einen anderen Erzeugungspfad als der reguläre Stack.
- Die Pipeline liefert bei fehlendem Task oder API-Fehlern nur indirekte Evidenz.
- Jede neue Annahme wurde erst in der Dev-Umgebung falsifiziert.

Deshalb darf PR #738 nicht als Anlass dienen, sofort wieder eine Folgeänderung zu vermuten. Zuerst muss der aktuelle Hypothesentest sauber durchgeführt und vollständig ausgewertet werden.

## Stop-/Go-Kriterien für den nächsten Lauf

### Go: PR #738 mergen und genau einen kontrollierten Lauf starten

Voraussetzungen:

- Alle verpflichtenden PR-Gates von #738 sind grün.
- Der Merge-Commit ist auf `main` verfügbar.
- Als Image wird ein bereits gebautes, unveränderliches Dev-Image verwendet.
- Der Lauf verwendet `environment=dev`, `migration_mode=assert-none` und `bootstrap_mode=run`.

Erfolg ist erst gegeben, wenn alle folgenden Punkte erfüllt sind:

1. Quantum akzeptiert den temporären Stack ohne API-Validierungsfehler.
2. Der temporäre `bootstrap`-Task erscheint auf dem Endpoint `sva`.
3. Der Task beendet sich mit Exit-Code `0`.
4. Der Cleanup entfernt nur den temporären Job-Stack.
5. Der Hauptstack `studio-dev` bleibt mit `app` und `provisioner` auf `1/1` verfügbar.
6. Danach folgt ein fachlicher Smoke-Test der vorgesehenen Tenant-/MCP-Reparatur.

### Stop: Kein weiterer Workflow-PR ohne neue Evidenz

Folgende Ergebnisse sind keine Grundlage für einen sofortigen Folge-PR:

- API- oder Stack-Schemafehler nach dem Render-Schritt,
- fehlender Task trotz erfolgreichem Stack-Deploy,
- Exit-Code ungleich `0` aus `bootstrap`,
- Timeout des Pollings,
- abweichende Zielnetzwerke, Images oder Services.

In jedem dieser Fälle sind zuerst das erzeugte, secrets-bereinigte Stack-Artefakt, der temporäre Task-Status und die Bootstrap-Containerlogs zu sichern. Erst dann wird entschieden, ob die Ursache im Renderer, dem Job-Container, der Datenbank, Keycloak oder dem Tenant-Zustand liegt.

## Empfohlene nachhaltige Absicherung nach dem kontrollierten Lauf

Diese Maßnahmen sind nicht Voraussetzung für den ersten Test von PR #738, sollten aber vor einer breiteren Nutzung des Bootstrap-Modus geplant werden:

1. Einen testbaren Builder für den temporären Bootstrap-Stack aus dem Inline-Workflow herausziehen und mit einer vollständigen Fixture testen. Der Test soll insbesondere `null`-Werte, Netzwerknamen, Environment-Overrides, Image-Referenz und Restart-Policy prüfen.
2. Das generierte Bootstrap-Stack-Artefakt als vertrauliches CI-Artefakt oder mindestens als strukturell redigierte Diagnoseausgabe sichern. Secrets dürfen nicht in Logs oder Artefakte gelangen.
3. Den Poller mit klaren Zuständen ausstatten: `stack_created`, `task_seen`, `task_running`, `task_exited`, `timeout`. Der aktuelle Loop liefert nur den Endzustand.
4. Die verwendete Quantum-CLI-Version zentral als Runtime-Vertrag dokumentieren und nicht erneut zwischen lokaler Operator-CLI und CI auseinanderlaufen lassen.
5. Für Dev einen expliziten End-to-End-Nachweis definieren: Bootstrap erfolgreich, anschließend Tenant per MCP anlegen oder reparieren, dann UI- und OIDC-Smoketest.

## Entscheidung

Die sachlich vertretbare nächste Aktion ist **nicht** ein weiterer spekulativer Workflow-Fix, sondern ein kontrollierter E2E-Lauf von PR #738 nach grünen Gates. Erst dessen Ergebnis entscheidet, ob wir einen Infrastruktur-/Payload-Fehler oder erstmals einen fachlichen Bootstrap-Fehler untersuchen müssen.
