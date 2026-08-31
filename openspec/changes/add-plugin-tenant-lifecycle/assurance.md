# System-Assurance-Vertrag für den Plugin-Tenant-Lifecycle

## Zweck und Verbindlichkeit

Dieses Dokument ist der verbindliche System-Assurance-Vertrag für den Change
`add-plugin-tenant-lifecycle`. Es ergänzt Proposal, Design, Delta-Specs sowie
[ADR-056](../../../docs/adr/ADR-056-extension-tiers-und-scopegebundene-plugin-beitraege.md)
und
[ADR-057](../../../docs/adr/ADR-057-generischer-plugin-tenant-lifecycle-und-readiness-gate.md),
ohne deren Architekturentscheidungen zu duplizieren. Die zugehörigen
arc42-Sichten sind insbesondere die
[Lösungsstrategie](../../../docs/architecture/04-solution-strategy.md),
[Bausteinsicht](../../../docs/architecture/05-building-block-view.md),
[Laufzeitsicht](../../../docs/architecture/06-runtime-view.md),
[Verteilungssicht](../../../docs/architecture/07-deployment-view.md), die
[Querschnittskonzepte](../../../docs/architecture/08-cross-cutting-concepts.md),
[Qualitätsanforderungen](../../../docs/architecture/10-quality-requirements.md)
und
[Risiken](../../../docs/architecture/11-risks-and-technical-debt.md).

Die Invarianten und Matrizen gelten für jeden neuen Lifecycle-Beitrag, jede
neue Worker-Lane, jeden neuen Access-Anforderungstyp und jeden neuen
persistenten Status. Eine Umsetzung darf erst als merge-bereit gelten, wenn
jede betroffene Invariante durch ihre führende Evidenzklasse nachgewiesen ist.
Coverage, grüne Gesamt-CI und geschlossene Review-Threads sind nur ergänzende
Signale.

## Begriffe und Zeitbudgets

- **Generation**: Monoton steigender Sollstand eines Plugins in genau einer
  Instanz.
- **Owner-Job**: Der einzige Studio-Job, dessen ID, Operation und Generation
  dem aktiven Claim entsprechen.
- **Wake-up**: Persistenter Graphile-Task mit stabilem, mindestens aus Instanz,
  Plugin, Operation und Generation abgeleitetem Schlüssel.
- **Terminal**: Retry-Klassifikation ohne automatische Wiederholung; kein
  eigener Readiness- oder Jobstatus.
- **Konvergenzzeit**: Zeit ab Wiederverfügbarkeit von Tenant-Datenbank und
  zuständiger Worker-Lane bis zum nächsten deterministischen
  Verarbeitungsversuch. Sie beträgt höchstens 150 Sekunden. Für ein fachlich
  gesetztes `retryAfter` beginnt dieses Budget erst mit dessen Fälligkeit.
- **Diagnosezeit**: Ein nicht konvergierender Zustand muss spätestens nach 120
  Sekunden über Metrik und Alert erkennbar sein. Ein externer Seiteneffekt darf
  länger dauern, muss aber Heartbeat und Fencing fortschreiben.

Kein Recovery-Pfad darf einen neuen HTTP-Request, UI-Polling oder einen
manuellen beziehungsweise ad-hoc ausgelösten Prozessneustart voraussetzen.
Ein autonom begrenzter Worker-Neustart oder kontrolliertes Prozess-Fail-fast
mit orchestriertem Neustart ist zulässig, sofern persistente Arbeit erhalten
bleibt und die unabhängige Supervision den Neustart ohne Request-Traffic
auslöst. UI-Polling ist ausschließlich Beobachter.

## Verbindliche Invarianten

| ID      | Normativer Vertrag                                                                                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Jeder autorisierbare Plugin-Beitrag besitzt eine explizite, vom Host validierte vollständige Access-Anforderung. Fehlende oder widersprüchliche Anforderungen verhindern die Snapshot-Veröffentlichung.           |
| AUTH-02 | Resource-Capabilities werden aus Request und autoritativen Hostdaten abgeleitet. Ein Plugin-Deskriptor darf weder die positive Entscheidung noch ein bestätigendes Capability-Attribut liefern.                   |
| AUTH-03 | Ein Service-Credential darf ausschließlich die ihm ausdrücklich zugeordnete Lifecycle-Operation ausführen. Die separate Lese-Action und die fünf ausführbaren Operationen sind getrennte fully-qualified Actions. |
| LC-01   | Pro `(instanceId, pluginId)` existieren höchstens eine aktive Generation und genau ein ausführbarer Owner-Job.                                                                                                    |
| LC-02   | Ein aktiver Claim existiert nur zusammen mit dauerhaft ausführbarer Arbeit oder einem deterministischen persistenten Recovery-Pfad.                                                                               |
| LC-03   | Jeder nicht terminale Zustand besitzt einen persistenten Wake-up. `pending` ohne Wake-up ist verboten.                                                                                                            |
| LC-04   | Lifecycle-Ledger, Jobstatus und Terminalevent teilen eine Commit-Entscheidung oder eine idempotente, nachweisbar konvergierende Materialisierung. Für diesen Change gilt die gemeinsame Commit-Entscheidung.      |
| LC-05   | Redelivery und veraltete Worker dürfen neuere Generationen oder terminale Zustände nicht überschreiben.                                                                                                           |
| LC-06   | Der aktuelle Manifest-/Lifecycle-Vertrag wird vor historischer Retry- oder Terminalklassifikation bewertet. Drift führt zu `reconcile` oder einem explizit reparierbaren Konflikt.                                |
| TOP-01  | Default- und privilegierte Lane werden anhand der hostvalidierten Jobregistrierung geroutet und erholen sich ohne eingehenden HTTP-Request.                                                                       |
| ACT-01  | Instanzerstellung, Aktivierungsrichtlinie und IAM-Materialisierung liefern entweder einen konsistenten Commit oder einen persistent reparierbaren Zwischenzustand.                                                |
| OBS-01  | Jeder blockierende Zustand ist über sichere Metriken, eine durchgängige Korrelation und ein verlinktes Runbook diagnostizierbar.                                                                                  |

