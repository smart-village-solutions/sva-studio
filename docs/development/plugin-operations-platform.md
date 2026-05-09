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
- Importprofil: `profileId`, `jobTypeId`, `displayName`, `sourceFormats`, `schemaVersion`, `schemaStrategy`, `mappingStrategy`, `validation.mode`

Die technische Kennung bleibt namespacet und folgt dem Plugin-Namespace, zum Beispiel `waste-management.csv-import`.

## Stabile generische Felder

Diese Felder gelten als hostgeführter Grundvertrag und sollen von Fachplugins nicht umdefiniert werden:

- Jobstatus: `queued`, `running`, `retrying`, `succeeded`, `failed`, `cancelled`
- generische Progress-Struktur: `completedSteps`, `totalSteps`, `currentPhase`
- generische Importphasen: `ingestion`, `schema-validation`, `mapping`, `preview`, `commit`, `completed`
- generische Job-Metadaten wie `id`, `instanceId`, `pluginId`, `jobTypeId`, `importProfileId`, `queueName`, `attempts`, `maxAttempts`, `idempotencyKey`, Zeitstempel und Actor-/Request-Bezug

Fachpluginspezifisch bleiben:

- `inputPayload`
- `resultPayload`
- `errorPayload`
- plugininterne Validierungssemantik, Mapping-Regeln und Ergebnisdeutung

## Führende Persistenz

Der zentrale Jobdatensatz liegt im Studio-Postgres und ist der kanonische Host-Store für:

- Status und Progress
- Retry-Zähler und Versuchsgrenzen
- Input-, Ergebnis- und Fehlerpayloads
- Actor-, Request- und Idempotency-Bezug
- Start-, Ende- und Änderungszeitpunkte

Eine externe Fachdatenbank darf ergänzende plugininterne Betriebsdaten halten, ist aber nicht der führende Vertrag für pluginübergreifende Jobzustände.

## Aktuelle Host-Endpunkte

Die erste Plattformausbaustufe veröffentlicht derzeit:

- `POST /api/v1/plugin-operations/jobs`
- `GET /api/v1/plugin-operations/jobs/:jobId`

Der Start-Endpunkt legt den zentralen Jobdatensatz an. Der Detail-Endpunkt liest denselben Datensatz wieder aus. Beide Endpunkte bleiben bewusst hostgeführt und greifen auf dieselbe persistierte Wahrheit zu.

Der aktuelle öffentliche Fehlervertrag dieser ersten Ausbaustufe ist bewusst schmal und stabil. Hostgeführte Plugin-Operations-Endpunkte verwenden derzeit nur diese generischen Fehlercodes:

- `unauthorized`
- `forbidden`
- `not_found`
- `invalid_request`
- `invalid_instance_id`
- `idempotency_key_required`
- `database_unavailable`

## Runner-Grenze

Die öffentliche Plattform spricht nicht über konkrete Worker-Technologie. Eine interne Runner-Anbindung darf:

- Jobs enqueuen
- Ausführung starten
- Status und Progress fortschreiben
- Retry- und Fehlerzustände zurückschreiben

Die erste interne Implementierung nutzt dafür Graphile Worker im Hostprozess. Der Worker wird hostseitig lazy gestartet, nutzt denselben zentralen Studio-Postgres wie der führende Jobdatensatz und bleibt vollständig hinter `@sva/auth-runtime` verborgen.

Sie darf aber nicht:

- die API-Shapes der Host-Endpunkte bestimmen
- den zentralen Jobdatensatz umgehen
- Graphile-spezifische Begriffe zum öffentlichen Plugin-Vertrag machen

## Erwartung an Fachchanges

Fachchanges wie `add-waste-management-plugin` konsumieren diese Plattform und definieren darauf nur ihre fachliche Nutzung:

- Waste registriert eigene Jobtypen für Migration, Import, Seed und Reset.
- Waste registriert eigene Importprofile statt eine parallele Importplattform zu bauen.
- Waste darf eine fachnahe Bedienhülle ergänzen, solange der generische Host-Vertrag, die zentrale Job-Persistenz und die hostgeführten Endpunkte nicht umgangen werden.

## Keine Pflicht-Host-UI in diesem Change

Dieser Plattform-Change liefert bewusst keine allgemeine Monitoring-Seite und keinen generischen Import-Wizard aus. Die erste Ausbaustufe besteht absichtlich nur aus:

- deklarativen Plugin-Beiträgen
- zentraler Persistenz
- hostgeführten API-Endpunkten
- interner Runner-Anbindung

Spätere Fachchanges dürfen darauf aufsetzen und bei Bedarf eine fachnahe Bedienhülle oder eine allgemeinere Host-Oberfläche ergänzen.
