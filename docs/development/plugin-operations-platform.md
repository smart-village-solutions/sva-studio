# Plugin-Operations-Plattform

## Zweck

Dieses Dokument beschreibt den aktuellen Entwicklungsvertrag für generische Plugin-Jobs und strukturierte Importe. Es ergänzt die OpenSpec-Änderung `update-plugin-platform-for-generic-jobs-imports` um den konkreten Package-Zuschnitt und die erwartete Nutzung durch Fachplugins.

## Zielbild

- Generische Jobs und strukturierte Importe sind eine hostgeführte Plattformfähigkeit.
- Plugins liefern nur deklarative Beiträge und fachliche Payloads.
- Die führende Persistenz für pluginübergreifende Jobs liegt zentral im Studio-Postgres.
- Öffentliche Verträge bleiben runner-agnostisch; eine interne Worker-Implementierung wie Graphile Worker bleibt austauschbar.

## Package-Grenzen

- `@sva/plugin-sdk` definiert deklarative `jobTypes` und `importProfiles` und validiert Namespace, Pflichtfelder und Kollisionen im Build-Time-Registry-Pfad.
- `@sva/core` hält die stabilen generischen Verträge für Status, Progress, Jobdatensatz und Start-Request.
- `@sva/routing` ist die einzige öffentliche Runtime-Route-Wahrheit für produktive Plugin-Operations-Endpunkte.
- `@sva/auth-runtime` prüft Authentifizierung, Instanzkontext, Request-Vertrag und hostgeführte Fehlerabbildung.
- `@sva/data-repositories` hält den zentralen Job-Store und damit die führende Governance- und Betriebssicht.
- `@sva/server-runtime` bleibt Owner der gemeinsamen serverseitigen Fehler-, Logging- und Request-Kontext-Helfer.

Nicht zulässig sind:

- plugininterne Parallel-Registries für Jobs oder Importe
- produktive Plugin-Endpunkte außerhalb des hostgeführten Runtime-Katalogs
- externe Fachdatenbanken als führende Persistenz der generischen Jobplattform

## Deklarative Plugin-Beiträge

Ein Plugin kann im bestehenden Plugin-Vertrag zwei neue Beitragstypen registrieren:

- `jobTypes`
- `importProfiles`

Ein `jobType` beschreibt den fachlichen Typ einer langlaufenden Operation. Ein `importProfile` beschreibt einen strukturierten Importfall, der auf einem registrierten Jobtyp aufsetzt.

Erwartete Mindestfelder:

- Jobtyp: `jobTypeId`, `queue`, `displayName`
- optionale Progress-Metadaten pro Jobtyp: `progress.phaseKeys`, `progress.stepKeys`
- optionale Ergebnis-/Fehlermetadaten pro Jobtyp: `result.summaryKeys`, `result.detailKeys`, `errors.detailKeys`
- Importprofil: `profileId`, `jobTypeId`, `displayName`, `sourceFormats`, `schemaVersion`, `schemaStrategy`, `mappingStrategy`, `validation.mode`

Die technische Kennung bleibt namespacet und folgt dem Plugin-Namespace, zum Beispiel `waste-management.csv-import`.

## Stabile generische Felder

Diese Felder gelten als hostgeführter Grundvertrag und sollen von Fachplugins nicht umdefiniert werden:

- Jobstatus: `queued`, `running`, `retrying`, `succeeded`, `failed`, `cancelled`
- generische Progress-Struktur: `completedSteps`, `totalSteps`, `currentPhase`, optional `currentStepKey`, `currentStepLabel`, `details`, `lastUpdatedAt`
- generische Importphasen: `ingestion`, `schema-validation`, `mapping`, `preview`, `commit`, `completed`
- generische Fehlerkategorien: `retryable`, `permanent`, `validation`, `external_dependency`
- technische Host-Events: `job.queued`, `job.started`, `job.progressed`, `job.retrying`, `job.succeeded`, `job.failed`, `job.cancelled`
- generische Job-Metadaten wie `id`, `instanceId`, `pluginId`, `jobTypeId`, `importProfileId`, `queueName`, `attempts`, `maxAttempts`, `idempotencyKey`, `workerId`, `heartbeatAt`, `lastProgressAt`, `cancelRequestedAt`, `correlationId`, `parentJobId`, Zeitstempel und Actor-/Request-Bezug