## Zustandsautomaten

### Aktivierung

`missing` bedeutet, dass für `(instanceId, pluginId)` keine materialisierte
Aktivierungszeile existiert. `inactive` und `active` sind effektive Zustände aus
Manifest, Richtlinie und Override. `suspended` ist kein Aktivierungszustand,
sondern ein separater Lifecycle-Access-Zustand.

| Übergang | Von        | Nach       | Owner             | Persistente Felder / Beleg                                                      | Erlaubt, wenn                                                                                                                              | Verboten, wenn                                                  |
| -------- | ---------- | ---------- | ----------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| A-01     | `missing`  | `inactive` | Instance Registry | Richtlinie, Manifest-/Policy-Revision, Herkunft, `effective_active=false`       | Plugin ist kompatibel und `optional` ohne aktivierenden Override                                                                           | Plugin fehlt im hostvalidierten Snapshot oder IAM-Vertrag fehlt |
| A-02     | `missing`  | `active`   | Instance Registry | Richtlinie, Revisionen, Herkunft, `effective_active=true`, IAM-Materialisierung | Richtlinie ist `automatic` oder `required` beziehungsweise `optional` mit explizitem aktivierendem Override; kompletter Snapshot liegt vor | nur Plugin-ID oder Feature-Flag begründet Aktivierung           |
| A-03     | `inactive` | `active`   | Instance Registry | Override/Reconcile-Nachweis und IAM-Grants in derselben scoped Transaktion      | zulässiger manueller Override oder geänderte Richtlinie                                                                                    | `required`- oder Scope-Regel wird umgangen                      |
| A-04     | `active`   | `inactive` | Instance Registry | Deaktivierungs-Override und Grant-Entzug in derselben scoped Transaktion        | `optional` oder `automatic`; Autorisierung und Lock erfolgreich                                                                            | Richtlinie ist `required` oder paralleler Lock wurde verloren   |
| A-05     | `active`   | `active`   | Fleet-Reconcile   | neue Manifest-/Policy-Revision und IAM-Nachweis                                 | Vertrag änderte sich, effektiver Zustand bleibt aktiv                                                                                      | Drift wird ohne Reconcile als unverändert akzeptiert            |
| A-06     | `inactive` | `inactive` | Fleet-Reconcile   | aktuelle Revision und Auditnachweis                                             | idempotenter Reconcile                                                                                                                     | ein Lifecycle-Job wird trotz Inaktivität gestartet              |

Jeder Commit nach `active` erzeugt in derselben Datenbanktransaktion einen
persistenten Lifecycle-Reconcile-Auftrag oder weist bereits valide, aktuelle
Readiness-Evidenz nach. Ein nur speicherinterner Post-Commit-Hook erfüllt
ACT-01 nicht.

### Lifecycle-Ledger und Readiness

Der Lifecycle führt orthogonal `accessState = active | suspended`,
`readinessStatus = pending | ready | degraded | blocked` sowie
`retryKind = retryable | terminal`. `terminal` ist ausschließlich eine
Fehlerklassifikation. Reactivate ist ein Übergang aus `suspended`, kein eigener
persistenter Zustand.

