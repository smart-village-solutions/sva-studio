## 0. Gemeinsamer Start- und Wiederaufnahmevertrag

- [x] 0.1 In einem separaten Worktree vom aktuellen `origin/main` beide genehmigten OpenSpec-Changes bereitstellen, `git status`, Base-SHA und Worktree-Inventar prüfen und `openspec validate harden-studio-promote-contract --strict` sowie `openspec validate accelerate-pr-failure-feedback --strict` erfolgreich ausführen.
- [x] 0.2 Vor neuer Implementierung die vorhandenen `[x]`- und `[ ]`-Einträge dieses Changes read-only gegen den aktuellen Code, Tests und gegebenenfalls Live-Evidenz abgleichen; nur nachgewiesen falsche Taskzustände korrigieren und keine historische Checkbox als Beweis behandeln.
- [x] 0.3 Als ersten lieferbaren Block ausschließlich das generische Promote-Evidenzfundament aus 5.1, 5.2, 5.3 und 5.5 implementieren beziehungsweise vervollständigen; keine App-E2E-Trigger, keine E2E-Scope-Logik und keine E2E-spezifische Promote-Entscheidung hinzufügen.
- [x] 0.4 H1 erst abschließen, wenn 5.1, 5.2, 5.3, 5.5 und der kleinste relevante Gate-Pfad aus 7.6 grün sind, beide OpenSpecs strikt validieren und exakter HEAD, Gates sowie der freigegebene nächste Block `accelerate-pr-failure-feedback` 5.1 bis 5.4 im kanonischen Checkpoint-Protokoll dieses Changes dokumentiert sind.

**Wiederaufnahme:** Es ist immer nur ein Block aktiv. Ein teilweise bearbeiteter Task bleibt unchecked. Nach einer Unterbrechung zuerst `git status`, aktuellen Diff, HEAD und beide OpenSpec-Validierungen prüfen; dann beim ersten unchecked Task des aktiven Blocks fortsetzen und vorhandene Änderungen gegen dessen vollständigen Text verifizieren.

### Kanonisches Checkpoint-Protokoll