Fachpluginspezifisch bleiben:

- `inputPayload`
- `resultPayload.plugin`
- `errorPayload.details.plugin`
- plugininterne Validierungssemantik, Mapping-Regeln und Ergebnisdeutung

Hostseitig stärker normiert sind inzwischen:

- `resultPayload.summary` mit stabilen Feldern wie `processedItems`, `acceptedItems`, `rejectedItems`, `skippedItems`, `warningCount` und `durationMs`
- `resultPayload.plugin` für jobtypspezifische Ergebnisdetails
- `errorPayload.details.host` für technische Hostdetails
- `errorPayload.details.plugin` für pluginfachliche Fehlerzusätze

## Führende Persistenz

Der zentrale Jobdatensatz liegt im Studio-Postgres und ist der kanonische Host-Store für:

- Status und Progress
- Retry-Zähler und Versuchsgrenzen
- Input-, Ergebnis- und Fehlerpayloads
- technische Event-Historie pro Job
- Heartbeats, Worker-Zuordnung und gespeicherte Cancel-Requests
- Actor-, Request- und Idempotency-Bezug
- Start-, Ende- und Änderungszeitpunkte

Eine externe Fachdatenbank darf ergänzende plugininterne Betriebsdaten halten, ist aber nicht der führende Vertrag für pluginübergreifende Jobzustände.

## Aktuelle Host-Endpunkte

Die erste Plattformausbaustufe veröffentlicht derzeit:

- `POST /api/v1/plugin-operations/jobs`
- `GET /api/v1/plugin-operations/jobs`
- `GET /api/v1/plugin-operations/jobs/:jobId`
- `POST /api/v1/plugin-operations/jobs/:jobId/cancel`

Der Start-Endpunkt legt den zentralen Jobdatensatz an. Der Listen-Endpunkt liefert eine hostnormalisierte Monitoring-Projektion für `Aktiv` und `Historie`, inklusive Filter auf Status, Plugin, Jobtyp sowie einfacher Suche über Job- und Korrelationskennungen. Der Detail-Endpunkt liefert denselben Datensatz plus technische Event-Historie für UI-Polling. Der Cancel-Endpunkt speichert im ersten Schnitt nur die Abbruchanforderung am zentralen Datensatz; die kooperative Ausführung bleibt Host-Verantwortung. Alle Endpunkte bleiben bewusst hostgeführt und greifen auf dieselbe persistierte Wahrheit zu.

Für mutierende Plugin-Operations-Endpunkte gilt zusätzlich:

- `POST /api/v1/plugin-operations/jobs` und `POST /api/v1/plugin-operations/jobs/:jobId/cancel` verlangen denselben CSRF-Schutz wie andere cookie-authentifizierte IAM-Mutationen
- der Start-Endpunkt akzeptiert nur registrierte Jobtypen
- `pluginId`, `jobTypeId` und optional `importProfileId` müssen namespace-konsistent zueinander sein
- wiederholte Start-Requests mit gleichem `Idempotency-Key` verwenden den gemeinsamen Host-Idempotency-Store und liefern Replay oder `409` statt eines generischen Datenbankfehlers

Der Detail-Endpunkt liefert inzwischen zusätzlich eine kleine hostgeführte Laufzeitprojektion für Polling-Clients:

- `latestEvent` als letzter technischer Lifecycle-Eintrag
- `runtime.cancellationRequested` als normalisierte Sicht auf gespeicherte Cancel-Requests
- `runtime.staleState` mit `fresh | stale | terminal`
- `runtime.staleAfterSeconds` als aktuell hostseitig verwendete Schwelle
- `runtime.lastObservedAt` auf Basis von `heartbeatAt`, `lastProgressAt`, `startedAt` oder `updatedAt`
- normalisierte `history`-Einträge mit Default-`message`, `presentation.title`, `presentation.tone` und stabilisierten `details.host`-Feldern

Ein laufender oder retryender Job gilt derzeit als `stale`, wenn seit der letzten beobachteten Aktivität mehr als 120 Sekunden vergangen sind. Diese Diagnose dient im aktuellen Schnitt nur der Sichtbarkeit in UI und Betrieb, noch nicht einer automatischen Recovery.