| Übergang | Von                                   | Nach                                                             | Owner                  | Persistente Felder / Beleg                                             | Erlaubt, wenn                                                                                                                                                                                                       | Verboten, wenn                                                           |
| -------- | ------------------------------------- | ---------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| L-01     | keine Evidenz                         | `active/pending`                                                 | Lifecycle-Orchestrator | Operation, Sollgeneration, Owner-Job und Wake-up                       | Plugin effektiv aktiv, Operation deklariert und Jobregistrierung gültig                                                                                                                                             | `pending` wird ohne Job und Wake-up committet                            |
| L-02     | `active/ready` oder `active/degraded` | `active/pending`                                                 | Lifecycle-Orchestrator | erhöhte Sollgeneration, neuer Claim und Wake-up                        | explizites `reconcile`, fälliger Retry oder Vertragsdrift                                                                                                                                                           | ältere Generation ist noch ausführbarer Owner                            |
| L-03     | `active/pending`                      | `active/ready`                                                   | Lifecycle-Korrelation  | abgeschlossene Generation, aktuelle Revision und vollständige Checks   | Job, Claim, Operation, Generation und aktueller Vertrag stimmen überein                                                                                                                                             | Ergebnis fehlt, Check ist fremd/fehlend oder Vertrag driftet             |
| L-04     | `active/pending`                      | `active/degraded`                                                | Lifecycle-Korrelation  | Fehler/optionale Checks; bei Retry zusätzlich `retryAfter` und Wake-up | nur optionale Checks blockieren nicht oder Fehler ist retryable                                                                                                                                                     | Pflichtcheck ist blockiert oder Retry hat keinen Wake-up                 |
| L-05     | `active/pending`                      | `active/blocked`                                                 | Lifecycle-Korrelation  | Fehlercode und terminale oder explizit reparierbare Evidenz            | Pflichtcheck/Vertragsfehler blockiert                                                                                                                                                                               | Blockade wird als zugriffsfähig materialisiert                           |
| L-06     | beliebiges `active/*`                 | `suspended/pending`                                              | Lifecycle-Orchestrator | Operation `suspend`, neue Generation, Claim und Wake-up                | Plugin aktiv und Suspend-Operation deklariert; kein anderer ausführbarer Owner existiert; Claim und Generation werden atomar per CAS gewonnen                                                                       | Suspendierung löscht Identität, Fachdaten oder Audit                     |
| L-07     | `suspended/pending`                   | `suspended/ready`, `suspended/degraded` oder `suspended/blocked` | Lifecycle-Korrelation  | Abschluss-/Fehlerevidenz der Suspend-Generation                        | Fencing stimmt; Zugriff bleibt unabhängig vom Readiness-Ergebnis gesperrt                                                                                                                                           | erfolgreicher Suspend-Abschluss setzt `accessState=active`               |
| L-08     | `suspended/*`                         | `suspended/pending`                                              | Lifecycle-Orchestrator | Operation `reactivate`, neue Generation, Claim und Wake-up             | explizit autorisiert und Operation deklariert; kein anderer ausführbarer Owner existiert; Claim und Generation werden atomar per CAS gewonnen                                                                       | normale Fachoperation oder Auto-Provision hebt Suspendierung auf         |
| L-09     | `suspended/pending`                   | `active/ready` oder `active/degraded`                            | Lifecycle-Korrelation  | aktuelle Revision, vollständige Checks, abgeschlossene Generation      | Reactivate reconciliert aktuellen Sollvertrag erfolgreich                                                                                                                                                           | Reaktivierung gibt bei `pending`, `blocked` oder ungültiger Evidenz frei |
| L-10     | `*/degraded` mit `retryable`          | `*/pending`                                                      | Retry-Wake-up          | fälliger persistenter Task, neue Generation und Claim                  | `retryAfter` ist fällig und Vertrag weiterhin kompatibel; der persistierte Retry-Task bestätigt per CAS, dass kein anderer ausführbarer Owner existiert und Claim sowie Generation weiterhin gewonnen werden können | UI-Polling oder zufälliger Request ist einziger Auslöser                 |
| L-11     | beliebiges nicht terminales Ergebnis  | `*/blocked` mit `terminal`                                       | Lifecycle-Korrelation  | stabiler Fehlercode, aktuelle Vertragsrevision und Reparaturhinweis    | Fehler ist nach aktueller Deklaration terminal                                                                                                                                                                      | historische Klassifikation wird trotz Vertragsdrift übernommen           |

### Studio-Job

| Übergang | Von                                 | Nach                    | Owner                          | Persistente Felder / Beleg                                                                       | Erlaubt, wenn                                         | Verboten, wenn                                                  |
| -------- | ----------------------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------- |
| J-01     | kein Job                            | `queued`                | Lifecycle-Orchestrator         | Job, `job.queued`, Lifecycle-Claim, Recovery- und Execution-Wake-up in einer Commit-Entscheidung | LC-01/LC-02 sind erfüllt                              | Job existiert ohne Claim oder Claim ohne Job/Wake-up            |
| J-02     | `queued`                            | `running`               | zuständige Worker-Lane         | Worker-ID, Versuch, Start, Heartbeat und `job.started`                                           | Job ist aktueller Owner und Lane stimmt               | stale Generation, falsche Lane oder terminaler Job              |
| J-03     | `running`                           | `retrying`              | Runner                         | Fehler, Versuch, Heartbeat, `job.retrying` und persistenter nächster Wake-up                     | Versuch übrig und Fehler retryable                    | nächster Versuch ist nur speicherintern geplant                 |
| J-04     | `retrying`                          | `running`               | zuständige Worker-Lane         | neuer Versuch und Heartbeat                                                                      | fällige Graphile-Redelivery, Fencing weiterhin gültig | Generation/Claim/Vertrag ist veraltet                           |
| J-05     | `running`                           | `succeeded`             | Runner + Lifecycle-Korrelation | Ledger-Abschluss, Jobstatus und `job.succeeded` gemeinsam                                        | valides Lifecycle-Ergebnis und aktuelles Fencing      | Terminalevent oder Ledger bleibt hinter dem Job zurück          |
| J-06     | `running` oder `retrying`           | `failed`                | Runner + Lifecycle-Korrelation | Ledger-Fehler, Jobstatus und `job.failed` gemeinsam                                              | finaler Versuch oder permanent klassifizierter Fehler | Retryable Fehler wird ohne Wake-up terminalisiert               |
| J-07     | `queued`, `running` oder `retrying` | `cancelled`             | Runner + Lifecycle-Korrelation | Ledger-Fehler, Jobstatus und `job.cancelled` gemeinsam                                           | Beitrag und Handler erlauben Abbruch                  | Cancellation-Merkmale widersprechen sich                        |
| J-08     | jeder Terminalstatus                | derselbe Terminalstatus | Runner                         | keine fachliche Mutation; idempotente Redelivery-Evidenz                                         | identische Redelivery                                 | Wechsel in anderen Terminalstatus oder zurück zu aktivem Status |