- **H1 – Promote-Evidenzfundament:** `completed`; Implementierungs-HEAD: `1bf51738b5060e95dcdf7d75ddb5deeea0e39a69`; Gates: `tooling-testing:test:unit` mit zehn expliziten Promote- und Smoke-Vertragstestdateien (176 Tests), zusätzlicher gezielter Smoke-Nachlauf (25 Tests), `pnpm exec tsc -p tsconfig.scripts.json --noEmit`, `pnpm nx run tooling-testing:lint`, YAML-Parse, `pnpm check:file-placement`, Diff-Check sowie beide strikten OpenSpec-Validierungen grün; nächster Block: `accelerate-pr-failure-feedback` 5.1 bis 5.4 freigegeben.
- **A1 – Main-E2E-Producer:** `completed`; Implementierungs-HEAD: `c639dcf48e5afb04e08eb3bcccd39789b2d7c978`; Gates und Scope sind im kanonischen Checkpoint von `accelerate-pr-failure-feedback` dokumentiert.
- **A2 – Staging-Consumer:** `completed`; integrierter Implementierungs-HEAD: `b536b613f2874370e282cfec89279387cfb88f00` (Merge von `origin/main` `5652f4a1ea6d4225d8d4f5c5d6385feb17c20e42`); der Consumer erweitert den H1-Vertrag um die separat blockierbare Phase `main-e2e-evidence` und eine strikt geparste allowlistete Main-E2E-Referenz, persistiert keine freie Diagnose und kann v2-Staging-Parität an Attestation plus Source-SHA binden. Ohne explizites `MAIN_E2E_GATE=shadow|enforce` bleibt der Schritt deaktiviert; Disabled und Shadow akzeptieren weiterhin die bestehende Legacy-Parität, erst Enforce verlangt v2. Die Main-Integration erhält zusätzlich die Worker-Datenbank-Secret-, Injection- und Readiness-Verträge und bindet beide Worker-Secret-Schritte an denselben H1-Evidenzvertrag. Gates: `tooling-testing:test:unit` mit fünf expliziten E2E-/Promote-/Workflow-Vertragstestdateien (119 Tests), fünf expliziten Worker-/Readiness-Vertragstestdateien (26 Tests) und dem isolierten Repro zweier PR-fremder Timeout-Dateien (19 Tests), `pnpm exec tsc -p tsconfig.scripts.json --noEmit`, `pnpm nx run tooling-testing:lint`, Prettier-Check, YAML-Parse, `pnpm check:file-placement`, Diff-Check sowie beide strikten OpenSpec-Validierungen grün. `pnpm test:pr` wurde im Coverage-Teil nach zwei nicht reproduzierbaren 5-Sekunden-Lasttimeouts abgebrochen; 90 `tooling-testing`-Dateien und 827 Tests waren dort bereits grün, der isolierte Repro war anschließend 19 von 19 grün. Der Gesamtgate-Lauf wird nicht als grün behauptet.
- **A3 – Shadow und Aktivierung:** `completed`; aktivierter Main-HEAD: `ff4421529aacc7f45440de4c121c4e25e2d34b37`; App-Digest: `sha256:341bb83b9cc607e16bd3504e5324a52fbe3acb68c241bd6146f83d6549cab4b0`; Shadow-Run `32204167096` und Enforce-Run `32204423882` belegten dieselbe kanonische Main-E2E-Attestation aus Run `32203311854`, v2-Staging-Parität, erfolgreiche Backups sowie grüne Konvergenz-, Smoke- und Digest-Gates. Production wurde nicht verändert. Details und Folgeblock stehen im kanonischen Checkpoint von `accelerate-pr-failure-feedback`.
- **H2 – Laufzeitkonvergenz und Recovery-Evidenz:** `staging-rollout-complete, production pending`; Implementierungs-HEAD: `1f9e719aa750329e10f086c9668ae1501226880a`; aktivierter Main-HEAD: `d1496de2e9aa34cb06650d925832da890ca239df`; App-Digest: `sha256:e2cdda053983ae0f18a8c1f9717f7dfdaf4e08cc31b7c3af097277ea7f489c99`. Dev-Promote `32211625312` belegte Candidate, Deploy, Konvergenz, Smoke und Digest grün. Der Staging-Shadow-Promote `32212414535` belegte Candidate und Backup-Capability jeweils `passed, blocking:false`, beide verifizierten Datenbank-Backups, Bootstrap/Postconditions, Main-E2E-Run `32211625229`, Deploy, Konvergenz, Smoke, Digest und v2-Parität. Nach Readback von `CANDIDATE_PREFLIGHT_GATE=enforce` und `BACKUP_CAPABILITY_GATE=enforce` bestätigte Same-Digest-Promote `32212677551` beide Gates `passed, blocking:true` sowie dieselbe vollständige Backup-, Postflight- und v2-Paritätskette. Staging läuft mit einem Task, Root-`live`/`ready` und Tenant-`live` liefern HTTP 200. Production blieb unverändert auf `sha256:155ec5c7b1b7d9c93b9c81002c72826f51a6ef6af49f4d5824e9111873da35c2`; kein Production-Gate und kein Production-Deploy wurden verändert. Nächster Block: die offenen Recovery-Verträge 2.5, 3.3 und 5.4; Production-Aktivierung 6.4 bis 6.6 bleibt ausdrücklich gesperrt.
- **H3 – Recovery- und Live-Revision-Vertrag:** `completed`; Implementierungs-HEAD: `dcf876003eb031232e28ae9db1549815cdc54e0d`; Recovery bleibt im geschützten `Promote`-Workflow, bindet den vorherigen Live-Digest an die gleichzeitig inspizierte Service-Label-Revision `sva.config.revision` und stoppt vor Backup oder Mutation, wenn dieses Rollback-Paar fehlt oder ungültig ist. Same-Digest-Recovery erzwingt weiterhin exakte Staging-Parität und attestiert ausschließlich eine dokumentierte Ursache oder den allowlisteten Code `PROMOTE_SWARM_CONVERGENCE_TIMEOUT`; freie Gründe und Remote-Fehler gelangen nicht in JSON, Summary, Annotation oder CLI-Stderr. Gates: gezielte `tooling-testing:test:unit`-Suite mit elf Recovery-, Config-, Promote-, Swarm- und Workflow-Vertragstestdateien vor dem Complexity-Split (139 Tests) grün; nach dem vertragserhaltenden Split waren die vier direkt betroffenen Dateien mit 73 Tests grün. Der abschließende Gesamtnachlauf bestätigte 139 funktionale Tests und scheiterte ausschließlich im neu ergänzten CLI-Test an einer vorangestellten Node-Modulwarnung; derselbe betroffene Testpfad wurde danach isoliert mit zwölf Tests grün nachgewiesen. Außerdem `pnpm exec tsc -p tsconfig.scripts.json --noEmit`, `pnpm nx run tooling-testing:lint`, `pnpm complexity-gate`, YAML-Parse, Prettier-Check, `pnpm check:file-placement`, Diff-Check sowie beide strikten OpenSpec-Validierungen grün. Es erfolgte keine Environment-Änderung und keine Production-Mutation. Nächster Schritt ist unabhängiges Review und Integration; Production-Shadow beziehungsweise Aktivierung aus 6.4 bis 6.6 bleibt ohne neue Freigabe ausdrücklich gesperrt.

