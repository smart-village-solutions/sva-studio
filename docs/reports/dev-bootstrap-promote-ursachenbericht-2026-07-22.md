# Ursachenbericht: Dev-Bootstrap über den Promote-Workflow

Stand: 22.07.2026

## Kurzfassung

Der Dev-Server ist als laufender App-Stack gesund, der dedizierte Bootstrap wurde aber noch **kein einziges Mal erfolgreich** über den neuen CI-Pfad ausgeführt. Die bisherigen Fehlschläge sind keine fachlichen Bootstrap-Fehler, sondern nacheinander aufgetretene Inkompatibilitäten an der Grenze zwischen GitHub Actions, Quantum-CLI 3.2.1 und der von Docker Compose erzeugten Stack-Datei.

Der aktuelle Fix in PR [#738](https://github.com/smart-village-solutions/sva-studio/pull/738) adressiert die bislang letzte nachgewiesene Ursache: Der temporäre Bootstrap-Stack übersprang den vorhandenen Quantum-Renderer und enthielt deshalb `bootstrap.command: null`. Quantum lehnt diesen Wert ab.

Ein genauer Strukturvergleich mit dem am 21.07.2026 erfolgreich gelaufenen Dev-Job-Stack `studio-dev-bootstrap-mcp-20260721` bestätigt den Fix: Die fehlgeschlagene CI-Datei enthält ausdrücklich das Feld `"command": null`; im erfolgreichen Stack fehlt dieses Feld. Nach dem Renderer aus PR #738 ist die erzeugte Datei – abgesehen von Image-Referenz und Laufkennung – strukturell gleich aufgebaut wie die erfolgreiche Datei.

Ein weiterer Merge und ein erneuter Lauf sind erst dann eine belastbare Verifikation, wenn PR #738 grün ist und der Lauf nachweislich den Bootstrap-Task startet, dessen terminalen Exit-Code ausliest und anschließend den App-Stack prüft. Bis dahin ist nicht belegt, dass die fachliche Bootstrap-Logik oder die Tenant-Reparatur auf Dev erfolgreich ist.

Zum Berichtszeitpunkt sind alle erforderlichen GitHub-Gates von PR #738 grün; der PR ist offen und merge-bereit. Diese Gates belegen die Code- und Workflowqualität, **nicht** die Kompatibilität mit der Quantum-API oder eine erfolgreiche Bootstrap-Ausführung. Diese Unterscheidung ist für die nächste Entscheidung wesentlich.

## Auftrag, Geltungsbereich und Nicht-Ziele

Der Bericht beantwortet ausschließlich, ob der Dev-Bootstrap-Pfad technisch belastbar genug ist, um danach Tenant-Operationen per MCP zu validieren. Er trennt bewusst zwischen:

- dem dauerhaft laufenden App-Stack `studio-dev`,
- dem temporären Bootstrap-Job-Stack,
- der fachlichen Bootstrap-Anwendung im Container,
- der anschließenden Tenant- und MCP-Funktion.

Nicht Gegenstand dieses Berichts sind eine Produktionsfreigabe, eine Änderung von Tenant-Daten, die Löschung bestehender Tenants oder ein allgemeiner Wechsel der Quantum-Plattform. Der Bericht ist eine interne Arbeitsgrundlage und kein Freigabedokument.

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

## Beweisstand: gesichert, widerlegt und offen

| Aussage                                                                      | Status                        | Grundlage                                                                           |
| ---------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------- |
| GitHub Actions kann den Endpoint `sva` authentifiziert ansprechen.           | gesichert                     | Die fehlgeschlagenen Läufe erreichen die Quantum-API und starten den Stack-Deploy.  |
| Die CI verwendet reproduzierbar Quantum-CLI 3.2.1.                           | gesichert                     | PR #736 pinnt die Version; der reale Lauf bestätigte deren Flag-Schnittstelle.      |
| Der reguläre `studio-dev`-Stack ist verfügbar.                               | gesichert                     | `app`, `provisioner`, `postgres` und `redis` sind mit `1/1` laufend.                |
| Der Bootstrap-Stack wurde von Quantum akzeptiert und ein Container angelegt. | widerlegt für Run 29915118126 | Die API wies die Stack-Datei vor Container-Erstellung wegen `command: null` zurück. |
| PR #738 entfernt diesen konkreten ungültigen Wert.                           | lokal gesichert               | Der genaue Vergleich mit dem erfolgreichen Dev-Job bestätigt die gleiche Struktur.  |
| Quantum akzeptiert die von PR #738 erzeugte Bootstrap-Stack-Datei.           | offen                         | Noch kein Lauf gegen den Endpoint mit dem Merge-Commit von #738.                    |
| Die Bootstrap-Anwendung selbst kann erfolgreich arbeiten.                    | offen                         | Bisher gibt es keinen Bootstrap-Containerlauf und keinen Anwendungs-Exit-Code.      |
| Ein vorhandener Tenant kann per MCP vollständig repariert werden.            | offen                         | Setzt den erfolgreichen Bootstrap- und anschließenden MCP-Nachweis voraus.          |

Diese Tabelle verhindert, dass ein grüner PR-Check, ein laufender App-Service oder ein erfolgreicher Image-Push fälschlich als Nachweis für einen erfolgreichen Bootstrap interpretiert wird.

## Chronologie und belegte Ursachen

| Zeitpunkt (UTC) | Lauf / Änderung                                                                                                    | Beobachtung                                                                               | Ursache                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 10:06           | [PR #733](https://github.com/smart-village-solutions/sva-studio/pull/733)                                          | Bootstrap-Gate und One-shot-Ausführung eingeführt.                                        | Grundlage geschaffen, aber gegen lokale statt gegen CI-CLI-Syntax entwickelt.                  |
| 10:14–10:16     | [Runs 29911152997 und 29911177540](https://github.com/smart-village-solutions/sva-studio/actions/runs/29911152997) | `flag provided but not defined: -project`                                                 | Die in Actions installierte Quantum-CLI kannte `--project` nicht.                              |
| 10:20           | [PR #734](https://github.com/smart-village-solutions/sva-studio/pull/734)                                          | Wechsel auf `stacks create`.                                                              | Der Aufruf enthielt weiterhin das nicht unterstützte Flag.                                     |
| 10:30           | [Run 29912203106](https://github.com/smart-village-solutions/sva-studio/actions/runs/29912203106)                  | erneut `-project` abgelehnt.                                                              | Gleiche CLI-Inkompatibilität.                                                                  |
| 10:45           | [PR #735](https://github.com/smart-village-solutions/sva-studio/pull/735)                                          | `--project` entfernt.                                                                     | Nächste Inkompatibilität wurde erst im echten Lauf sichtbar.                                   |
| 10:50           | [Run 29913423088](https://github.com/smart-village-solutions/sva-studio/actions/runs/29913423088)                  | `flag provided but not defined: -wait`                                                    | Quantum-CLI 3.2.1 unterstützt beim Stack-Deploy kein `--wait`.                                 |
| 11:16           | [PR #736](https://github.com/smart-village-solutions/sva-studio/pull/736)                                          | CLI auf 3.2.1 gepinnt; Datei-Deploy plus Polling eingeführt.                              | Die CLI-Schnittstelle ist nun reproduzierbar, aber die Stack-Datei noch nicht kompatibel.      |
| 11:17           | [Run 29915118126](https://github.com/smart-village-solutions/sva-studio/actions/runs/29915118126)                  | Stack-Deploy erreicht die API, dann `Services.bootstrap.command must be a string`.        | Der Bootstrap-Stack wurde direkt aus Compose-JSON ausgeschnitten und enthielt `command: null`. |
| offen           | [PR #738](https://github.com/smart-village-solutions/sva-studio/pull/738)                                          | Bootstrap-Stack wird vor dem Ausschneiden mit dem vorhandenen Quantum-Renderer bereinigt. | Noch nicht in der Zielumgebung ausgeführt.                                                     |

## Technische Einordnung

## Betriebsvertrag des neuen Bootstrap-Pfads

Dieser Abschnitt beantwortet ausdrücklich Zweck, Grenzen und Auslösung des neuen Pfads. Er ist für den Dev-Promote-Pfad verbindlich; der produktionsnahe `studio`-Release bleibt beim kanonischen lokalen Operator-Ablauf `env:release:studio:local` mit dessen eigenen Freigaben.

### Welches konkrete Problem löst ein regulärer Deploy nicht?

Ein regulärer Promote aktualisiert den langlebigen Stack `studio-dev`: insbesondere `app` und `provisioner` sollen danach dauerhaft mit `1/1` laufen. Er löst **keinen einmaligen, vor dem App-Rollout zu bestätigenden Initialisierungs- und Reconcile-Lauf** aus.

Der Bootstrap führt dagegen gezielte, zustandsverändernde Vorbedingungen aus, etwa Schema- und Hostname-Guards, Instance-Reconcile sowie den Abgleich der für Tenant-Login und Provisioning nötigen Daten. Das Ergebnis ist nicht „Service läuft“, sondern ein terminaler Exit-Code. Ein reguläres App-Update kann diesen Nachweis nicht liefern:

- Der Standardpfad verwendet `bootstrap_mode=assert-none`; bei bootstrap-relevanten Änderungen blockiert er, statt stillschweigend einen riskanten Schritt zu überspringen.
- Ein erfolgreiches Rolling Update von `app` oder `provisioner` beweist nur deren Verfügbarkeit, nicht die erfolgreiche Ausführung des Bootstrap-Entrypoints.
- Ohne Bootstrap-Nachweis wäre eine Tenant-/MCP-Reparatur fachlich unsicher, weil die zugrunde liegenden Registry-, Auth- oder Reconcile-Voraussetzungen ungeprüft bleiben.

### Warum wird Bootstrap nicht im bestehenden Stack als One-shot-Service gestartet?

Der Service `bootstrap` ist im Hauptstack bewusst mit `replicas: 0` definiert. Er ist eine Vorlage, kein langlebiger Bestandteil des Sollzustands. Ein temporäres Hochskalieren im bestehenden Stack wäre technisch zwar möglich, architektonisch aber unzulässig:

- Jeder Update des bestehenden Stacks reconciled dessen vollständige Service-Spec. Das würde den One-shot-Job mit dem Rollout von `app`, `provisioner`, Netzwerken, Labels und weiteren langlebigen Services koppeln.
- Der Job benötigt einen eindeutigen Laufkontext (`SVA_BOOTSTRAP_JOB_STACK`) und muss gegen den vorhandenen Zielstack (`SVA_BOOTSTRAP_TARGET_STACK=studio-dev`) arbeiten. Diese Trennung wäre innerhalb desselben Stacks nicht eindeutig und erschwert Audit, Statusabfrage und Cleanup.
- Ein erfolgloser oder hängen gebliebener Job dürfte den Hauptstack weder skalieren noch dessen Live-Spec überschreiben. Genau das erzwingt der eigene temporäre Stack: Er enthält nur `bootstrap`, nutzt ausschließlich das vorhandene interne Overlay-Netz und wird anschließend gezielt entfernt.
- Die Architekturregel verbietet ausdrücklich, dass temporäre `migrate`-/`bootstrap`-Stacks die Live-Spec von `studio_app` ableiten oder mutieren.

Der neue Pfad ist damit nicht „zusätzliche Komplexität für denselben Deploy“, sondern eine Schutzgrenze zwischen kurzlebiger, zustandsverändernder Initialisierung und langlebigem Traffic-Serving.

### Wann darf beziehungsweise muss der neue Pfad verwendet werden?

| Situation                                                                                               | `bootstrap_mode`                     | Entscheidung                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Reiner App-/Dokumentations- oder Workflow-Change ohne Bootstrap-Risikodateien                           | `assert-none`                        | Regulärer Promote ist zulässig, sofern das Gate keine Risiken feststellt.                                                            |
| Bootstrap-, Reconcile-, Instance-Registry-, IAM-, Keycloak- oder Runtime-Konfigurationsänderung auf Dev | `run`                                | Der gehärtete Dev-One-shot-Pfad **muss** vor dem App-Deploy erfolgreich enden.                                                       |
| Expliziter Dev-Reconcile oder vorbereiteter Tenant-/MCP-Reparaturtest                                   | `run`                                | Der Pfad **muss** verwendet werden, weil der fachliche Ausgangszustand nachweisbar hergestellt werden soll.                          |
| `run` für Staging oder Produktion                                                                       | nicht über diesen GitHub-Executor    | Nicht zulässig; dort gelten der lokale Operator-Pfad, Wartungsfenster, Backup-/Rollback-Readiness und die separate Release-Freigabe. |
| Risiko erkannt, aber kein gehärteter Executor verfügbar                                                 | weder impliziter Skip noch Blind-Run | Promote blockiert; der kanonische Operator-Pfad und ein separater Nachweis sind erforderlich.                                        |

`assert-none` bedeutet daher nicht „Bootstrap überspringen“, sondern „das Gate belegt, dass kein Bootstrap-Auslöser im betrachteten Änderungsbereich vorhanden ist“.

### Welche Risiken reduziert der neue Pfad gegenüber einem normalen Promote?

| Risiko eines normalen Promote                                                   | Reduktion durch den temporären Bootstrap-Pfad                                                             |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Bootstrap wird bei riskanten Änderungen implizit ausgelassen.                   | Das Gate blockiert oder erzwingt `run`; der App-Deploy startet erst nach Erfolg.                          |
| Ein Fehler im Job wird mit einem scheinbar erfolgreichen App-Rollout vermischt. | Eigener Stack, eigener Task und terminaler Exit-Code liefern eine getrennte Fehlerklasse.                 |
| Job-Retry oder Cleanup verändert den Live-Stack.                                | Cleanup zielt ausschließlich auf den temporären Job-Stack; `studio-dev` bleibt getrennt.                  |
| Ein Job-Fehler überschreibt Netzwerk-, Ingress- oder App-Service-Specs.         | Der Job-Stack enthält keinen `app`-Service und nutzt nur das bestehende interne Netzwerk.                 |
| Ein unbekannter oder hängen gebliebener Job bleibt unbemerkt.                   | Polling verlangt Task-Sichtbarkeit und einen terminalen Exit-Code innerhalb des definierten Zeitfensters. |
| Der ausgeführte Job ist nicht einer Deploy-Revision zuordenbar.                 | Image-Referenz, Deploy-Revision und Job-Stackname werden pro Lauf gesetzt.                                |

Der Pfad reduziert diese Risiken, eliminiert aber nicht die fachlichen Risiken im Bootstrap selbst. Deshalb bleiben eine erfolgreiche Anwendungsausführung, Nachlauf-Checks und der MCP-Smoke-Test eigene Pflichtbeweise.

### Wer löst den Pfad aus?

Der Auslöser ist kein im App-Container laufender Scheduler und kein impliziter Effekt eines Image-Pushs. Er wird bewusst durch einen autorisierten Operator als `workflow_dispatch` des GitHub-Workflows `Promote` ausgelöst, mit:

```text
environment=dev
bootstrap_mode=run
migration_mode=assert-none
image_ref=<bereits gebautes, unveränderliches Image>
change_base=<Bildbasis>
change_head=<Bildstand>
```

Der automatische Build-Pfad für `main` übergibt dagegen `bootstrap_mode=assert-none`; er darf den One-shot-Job nicht selbstständig starten. Innerhalb des manuellen Promote-Laufs autorisieren und kontrollieren nacheinander:

1. die Eingabe- und Image-Vertragsprüfung,
2. das Bootstrap-Gate anhand des konkreten Änderungsbereichs,
3. der gehärtete Workflow-Executor auf Dev,
4. der Quantum-Endpoint beim Erstellen des temporären Stacks,
5. der Poller anhand des terminalen Task-Exit-Codes.

Erst nach Exit-Code `0` darf derselbe Promote-Lauf den regulären `studio-dev`-Stack deployen. Ein MCP-Client löst diesen Infrastrukturpfad nicht direkt aus und erhält dadurch keine versteckte Berechtigung, den Live-Stack zu verändern.

### 1. Lokale und CI-CLI waren nicht derselbe Vertrag

Die lokale CLI zeigte eine neuere Schnittstelle mit `--project` und `--wait`. Die GitHub Action `hostwithquantum/setup-quantum-cli@v2.0.0` löste zur Laufzeit dagegen Quantum-CLI 3.2.1 auf. Diese Version behandelt `stacks create` als Alias für `stacks deploy` und akzeptiert nur den Datei-Parameter `--file` bzw. `-f`; sie kennt weder `--project` noch `--wait`.

PR #736 behebt die Reproduzierbarkeit, indem die CI-Version auf 3.2.1 gepinnt wird. Das ist notwendig, aber keine vollständige End-to-End-Absicherung.

### 2. Der Bootstrap hatte einen abweichenden Render-Pfad

Der reguläre Promote-Deploy führt nach `docker compose … config --format json` den vorhandenen Renderer `scripts/ci/render-quantum-stack.ts` aus. Dieser entfernt Compose-Nullwerte und normalisiert Quantum-inkompatible Werte.

Der Bootstrap-Pfad schnitt dagegen den `bootstrap`-Service direkt aus dem Compose-JSON heraus. Dadurch blieb `command: null` im resultierenden Stack. Quantum 3.2.1 weist diesen Payload serverseitig mit HTTP 500 zurück. Der Fehler trat also vor Container-Erstellung auf; ein Exit-Code der Bootstrap-Anwendung liegt noch nicht vor.

PR #738 vereinheitlicht diese beiden Pfade und ergänzt einen Regressionstest für das Entfernen von Nullwerten.

Der gespeicherte erfolgreiche Dev-Job-Stack ist hier die Referenz: Er enthält denselben Entrypoint, dieselben 18 Namen von Umgebungsvariablen, dasselbe interne Netzwerk, eine Replik, `restart: none` und dieselben Ressourcenwerte. Der einzige strukturelle Unterschied zur fehlgeschlagenen CI-Datei war das zusätzlich übertragene Feld `command: null`. Nach dem Render-Schritt von PR #738 gibt es keinen verbleibenden Strukturunterschied.

### 3. Die CI-CLI besitzt keinen passenden Offline-Validierungsbefehl

Die gegen die echte Linux-Binärdatei geprüfte Quantum-CLI 3.2.1 liefert für `quantum-cli validate --help` keinen Befehl. Ein CLI-nativer Dry-Run für diesen temporären Stack existiert damit in dieser Version nicht. Der erste vollständige Kompatibilitätscheck ist derzeit der mutierende Create/Deploy-Aufruf gegen Dev.

### 4. Es fehlt ein prüfbarer Vertrag für den abgeleiteten Job-Stack

Der Bootstrap-Stack wird dynamisch aus mehreren Inputs gebildet:

1. Compose-Basisdatei,
2. Dev-Overlay,
3. gerenderte Umgebungsvariablen,
4. Quantum-Normalisierung,
5. `jq`-Reduktion auf einen Service und ein Netzwerk.

Bis PR #738 wurde diese resultierende Datei nicht als eigener Vertrag getestet. Der nachträgliche Vergleich mit dem erfolgreichen Dev-Job liefert nun die fehlende Referenz: PR #738 reproduziert dessen Struktur ohne das von Quantum abgelehnte zusätzliche Feld.

### 5. Der reguläre Promote kann den erforderlichen Einmalschritt nicht ausführen

Der reguläre Deploy rendert den dauerhaften Ziel-Stack und übergibt ihn an `quantum-cli stacks deploy`. Der darin enthaltene Service `bootstrap` ist absichtlich mit `replicas: 0` definiert. Ein normaler Promote aktualisiert damit zwar Image und Konfiguration dieser Service-Vorlage, startet aber keinen Bootstrap-Task und kann folglich weder dessen Ausführung noch dessen Exit-Code belegen.

Das konkrete Problem ist daher nicht, dass der App-Deploy technisch fehlschlägt. Er kann erfolgreich sein und trotzdem den benötigten einmaligen Datenbank-/Registry-Abgleich ausgelassen haben. Wenn das neue Image einen aktualisierten Rollen-, Instanz-, Hostname- oder Bootstrap-Vertrag voraussetzt, würde der neue Runtime-Code anschließend gegen einen nicht abgeglichenen Zustand laufen.

`bootstrap_mode=assert-none` löst dieses Problem bewusst nicht. Der Modus beweist ausschließlich, dass der angegebene Image-Änderungsbereich keine Bootstrap-relevanten Dateien enthält. Sobald das Gate ein entsprechendes Risiko erkennt, blockiert es den App-Deploy, statt den Einmalschritt stillschweigend zu überspringen.

### 6. Der Bootstrap wird nicht im bestehenden Stack hochskaliert

Docker Swarm bietet für einen Stack-Service keinen atomaren Ablauf „einmal starten, terminalen Zustand auswerten und garantiert zum vorherigen Sollzustand zurückkehren“. Ein Bootstrap-Lauf innerhalb von `studio-dev` müsste den deklarativen Service vorübergehend von `replicas: 0` auf `1` setzen und ihn nach Abschluss wieder auf `0` zurückskalieren oder den gesamten Stack erneut deployen.

Dieser Ansatz würde neue Betriebsrisiken erzeugen:

- Der Live-Stack würde bereits vor dem eigentlichen App-Deploy mutiert.
- Ein Abbruch zwischen Hoch- und Herunterskalieren könnte einen falschen dauerhaften Sollzustand hinterlassen.
- Bootstrap-Task sowie App-/Provisioner-Reconcile würden im selben Stack und damit in derselben Fehlerdomäne liegen.
- Ein erneuter Stack-Deploy könnte den Task ersetzen oder die Einmalschritt- und Rollout-Evidenz vermischen.
- Job-Identität, terminaler Exit-Code und Cleanup wären schwerer eindeutig einem einzelnen Promote-Lauf zuzuordnen.

Der neue Dev-Pfad rendert deshalb ausschließlich den Service `bootstrap` in einen temporären Stack `studio-dev-bootstrap-<GitHub-Run-ID>`. Dieser verbindet sich mit dem bestehenden Netzwerk `studio-dev_default`, adressiert die vorhandene Datenbank als `studio-dev_postgres`, läuft mit genau einer Replik und ohne Restart, wird bis zum terminalen Task-Zustand beobachtet und anschließend wieder entfernt. Der Hauptstack bleibt bis zum erfolgreichen Abschluss unverändert.

### 7. Zulässigkeit und Pflicht von `bootstrap_mode=run`

`assert-none` bleibt der Standard und ist bei Änderungen ohne Bootstrap-Risiko die risikoärmere Wahl. Der neue Pfad ist keine allgemeine Alternative für jeden Promote.

Für den aktuellen Workflow gilt:

- `bootstrap_mode=run` ist ausschließlich für `environment=dev` freigegeben.
- Der Modus darf verwendet werden, wenn `image_ref`, `change_base` und `change_head` dasselbe tatsächlich zu promotende Artefakt beschreiben und der Bootstrap-Vertrag dieses Images bewusst gegen die bestehende Dev-Datenbank ausgeführt werden soll.
- Der Modus muss im vereinfachten Dev-Promote gewählt werden, wenn das Gate im angegebenen Änderungsbereich Bootstrap-Risiko erkennt und dieses Image dennoch über diesen Workflow ausgerollt werden soll. Mit `assert-none` bleibt der Lauf dann absichtlich blockiert.
- `run` darf nicht als pauschaler Retry, als Ersatz für eine Migration oder bei unbekanntem Änderungsumfang verwendet werden. Ein erforderlicher Migrationslauf bleibt ein eigenes Gate und ein eigener Betriebsvertrag.
- Für Staging und Produktion ist in diesem GitHub-Promote kein entsprechender One-shot-Executor freigegeben. Dort muss der kanonische Operator-/Releasepfad mit den umgebungsspezifischen Freigaben und Nachweisen verwendet werden.

### 8. Gegenüber einem normalen Promote reduzierte Risiken

Der One-shot-Pfad ist nur dann ein Risikogewinn, wenn das Image tatsächlich einen Bootstrap benötigt. In diesem Fall reduziert er gegenüber einem normalen Promote ohne den erforderlichen Einmalschritt insbesondere:

- das Risiko, neuen App-Code gegen einen veralteten Datenbank-, Rollen-, Instanz- oder Hostname-Sollzustand zu starten;
- das Risiko einer vorübergehenden Skalierung oder eines unbeabsichtigten Reconcile des Bootstrap-Service im Live-Stack;
- das Risiko, `app` oder `provisioner` bereits vor einem nachweislich erfolgreichen Bootstrap zu aktualisieren;
- das Risiko, einen alten oder nicht eindeutig zugeordneten Swarm-Task als Evidenz für den aktuellen Image-Stand zu verwenden;
- das Risiko eines stillen Erfolgs ohne Bootstrap-Task: Fehlender Executor, API-Fehler, fehlender Task, Timeout oder Exit-Code ungleich `0` stoppen den Promote vor dem App-Deploy;
- den Umfang möglicher Seiteneffekte, weil der temporäre Stack nur den Bootstrap-Service enthält und gezielt entfernt wird.

Der Pfad beseitigt nicht das Risiko der Bootstrap-Mutation selbst. Deshalb bleibt `assert-none` ohne Bootstrap-Bedarf der sichere Standard, und der Zielsystemlauf benötigt weiterhin eine nachgelagerte App-, Tenant- und MCP-Verifikation.

### 9. Auslösender Prozess und Verantwortungsgrenze

Der automatische Dev-Promote aus `build.yml` setzt weiterhin `bootstrap_mode=assert-none`. Er entscheidet nicht selbstständig, eine mutierende Bootstrap-Ausführung zu starten.

Auslöser von `bootstrap_mode=run` ist ein berechtigter Operator. Der Operator startet den GitHub-Workflow `Promote` per `workflow_dispatch` mit `environment=dev`, dem exakten Image sowie dem zugehörigen Bereich aus `change_base` und `change_head`. Nach dieser bewussten Auswahl führt der Workflow den temporären Bootstrap-Stack automatisch vor dem normalen Deploy desselben Images aus.

Damit bleiben die Verantwortungen getrennt:

- Der Operator verantwortet Zielumgebung, Image-Identität, Änderungsbereich und die bewusste Wahl des mutierenden Modus.
- Das Gate verantwortet die Risikoerkennung und blockiert unzulässige oder nicht abgesicherte Kombinationen fail-closed.
- Der One-shot-Executor verantwortet isolierten Job-Stack, Task-Beobachtung, Exit-Code-Auswertung und Cleanup.
- Der reguläre Promote aktualisiert den Live-Stack erst nach erfolgreichem Bootstrap.

## Warum weitere kleine PRs kein ausreichendes Vorgehen sind

Die Fehlerkette zeigt eine gemeinsame Lücke, nicht vier unabhängige Tippfehler:

- Die Runtime-Abhängigkeit wurde erst nach dem ersten echten Fehler versionsfest gemacht.
- Der temporäre Job-Payload hat einen anderen Erzeugungspfad als der reguläre Stack.
- Die Pipeline liefert bei fehlendem Task oder API-Fehlern nur indirekte Evidenz.
- Jede neue Annahme wurde erst in der Dev-Umgebung falsifiziert.

Deshalb ist PR #738 nun kein spekulativer Folgefix mehr, sondern eine gegen einen erfolgreichen Dev-Job geprüfte Korrektur. Trotzdem bleibt genau ein kontrollierter E2E-Lauf erforderlich: Nur er bestätigt die Quantum-API-Annahme und die Bootstrap-Anwendung mit dem aktuellen Image.

## Entscheidungsmodell für den kontrollierten E2E-Lauf

Der nächste Lauf prüft genau eine Annahme:

> Die für den Bootstrap erzeugte Stack-Datei entspricht der Struktur eines bereits erfolgreichen Dev-Job-Stacks. Insbesondere enthält sie nicht mehr das zusätzliche Feld `command: null`, das Quantum beim fehlgeschlagenen Lauf abgelehnt hat.

Die Auswertung erfolgt stufenweise. Jede Stufe ist ein eigener Beweis und begrenzt den Suchraum für einen möglichen Fehler.

| Stufe                      | Erwartete Evidenz                         | Bedeutung bei Fehlschlag                   | Zulässiger nächster Untersuchungsschritt                                |
| -------------------------- | ----------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| 1. Workflow-Gate           | `bootstrap_mode=run` wird freigegeben     | Änderungserkennung oder Gate-Konfiguration | Gate-Eingaben und geänderte Dateien prüfen                              |
| 2. Quantum-Deploy          | Kein API-Schemafehler                     | Fehler in der erzeugten Bootstrap-Datei    | Bootstrap-Datei ohne Zugangsdaten mit der API-Fehlermeldung vergleichen |
| 3. Task-Sichtbarkeit       | Temporärer Bootstrap-Task erscheint       | Stack-, Scheduler- oder Netzwerkproblem    | Stack- und Task-Status abfragen                                         |
| 4. Terminaler Task-Zustand | Exit-Code verfügbar                       | Polling oder Container-Laufzeitproblem     | Task-Status und Containerlogs sichern                                   |
| 5. Exit-Code               | `0`                                       | Fachlicher Bootstrap-Fehler                | Bootstrap-Logs, DB-, Keycloak- und Konfigurationszustand untersuchen    |
| 6. Nachlauf                | `studio-dev` weiter `1/1`, MCP-Smoke grün | Seiteneffekt oder fachliche Tenant-Ursache | gezielten Tenant-/MCP-Repair-Test durchführen                           |

Es ist ausdrücklich nicht zulässig, bei einem Fehler in Stufe 2 direkt an der Bootstrap-Anwendung oder an Tenant-Daten zu arbeiten. Ebenso ist bei einem Fehler in Stufe 5 keine weitere Workflow-Syntaxänderung begründet.

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

## Konkrete Artefakte, die beim nächsten Fehler zu sichern sind

Die folgenden Daten müssen vor Cleanup oder vor einem Folge-PR erhoben werden. Sie sind auf Struktur und Metadaten zu beschränken; Zugangsdaten, `.env`-Inhalte, Connection-Strings und Token dürfen weder in Logs noch in CI-Artefakten erscheinen.

1. Quantum-CLI-Version sowie die verwendeten Befehlsargumente.
2. Das bereinigte Bootstrap-Stack-Dokument mit vollständig redigierten Environment-Werten; mindestens Service-Schlüssel, Datentypen, Netzwerke, Image-Referenz und Deploy-Policy müssen erhalten bleiben.
3. Stack-Erstellungsantwort oder vollständige, nicht-sensitive API-Fehlermeldung.
4. Task-Liste des temporären Stack-Namens inklusive Status, Slot, Zeitstempel und Exit-Code.
5. Bootstrap-Containerlogs nur dann, wenn ein Container tatsächlich angelegt wurde.
6. Vergleich des `studio-dev`-Stacks vor und nach dem Lauf: Services, Replikazahl und Image-Referenzen.

Damit ist ein erneuter Lauf auch dann verwertbar, wenn er fehlschlägt: Er liefert eine eindeutig zuordenbare Stufe aus dem Entscheidungsmodell statt nur einen allgemeinen Workflow-Fehler.

## Entscheidung

Die sachlich vertretbare nächste Aktion ist **nicht** ein weiterer spekulativer Workflow-Fix, sondern ein kontrollierter E2E-Lauf von PR #738 nach grünen Gates. Erst dessen Ergebnis entscheidet, ob wir einen Infrastruktur- oder Stack-Datei-Fehler oder erstmals einen fachlichen Bootstrap-Fehler untersuchen müssen.