### Gekoppelte Übergänge und Invariantenreferenz

| Invariante | Erlaubter Übergang                                                      | Verbotener Übergang                                                |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| LC-01      | A-03 + L-01 + J-01 erzeugen genau eine Generation und einen Owner-Job   | L-02 oder J-01 bei noch ausführbarem älteren Owner                 |
| LC-02      | J-01 committet Claim und persistente Arbeit gemeinsam                   | Claim-Commit ohne Execution- oder Recovery-Wake-up                 |
| LC-03      | L-10 und J-03 besitzen einen persistenten fälligen Task                 | L-01/L-04 oder `retrying` ohne Wake-up                             |
| LC-04      | J-05 bis J-07 koppeln Ledger, Jobstatus und Terminalevent               | Job terminal, während Ledger aktiv bleibt oder Event fehlt         |
| LC-05      | J-04/J-08 akzeptieren nur aktuelles Fencing oder idempotente Redelivery | ältere Generation überschreibt L-03/L-09 oder einen Terminalstatus |
| LC-06      | A-05 und L-02 führen bei Vertragsdrift zu Reconcile                     | L-11 übernimmt historische Retry-/Terminalklassifikation ungeprüft |

## Boundary- und Consumer-Matrix

Diese Matrix ist für den Change vollständig. Ein neuer Consumer erweitert vor
seiner Implementierung diese Matrix und erhält eine führende negative Evidenz.

| Boundary / Consumer       | Nicht vertrauenswürdige Eingabe               | Autoritative Hostevidenz                                                                           | Fail-closed-Verhalten                                                       | Führende Evidenz                     |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| Manifest-Validator        | Plugin-Manifest, Deskriptor, Access-Metadaten | Schema, Tier-Allowlist, registrierte Actions und vollständige `UiAccessRequirement`                | Snapshot wird nicht veröffentlicht                                          | Validator-Unit-/Property-Test        |
| Routing                   | Route, Navigation, Action, Admin-Ressource    | ausschließlich hostvalidierter Snapshot und Session-Access                                         | Route/Navigation wird nicht materialisiert                                  | negative Routing-Matrix              |
| Server-Handler-Dispatcher | Pfad, Methode, Payload, Deskriptor            | Handler-Binding, Snapshot-Access, Request- und Tenantdaten                                         | Dispatch vor Context-Erzeugung abgelehnt                                    | Dispatcher-Integrationstest          |
| Direkter Runtime-Zugriff  | pluginnahe Host-API oder interner Aufruf      | zentrale `readConfiguredPluginTenantAccess`-Entscheidung plus normale IAM-Prüfung                  | kein Fachdatenzugriff und keine Mutation                                    | negative Runtime-Access-Matrix       |
| Normaler Job-Start        | Jobtyp, Plugin-ID, Idempotenzschlüssel        | registrierter Jobtyp, aktuelle Aktivierung, Readiness und IAM                                      | Ablehnung vor Idempotenzreservierung und Jobanlage                          | Jobstart-Integrationstest            |
| Lifecycle-Job-Start       | Plugin-ID und Operation                       | deklarierter Lifecycle, effektive Aktivierung, operationsspezifische Action, registrierter Handler | keine Generation und kein Job                                               | Lifecycle-HTTP-/Service-Auth-Matrix  |
| Worker                    | persistierter Job und Payload                 | Jobregistrierung, Lane, aktueller Claim, Generation, Operation und Vertrag                         | Handler wird nicht aufgerufen; stale Job wird eindeutig terminalisiert      | PostgreSQL-/Graphile-Redelivery-Test |
| `/auth/me`                | Session und aktive Instanz                    | materialisierte Aktivierung plus aktuelle zentrale Readiness-Entscheidung                          | lifecycle-verwaltetes Modul fehlt in `assignedModules`                      | Auth-Integrationstest                |
| Readiness-API             | Instanz-ID, Plugin-ID, Operation              | Registry-Instanz, Plattformrolle und getrennte Lese-/Operations-Action                             | 401/403/404; keine Lifecycle-Mutation                                       | Service-Token-Negativmatrix          |
| Instanz-Cockpit           | API-Read-Modell                               | serverseitige Zustände, sichere Fehlercodes und Korrelation                                        | keine lokale Freigabeableitung; Reparaturbutton nur bei erlaubter Operation | UI-Unit-/A11y-Test                   |
| Default-Lane              | Graphile-Task                                 | registrierte `executionLane=default` und eingeschränkter Worker-Principal                          | privilegierter Task nicht claimbar                                          | Topologie-/Prozesstest               |
| Privilegierte Lane        | Graphile-Task                                 | registrierte `executionLane=privileged`, isolierter Provisioner und Secret-Mount                   | normale Requests und Default-Jobs nicht ausführbar                          | Deployment-/Prozesstest              |