Dieses Protokoll wird nur beim Abschluss eines Blocks aktualisiert. Es muss dessen exakten HEAD, die tatsächlich ausgeführten Gates, beide strikten OpenSpec-Validierungen und den explizit freigegebenen Folgeblock enthalten. `pending` oder `blocked` ist kein Implementierungsnachweis.

## 1. Config-Vertrag, Fehlercodes und Shadow-Modus

- [x] 1.1 Getrackte nicht-sensitive Remote-Profile für Dev, Staging und Production sowie eine typsichere Schlüsselklassifikation anlegen.
- [x] 1.2 Deterministischen Builder für Remote-Profil und kompaktes geschütztes Override-Bundle implementieren; `*.local.vars` technisch ablehnen.
- [x] 1.3 Pflichtwerte, Duplikate, unbekannte Schlüssel, Platzhalter, Werttypen und Secret-Wert-/Referenzsemantik validieren.
- [x] 1.4 Gemeinsamen strukturierten Ergebnis- und Fehlercodevertrag mit Phase, Code, Retryklassifikation und `nextAction` implementieren.
- [x] 1.5 Redigierte Äquivalenzprüfung zwischen bestehendem Renderpfad und neuem Builder ergänzen, ohne Secret-Werte, Hashes oder Längen zu verarbeiten.
- [x] 1.6 Builder zunächst ausschließlich im Shadow-Modus ausführen; Environment-Secrets und Deploy-Ausgabe bleiben unverändert.
- [x] 1.7 Unit- und Workflow-Vertragstests für Merge, Klassifikation, Redaction, Fehlercodes und Shadow-Abweichungen ergänzen.

## 2. Candidate-Preflight und Promote-Modi

- [x] 2.1 Statischen Preflight nach Image-/Git-Validierung und vor der ersten Remote-Mutation integrieren.
- [x] 2.2 Isolierten read-only Candidate-One-shot mit minimalen Berechtigungen und terminalem Cleanup implementieren.
- [x] 2.3 Candidate-Prüfungen für Runtime-Profil, externe Secret-Referenzen, Registry-Lesbarkeit, Release-Tenant-Scope und Entschlüsselbarkeit aktiver Tenant-Secrets ergänzen.
- [x] 2.4 `promote_mode=standard|recovery` mit `standard` als Default ergänzen.
- [x] 2.5 Recovery nur mit nicht leerem Grund, erneuter Environment-Freigabe, vorherigem Live-Digest und unveränderten Backup-, Paritäts- und Post-Deploy-Gates zulassen.
- [x] 2.6 Tests für unvollständige Config, verbotene lokale Quelle, falschen Schlüsselbund, fehlende Secret-Referenz, unzulässige Candidate-Mutation und Recovery ohne Grund ergänzen.

## 3. Digest-Parität und Backup-Agent-Kompatibilität

- [x] 3.1 Production-Paritätsgate bei jedem Wechsel des Live-Digests ausführen, unabhängig von Migration- und Bootstrap-Modi.
- [x] 3.2 Exakt denselben erfolgreichen Staging-Image-Digest verlangen; Git-Grenzen weiterhin separat über den Imagevertrag prüfen.
- [x] 3.3 Konvergenz-Retries mit bereits live laufendem Zieldigest anhand strukturierter Fehlercodes und dokumentierter Ursache klassifizieren.
- [x] 3.4 Geschützten read-only Backup-Capability-Endpoint für Protokollversion, Agent-Revision, Datenbankziele, Ergebnisfelder und Waste-Inventar-Unterstützung implementieren.
- [x] 3.5 Capability-Prüfung vor dem ersten Backup-Auftrag integrieren und Producer-vor-Consumer-Aktivierung erzwingen.
- [x] 3.6 Tests für App-only-Promotion, fehlende oder falsche Staging-Evidenz, kompatiblen und inkompatiblen Agenten sowie unbekannte Protokollversion ergänzen.