Der aktuelle öffentliche Fehlervertrag dieser ersten Ausbaustufe ist bewusst schmal und stabil. Hostgeführte Plugin-Operations-Endpunkte verwenden derzeit nur diese generischen Fehlercodes:

- `unauthorized`
- `forbidden`
- `not_found`
- `invalid_request`
- `invalid_instance_id`
- `csrf_validation_failed`
- `idempotency_key_required`
- `idempotency_key_reuse`
- `database_unavailable`

## Runner-Grenze

Die öffentliche Plattform spricht nicht über konkrete Worker-Technologie. Eine interne Runner-Anbindung darf:

- Jobs enqueuen
- Ausführung starten
- Status und Progress fortschreiben
- Retry- und Fehlerzustände zurückschreiben

Die erste interne Implementierung nutzt dafür Graphile Worker im Hostprozess. Der Worker wird hostseitig lazy gestartet, nutzt denselben zentralen Studio-Postgres wie der führende Jobdatensatz und bleibt vollständig hinter `@sva/auth-runtime` verborgen.

Innerhalb von `@sva/auth-runtime` ist der Ablauf inzwischen weiter getrennt:

- `runner.ts` bleibt Graphile-Adapter und Queue-Einstieg
- `job-lifecycle-orchestrator.ts` kapselt Host-Lifecycle, Handler-Aufruf und Retry-/Terminal-Entscheidungen
- Event-, State-, Progress- und Read-Modell-Normalisierung bleiben in eigenen Host-Bausteinen

Fachliche Handler erhalten dabei einen hostgebauten Kontext statt Graphile-spezifischer Helfer:

- `job`
- `logger`
- `progressReporter`
- `abortSignal`
- `isCancellationRequested()`
- `throwIfCancellationRequested()`
- optional `requestId` und `actorAccountId`

Kooperative Abbrüche sollen in Handlern explizit über `throwIfCancellationRequested()` geprüft werden. Der Host mappt diese Abbruchbedingung auf den terminalen Status `cancelled` und schreibt dazu ein technisches `job.cancelled`-Event.

Technische Event-Details sind im Hostvertrag inzwischen normiert:

- stabile Host-Felder liegen unter `details.host`, zum Beispiel `workerId`, `errorCode`, `errorCategory` oder `cancellationRequestedAt`
- pluginspezifische Zusatzdaten liegen getrennt unter `details.plugin`
- `message` bleibt ein menschenlesbares Kurzfeld und ersetzt keine maschinenlesbaren Details

Sie darf aber nicht:

- die API-Shapes der Host-Endpunkte bestimmen
- den zentralen Jobdatensatz umgehen
- Graphile-spezifische Begriffe zum öffentlichen Plugin-Vertrag machen

## Erwartung an Fachchanges

Fachchanges wie `add-waste-management-plugin` konsumieren diese Plattform und definieren darauf nur ihre fachliche Nutzung:

- Waste registriert eigene Jobtypen für Migration, Import, Seed und Reset.
- Waste registriert eigene Importprofile statt eine parallele Importplattform zu bauen.
- Waste darf eine fachnahe Bedienhülle ergänzen, solange der generische Host-Vertrag, die zentrale Job-Persistenz und die hostgeführten Endpunkte nicht umgangen werden.

## Aktuelle Host-UI

Die aktuelle Ausbaustufe liefert eine erste lesende Host-Oberfläche unter `Monitoring > Jobs`:

- Tabs `Aktiv` und `Historie`
- automatische Aktualisierung aktiver Jobs im 10-Sekunden-Takt
- eigene Detailseite pro Job mit Verlauf, Runtime-Diagnostik, Ergebnis- und Fehlerpayload
- einfache Filter für Status, Plugin, Jobtyp und freie Suche

Bewusst noch nicht enthalten sind:

- Retry-, Abbruch- oder Löschaktionen in der Monitoring-UI
- ein generischer Import-Wizard
- Push-Kanäle wie SSE oder WebSocket

Outbox, n8n-Anbindung, SSE/WebSocket oder ein Broker wie NATS sind ausdrücklich Folgearbeit hinter derselben Host-Vertragsgrenze.

Spätere Fachchanges dürfen darauf aufsetzen und bei Bedarf eine fachnahe Bedienhülle oder eine allgemeinere Host-Oberfläche ergänzen.