### Autorisierungsverträge

| ID      | Boundary                                           | Gegenbeispiel, das fehlschlagen muss                                                                                                                | Direkte Evidenz                                                                                                                                                                  |
| ------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Manifest-Validator, Routing und Server-Dispatcher  | Verknüpfte Route besitzt Guard, zugehörige Action oder Server-Handler aber keine identische vollständige Access-Anforderung                         | Property-Test erzeugt Kombinationen aus fehlendem Scope, Modus, Rolle oder Action und erwartet Snapshot-Ablehnung                                                                |
| AUTH-02 | Routing und direkter Runtime-Zugriff               | Plugin liefert `resourceCapability: { allowed: true }` oder vergleichbares positives Attribut ohne Request-Ressource und autoritative Hostauflösung | Negative Matrix erwartet Ablehnung beziehungsweise `allowed=false`, bis der Host die Capability aus Ressource und Credential ableitet                                            |
| AUTH-03 | Lifecycle-Readiness-API und Service-Token-Boundary | Credential mit `instance.pluginLifecycle.reconcile` versucht `suspend`, `reactivate`, `provision`, `readiness` oder Readiness-Lesen                 | Service-Token-Matrix prüft getrennt `instance.pluginLifecycle.read`, `.provision`, `.reconcile`, `.suspend`, `.reactivate` und `.readiness`; jede fremde Kombination liefert 403 |

Die Action-Namen sind fully-qualified und bilden die freizugebende
Zielmatrix. `instance.pluginLifecycle.read` autorisiert ausschließlich das
Lesen des Readiness-Modells. `instance.pluginLifecycle.readiness` autorisiert
dagegen den ausführbaren Lifecycle-Job `readiness`, der Generation, Claim und
Jobzustand verändern kann. Zusätzlich existieren die vier ausführbaren
Operationen `.provision`, `.reconcile`, `.suspend` und `.reactivate`; damit
stehen eine Lese-Action und fünf Ausführungs-Actions getrennt nebeneinander.
Sessionbasierte Plattformadministratoren benötigen weiterhin die
Plattformrolle und CSRF für Mutationen; die Rolle ersetzt keine
operationsspezifische Service-Action.

## Crash- und Fehlermatrix

Alle Zeitangaben gelten bei verfügbarer Tenant-Datenbank und zuständiger Lane.
Bei einem längeren Infrastrukturausfall gilt zusätzlich die Diagnosezeit von
120 Sekunden und die Konvergenzzeit von 150 Sekunden ab Wiederverfügbarkeit.