## 4. Swarm-Konvergenz und externer Smoke

- [x] 4.1 Nach dem Deploy auf erfolgreichen terminalen Swarm-Service- und Task-Zustand warten.
- [x] 4.2 Erst danach externes HTTP-Warmup für Root-, Health-, IAM- und Tenant-Probes starten.
- [x] 4.3 Ausschließlich 404, 502, 503, 504, Timeout und Gateway als retryfähige Infrastrukturzustände klassifizieren.
- [x] 4.4 Realm-, Callback-, Tenant-Scope-, Secret-, Digest- und Unknown-Host-Fehler sofort blockierend halten.
- [x] 4.5 Production-Readiness am Ende ausschließlich mit HTTP 200 bestehen lassen.
- [x] 4.6 Retryversuche aggregiert loggen und terminale Fehler mit stabilen Codes und konkreter nächster Aktion ausgeben.
- [x] 4.7 Tests für vollständige Router-Lücke mit späterem Erfolg, dauerhaften 404, Swarm-Timeout, Readiness 503, falsches Realm, falschen Callback und offenen Unknown Host ergänzen.

## 5. Evidenz und minimaler Recovery-Vertrag

- [x] 5.1 Redigierte Evidenz für vorherigen und neuen Digest, Git-Grenzen, nicht-sensitive Config-Revision, externe Secret-Referenzen, Agent-Vertrag und Gate-Ergebnisse ergänzen.
- [x] 5.2 GitHub-Annotation, Step-Summary und JSON-Artefakt auf denselben Fehlercodevertrag ausrichten.
- [x] 5.3 Secret-Werte, Hashes, Wertlängen, Environment-Dumps, unredigierte Remote-Logs und PII durch Tests aus allen Evidenzpfaden ausschließen.
- [x] 5.4 App-Rollback-Vertrag auf vorherigen Digest plus versionierte nicht-sensitive Config-Revision begrenzen; inkompatible Secret-Rotation als separaten Planungsfall dokumentieren.
- [x] 5.5 Unbekannte interne Fehler redigiert als `PROMOTE_INTERNAL_ERROR` erfassen.

## 6. Gestufte Aktivierung

- [ ] 6.1 Shadow-Äquivalenz für Dev und Staging ohne Remote-Konfigurationsmutation nachweisen.
- [x] 6.2 Dev autoritativ auf den neuen Builder umstellen und vollständigen Promote mit neuen Evidenzen verifizieren.
- [x] 6.3 Staging-Builder, Candidate-One-shot, Agent-Capability-Gate und Konvergenz blockierend aktivieren und erfolgreich promoten.
- [ ] 6.4 Production-Shadow-Ergebnis prüfen und Abweichungen vor jeder autoritativen Umschaltung beheben.
- [ ] 6.5 Production erst nach erfolgreichem Dev-/Staging-Nachweis über das geschützte Environment aktivieren.
- [ ] 6.6 Production unabhängig auf Root, `health/live`, `health/ready`, Release-Tenant-Realm, Callback-Host, Unknown-Host-Fail-closed und Live-Digest prüfen.

## 7. Dokumentation und Abschluss

- [x] 7.1 Kanonischen Rollout-Leitfaden um Builder, Shadow-Modus, Candidate-Preflight, Promote-Modi, Agent-Capabilities, Konvergenz und Fehlercodes ergänzen.
- [x] 7.2 Runtime-Profil- und Swarm-Runbooks so aktualisieren, dass lokale Override-Dateien keine Remote-Quelle sind und keine konkurrierenden Deploypfade entstehen.
- [x] 7.3 Arc42-Abschnitte 06, 07, 08, 10 und 11 um Config-Grenze, Preflight, Observability, Konvergenz und Recovery fortschreiben.
- [x] 7.4 Rollout-Operator und Review-Governance um Shadow-Nachweis, strukturierte Fehlercodes und Producer-vor-Consumer-Regel ergänzen.
- [x] 7.5 Redigierten Learning-Report unter `docs/reports/` mit Ursachen, Auswirkungen, Recovery und Prävention erstellen.
- [ ] 7.6 Kleinste relevante Unit-, Type-, Workflow-, File-Placement- und Server-Runtime-Gates nach jedem Block ausführen.
- [ ] 7.7 OpenSpec strikt validieren und Tasks erst nach tatsächlichem Stufen- und Live-Nachweis abschließen.