| Crashpunkt                                       | Sichtbarer persistenter Zustand                                                                | Redelivery und Fencing                                                                       | Persistenter Recovery-Auslöser                                                                                                       | Maximale Konvergenzzeit        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Request vor Aktivierungs-/Lifecycle-Commit       | alter konsistenter Zustand                                                                     | Wiederholung durch Client ist neue autorisierte Anfrage                                      | keiner nötig, weil kein Sollstand committet                                                                                          | sofort                         |
| Lifecycle-Request                                | Generation, Job, Claim und Tasks entweder vollständig sichtbar oder vollständig nicht sichtbar | Idempotenzschlüssel und Generation                                                           | Execution- plus Recovery-Task derselben Transaktion                                                                                  | 150 s                          |
| Jobanlage                                        | kein isolierter Job; bei Commit `queued` mit Owner-Claim                                       | eindeutige Job-ID und Idempotenzschlüssel                                                    | Execution- und Recovery-Task                                                                                                         | 150 s                          |
| Claim                                            | kein isolierter Claim; bei Commit exakt ein Owner                                              | CAS auf Job-ID, Generation und Operation                                                     | Recovery-Task                                                                                                                        | 150 s                          |
| Recovery-Enqueue                                 | Claim kann nicht ohne Recovery-Task committen                                                  | stabiler Recovery-Task-Key                                                                   | Graphile-Wake-up                                                                                                                     | 150 s                          |
| Execution-Enqueue                                | `queued` und Claim sind gemeinsam mit Execution-Task sichtbar                                  | stabiler Execution-Task-Key                                                                  | Execution- und Recovery-Task                                                                                                         | 150 s                          |
| Handler-Start vor `running`-Commit               | Job bleibt `queued`                                                                            | Graphile-Redelivery prüft Claim und Generation erneut                                        | Graphile-Lock-Ablauf/Redelivery                                                                                                      | 150 s nach Lock-Freigabe       |
| Nach `running`, vor Seiteneffekt                 | `running` mit Worker-ID und Heartbeat                                                          | Handler muss fachlich idempotent und generationsgebunden sein                                | Graphile-Redelivery plus Stale-Heartbeat-Recovery                                                                                    | 150 s nach Stale-Grenze        |
| Nach Seiteneffekt, vor Handler-Ergebnis          | `running`; Fachartefakt kann bereits existieren                                                | Handler reconciliiert über stabilen fachlichen Schlüssel; Fencing vor jedem Schreibabschluss | Graphile-Redelivery                                                                                                                  | 150 s nach Stale-Grenze        |
| Nach Handler-Ergebnis, vor Lifecycle-Korrelation | kein Terminal-Commit; Job bleibt `running`                                                     | Ergebnis wird erneut validiert; aktuelle Deklaration und Generation entscheiden              | Graphile-Redelivery                                                                                                                  | 150 s nach Stale-Grenze        |
| Lifecycle-Korrelation                            | Ledger, Jobstatus und Terminalevent werden gemeinsam committet                                 | CAS auf Job-ID, Operation und Generation                                                     | Transaktionsrollback und Graphile-Redelivery                                                                                         | 150 s                          |
| Jobstatus                                        | kein Zustand mit terminalem Job und aktivem Ledger                                             | identische Terminal-Redelivery ist No-op                                                     | gemeinsame Terminaltransaktion                                                                                                       | 150 s                          |
| Terminalevent                                    | kein Zustand mit Terminalstatus ohne korrespondierendes Event                                  | Event-ID beziehungsweise `(jobId,eventType,attempt)` ist idempotent                          | gemeinsame Terminaltransaktion                                                                                                       | 150 s                          |
| Retry-Wake-up                                    | `degraded/retryable` und `retryAfter` nur gemeinsam mit Task                                   | Task-Key enthält Instanz, Plugin, Operation und Generation                                   | fälliger Graphile-Task                                                                                                               | `retryAfter` + 150 s           |
| Worker-/Prozessabbruch                           | letzter committeter Job-/Heartbeat-Stand bleibt sichtbar                                       | Graphile-Lock-Ablauf; neuer Worker prüft Lane, Claim, Generation und Terminalstatus          | bestehender Graphile-Task und autonom begrenzte Worker-Supervision oder kontrolliertes Prozess-Fail-fast mit orchestriertem Neustart | 150 s nach Lock-/Lane-Erholung |

## Direkter Evidenzvertrag

Jede Zeile besitzt genau eine führende Evidenz. Mock-basierte Unit-Tests dürfen
ergänzen, aber nicht die genannte Systemgrenze ersetzen. Die Ziel-Testorte
werden in den Folgeplänen implementiert; bis dahin ist die Invariante nicht
bewiesen.

| Invariante | Führende Evidenzklasse                  | Ziel-Testort                                                                                                                                                        | Fehler-Injektion                                                      | Erwarteter persistenter Endzustand                                                                                                                                                                                                                                                                                                   | Gate-Befehl                                                                                                                                                                                                                                 |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01    | Validator-Property-Test                 | `packages/plugin-sdk/src/plugin-registries.test.ts`                                                                                                                 | fehlende oder abweichende Access-Anforderung in verknüpften Beiträgen | kein Snapshot veröffentlicht                                                                                                                                                                                                                                                                                                         | `pnpm nx run plugin-sdk:test:unit --testFiles=src/plugin-registries.test.ts`                                                                                                                                                                |
| AUTH-02    | negative Autorisierungsmatrix           | `packages/iam-core/src/ui-access.test.ts`, `packages/auth-runtime/src/plugin-server-handlers/dispatcher.test.ts` und `packages/routing/src/ui-route-access.test.ts` | positiver Deskriptor ohne autoritative Ressource                      | `allowed=false`, keine Route/Mutation                                                                                                                                                                                                                                                                                                | `pnpm nx run iam-core:test:unit --testFiles=src/ui-access.test.ts && pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-server-handlers/dispatcher.test.ts && pnpm nx run routing:test:unit --testFiles=src/ui-route-access.test.ts` |
| AUTH-03    | negative Service-Token-Matrix           | `packages/auth-runtime/src/plugin-tenant-lifecycle/http.test.ts`                                                                                                    | jede Action gegen jede fremde Operation                               | HTTP 403, keine Generation und kein Job                                                                                                                                                                                                                                                                                              | `pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-tenant-lifecycle/http.test.ts`                                                                                                                                                   |
| LC-01      | echtes PostgreSQL                       | `tooling/testing/tests/plugin-lifecycle-contract.test.ts`                                                                                                           | konkurrierende Starts derselben Instanz/des Plugins                   | eine Generation, ein Claim, ein Owner-Job                                                                                                                                                                                                                                                                                            | `pnpm nx run tooling-testing:test:unit --testFiles=tests/plugin-lifecycle-contract.test.ts`                                                                                                                                                 |
| LC-02      | echtes PostgreSQL + Graphile Worker     | `tooling/testing/tests/plugin-lifecycle-contract.test.ts`                                                                                                           | Prozessabbruch zwischen Claim und Enqueue                             | entweder Rollback oder Claim mit persistentem Recovery-/Execution-Task                                                                                                                                                                                                                                                               | `pnpm nx run tooling-testing:test:unit --testFiles=tests/plugin-lifecycle-contract.test.ts`                                                                                                                                                 |
| LC-03      | echter Graphile Worker                  | `tooling/testing/tests/plugin-lifecycle-contract.test.ts`                                                                                                           | Ausfall beim Retry-Wake-up                                            | kein `pending`/`retryable` ohne fälligen Task                                                                                                                                                                                                                                                                                        | `pnpm nx run tooling-testing:test:unit --testFiles=tests/plugin-lifecycle-contract.test.ts`                                                                                                                                                 |
| LC-04      | echtes PostgreSQL                       | `tooling/testing/tests/plugin-lifecycle-contract.test.ts`                                                                                                           | Fehler nach Ledger-, Job- oder Event-Schreibversuch                   | alle drei alt oder alle drei terminal                                                                                                                                                                                                                                                                                                | `pnpm nx run tooling-testing:test:unit --testFiles=tests/plugin-lifecycle-contract.test.ts`                                                                                                                                                 |
| LC-05      | echtes PostgreSQL + Graphile-Redelivery | `tooling/testing/tests/plugin-lifecycle-contract.test.ts`                                                                                                           | alte Generation und Terminal-Redelivery                               | neuere Generation/Terminalzustand unverändert                                                                                                                                                                                                                                                                                        | `pnpm nx run tooling-testing:test:unit --testFiles=tests/plugin-lifecycle-contract.test.ts`                                                                                                                                                 |
| LC-06      | echtes PostgreSQL                       | `tooling/testing/tests/plugin-lifecycle-contract.test.ts`; Reducer-Unit-Test nur ergänzend                                                                          | Manifestrevision ändert Retry-/Checkvertrag vor Abschluss             | `reconcile`-Generation oder reparierbarer Driftkonflikt, nie historische Freigabe                                                                                                                                                                                                                                                    | `pnpm nx run tooling-testing:test:unit --testFiles=tests/plugin-lifecycle-contract.test.ts`                                                                                                                                                 |
| TOP-01     | Topologie-/Prozesstest                  | `deploy/portainer/waste-provisioner-deployment.test.ts` und `packages/auth-runtime/src/plugin-operations/runner-worker.test.ts`                                     | falsche Lane und fataler Worker-Abbruch                               | falsche Lane claimt nicht; Lane startet autonom begrenzt neu oder der Prozess beendet sich kontrolliert und wird orchestriert neu gestartet; bis dahin bleibt die Runtime fail-closed not-ready                                                                                                                                      | `pnpm nx run tooling-testing:test:unit --testFiles=../../deploy/portainer/waste-provisioner-deployment.test.ts && pnpm nx run auth-runtime:test:unit --testFiles=src/plugin-operations/runner-worker.test.ts`                               |
| ACT-01     | echtes PostgreSQL                       | `tooling/testing/tests/plugin-lifecycle-contract.test.ts`                                                                                                           | Fehler nach Aktivierung oder IAM-Materialisierung                     | vollständiger Rollback oder persistenter Reconcile-Auftrag                                                                                                                                                                                                                                                                           | `pnpm nx run tooling-testing:test:unit --testFiles=tests/plugin-lifecycle-contract.test.ts`                                                                                                                                                 |
| OBS-01     | Metrik-/Alert-/Runbook-Test             | `packages/monitoring-client/tests/plugin-tenant-lifecycle.test.ts` und Betriebsrunbook                                                                              | Claim-, Wake-up-, Drift- und Lane-Störung                             | Metriken verwenden ausschließlich begrenzte Labels wie Lane, Status und sicherer Reason-Code; `instanceId`, `pluginId`, `jobId`, Generation, `requestId` und `correlationId` erscheinen nur redigiert in strukturierten Logs, Traces oder berechtigten Diagnosequeries und nie als unbeschränkte Metriklabels; Alert innerhalb 120 s | `pnpm nx run monitoring-client:test:unit --testFiles=tests/plugin-tenant-lifecycle.test.ts && pnpm check:docs`                                                                                                                              |

## Persistenzentscheidung

### Entscheidung: gemeinsame PostgreSQL-Transaktion

Für PR 1197 ist die gemeinsame PostgreSQL-Transaktion verbindlich. Die
Lifecycle-Zeile, Studio-Jobzeile, zugehörigen Job-Events und die durch
`graphile_worker.sva_enqueue_job` erzeugten Wake-ups liegen im bestehenden
Studio-/Tenant-Datenbankvertrag. Deshalb müssen folgende Einheiten jeweils eine
Commit-Entscheidung teilen:

1. Aktivierungs-/IAM-Commit und persistenter Lifecycle-Reconcile-Auftrag,
   sofern nicht bereits aktuelle valide Evidenz vorliegt.
2. Lifecycle-Request, Studio-Jobanlage, Queue-Event, Claim, Execution-Task und
   Recovery-Task.
3. Lifecycle-Erfolg oder -Fehler, Studio-Jobstatus und korrespondierendes
   Terminalevent.
4. Retry-Klassifikation, `retryAfter`, `job.retrying` und nächster Wake-up.

Repository-Funktionen nehmen den vom Runtime-Orchestrator geöffneten
Transaktionsexecutor entgegen und öffnen keine eigene Transaktion. Externe
pluginfachliche Seiteneffekte bleiben außerhalb dieser Transaktion; sie werden
durch fachliche Idempotenzschlüssel, generationsgebundenes Fencing und
Reconcile abgesichert.

### Abgewogene Alternativen

| Alternative                                           | Bewertung                                                                                                                                                 | Entscheidung                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Transaktionale Outbox                                 | Korrekt möglich, aber für ausschließlich in derselben PostgreSQL-Instanz liegende Stores zusätzlicher Relay-, Lag- und Betriebsvertrag                    | verworfen; erst neu bewerten, wenn eine Systemgrenze nicht mehr dieselbe Datenbank teilt |
| Separate idempotente Materialisierung                 | Erfordert zusätzliche Zwischenzustände, Sweeper und Beweise für jede Schreibrichtung; widerspricht der bereits verfügbaren gemeinsamen Transaktionsgrenze | verworfen                                                                                |
| Nur Post-Commit-Hook beziehungsweise Request-Recovery | Verliert Arbeit bei Prozessabbruch und hängt Recovery von fremdem Traffic ab                                                                              | verboten                                                                                 |

Diese Entscheidung setzt keine neue Datenbank, Queue oder keinen neuen Service
voraus. Sie nutzt PostgreSQL, den vorhandenen Graphile-Worker und die
existierenden Default-/privilegierten Lanes.

## Migration, Kompatibilität und Rollback

1. Zuerst werden Transaction Ports ergänzt, ohne Jobtypen, Payloads,
   Idempotenzschlüssel oder Lane-Namen zu ändern.
2. Bestehende `queued`, `running` und `retrying` Jobs werden anhand ihrer
   bestehenden Lifecycle-Metadaten eingeordnet. Ein Job mit passendem Claim
   erhält idempotent Recovery- und Execution-Wake-up; ein Job ohne eindeutigen
   Claim wird nicht ausgeführt und als reparierbarer Konflikt sichtbar.
3. Bestehende Terminaljobs werden niemals erneut ausgeführt. Fehlende
   Terminalevents dürfen ausschließlich idempotent aus dem Jobzustand
   materialisiert werden, wenn Ledger, Generation und Ergebnis eindeutig
   übereinstimmen; sonst STOP und manueller Repair-Entscheid.
4. Waste behält Jobtyp, Fachgeneration, Datenbanktopologie, Provisioner-Lane
   und Fachartefakte. Der Host-Lifecycle kapselt nur Claim, Job, Wake-up und
   Readiness. Vor Umschaltung muss der reale PostgreSQL-/Graphile-Test mindestens
   einen bestehenden Waste-Job aus jeder nicht terminalen Statusklasse prüfen.
5. Der Rollback darf Runtime-Code auf die vorherige Version zurücksetzen,
   solange das Schema additiv kompatibel bleibt. Bereits geschriebene Tasks
   und Events behalten ihre bisherigen Identifier; keine Migration löscht
   Jobs, Ledger oder Auditdaten.
6. Nicht eindeutig klassifizierbare produktive Jobs blockieren die
   Umschaltung. Sie werden nicht automatisch umgeschrieben oder verworfen.

## STOP-Bedingungen für die Folgeumsetzung

Die Folgepläne stoppen und melden zurück, wenn mindestens eine Bedingung
eintritt:

- Eine Zustandsfolge lässt zwei widersprüchliche Terminalzustände zu.
- Ein Crashpunkt benötigt einen fremden Request oder UI-Polling zur Recovery.
- Eine positive Autorisierungsentscheidung stammt aus einem
  Plugin-Deskriptor statt aus Hostevidenz.
- Die Umsetzung benötigt eine neue Datenbank, Queue oder einen neuen Service.
- Ein bestehender produktiver Job lässt sich nicht migrations- und
  kompatibilitätsgesichert einordnen.
- Die gemeinsame Transaktion ist wegen einer bislang nicht dokumentierten
  physischen Datenbankgrenze nicht möglich. In diesem Fall wird vor Codeänderung
  ein neuer Architekturentscheid zur Outbox benötigt.

## Freigabe

- [x] Die Zustandsautomaten und gekoppelten Übergänge wurden fachlich geprüft.
- [x] Die Boundary-/Consumer-Matrix ist vollständig bestätigt.
- [x] Crashmatrix, Zeitbudgets und persistente Recovery-Auslöser sind bestätigt.
- [x] Die gemeinsame PostgreSQL-Transaktion, Migration und Rollback sind bestätigt.
- [x] Die führenden Evidenzorte und Gate-Befehle sind bestätigt.
- [x] Menschliche Freigabe für die Folgepläne 038 bis 041 liegt vor.

**Freigabestatus:** freigegeben

**Freigegeben durch:** Philipp Wilimzig (Maintainer)

**Datum:** 2026-08-31

Die Folgepläne 038 bis 041 werden nicht automatisch gestartet. Sie dürfen mit
dieser Freigabe nach ihren dokumentierten Abhängigkeiten ausgeführt werden.
