# Betrieb des Plugin-Tenant-Lifecycles

## Zweck und Grenzen

Dieses Runbook beschreibt die nicht-destruktive Diagnose blockierter Plugin-Tenant-Lifecycle-Läufe. Reguläre Rollouts erfolgen ausschließlich nach dem [Studio-Rollout-Prozess](../guides/studio-rollout-process.md). Das Runbook autorisiert weder direkte Statusänderungen noch das Löschen oder manuelle Entsperren von Studio- oder Graphile-Jobs.

Die Lifecycle-Metriken sind absichtlich fleetweit aggregiert. Sie enthalten nur die begrenzten Dimensionen `lane`, `status` und `reason_code`. Instanz-, Plugin-, Job-, Request- und Korrelations-IDs erscheinen nicht als Metriklabels. Die DB-Aggregate können aus mehreren Runtime-Prozessen exportiert werden; ein späterer Prometheus-Vertrag dedupliziert sie deshalb mit `max by (reason_code)`. Lane-Metriken beschreiben dagegen den jeweils eigenen Worker-Prozess und werden mit `min by (lane)` bewertet.

Der vorgelagerte Aktivierungsrichtlinien-Fleet-Reconcile exportiert ergänzend `sva_plugin_activation_policy_fleet_state`, `sva_plugin_activation_policy_fleet_failure_count` und `sva_plugin_activation_policy_fleet_seconds_since_success`. Im Standard-Deployment ist der App-Prozess mit der `default`-Lane der einzige Owner dieser Schleife und ihrer prozesslokalen Fleet-Metriken; der privilegierte Provisioner exportiert keinen konkurrierenden Fleet-Zustand. `state` ist auf `unknown`, `ready`, `retrying` und `degraded` begrenzt; Fehler werden ausschließlich nach dem erlaubten `reason_code` und `retry_class` aggregiert. Instanz-IDs erscheinen weiterhin nur im redigierten Zustandswechsel-Log, nicht als Metriklabel. `retrying` verwendet 1/5/15 Minuten Backoff, `degraded` eine 30-minütige Kontrollprobe. Bei gemischten Fehlerklassen gilt für die Planung der kürzere retrybare Takt. Wiederholt identische Zwischenläufe erzeugen keine neue Warnung.

## Betriebsstatus der Alarmierung

Die produktiven Studio-Profile exportieren derzeit keine OTEL-Metriken an einen betriebenen Collector. Prometheus-Lifecycle-Alerts bleiben daher inaktiv; [Issue #1237](https://github.com/smart-village-solutions/sva-studio/issues/1237) verfolgt den produktiven Metrikexport. Die bestehenden Studio-Containerlogs erreichen bereits die Loki-Datenquelle von `logs.tpwd.de`. App- und Provisioner-Worker schreiben nach dem Rollout einmal pro Minute `plugin_tenant_lifecycle_health` mit `lane`, `ready` und `status`. Nur die App ergänzt den bestehenden sicheren DB-Aggregatsnapshot mit `stale_claim`, `due_work_count`, `generation_without_owner` und `observation_ok`. Diese Logfelder enthalten keine Instanz-, Plugin- oder Job-IDs.

Die Loki-Alerts werden erst aktiviert, wenn beide neuen Signale nach dem regulären Rollout in `logs.tpwd.de` nachgewiesen sind. Die bestehenden Studio-Slack-Kontaktpunkte und der Studio-Alert-Ordner sind dafür zu verwenden. Ein ausbleibendes Signal vor diesem Nachweis ist kein Ausfallbeleg.

## Loki-Alert-Vertrag

Alle Abfragen verwenden die vorhandene Loki-Datenquelle und werden alle 60 Sekunden ausgewertet. Für die fünf Zustandsregeln gilt `A >= 2` mit zwei Minuten Pending-Zeit. Die Zustandsabfragen setzen fehlende Treffer auf null; die separaten Signalausfallregeln erkennen ein ausgebliebenes Signal. Auswertungsfehler müssen sichtbar bleiben. Für die beiden Signalausfallregeln gilt `A > 0` mit zwei Minuten Pending-Zeit, nachdem das jeweilige Signal erstmals live nachgewiesen wurde. Die Alerts enthalten nur Alarmklasse, betroffene Lane und Runbook-Link; keine IDs oder Fehlertexte gehen an Slack.

| Alertklasse | LogQL für A |
| --- | --- |
| `LaneUnavailable` | `sum by (lane) (count_over_time({swarm_service=~"studio_(app|provisioner)"} |= "plugin_tenant_lifecycle_health" \| json \| ready="false" [3m])) or vector(0)` |
| `StaleClaim` | `sum(count_over_time({swarm_service="studio_app"} |= "plugin_tenant_lifecycle_health" \| json \| stale_claim > 0 [3m])) or vector(0)` |
| `DueWorkStalled` | `sum(count_over_time({swarm_service="studio_app"} |= "plugin_tenant_lifecycle_health" \| json \| due_work_count > 0 [3m])) or vector(0)` |
| `GenerationWithoutOwner` | `sum(count_over_time({swarm_service="studio_app"} |= "plugin_tenant_lifecycle_health" \| json \| generation_without_owner > 0 [3m])) or vector(0)` |
| `ObservabilityUnavailable` | `sum(count_over_time({swarm_service="studio_app"} |= "plugin_tenant_lifecycle_health" \| json \| observation_ok="false" [3m])) or vector(0)` |
| `AppSignalMissing` | `sum(absent_over_time({swarm_service="studio_app"} \|= "plugin_tenant_lifecycle_health" [5m])) or vector(0)` |
| `ProvisionerSignalMissing` | `sum(absent_over_time({swarm_service="studio_provisioner"} \|= "plugin_tenant_lifecycle_health" [5m])) or vector(0)` |

Die 3-Minuten-Fenster umfassen drei periodische Stichproben; die zusätzliche Pending-Zeit unterdrückt kurze Übergänge. `StaleClaim` berücksichtigt durch diesen Vorlauf das 150-Sekunden-Recovery-Budget. Die Signalausfallregeln erkennen sowohl einen ausgefallenen Worker als auch unterbrochenes Loki-Ingest. Bei einem `ObservabilityUnavailable`-Alarm sind die Stall-Zähler unbekannt, nicht null. Nach Auslösung mit dem untenstehenden Entscheidungspfad verifizieren und erst nach zwei gesunden Stichproben schließen.

Die vorbereiteten Alarmklassen entsprechen dem bestehenden Metrikvertrag:

## Vorbereitete Alarmklassen

| Alertklasse                | Sichere Aussage                                                                                           | Erste Prüfung                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `LaneUnavailable`          | Eine Worker-Lane meldet nicht bereit.                                                                       | Betroffenen Service, Task-Neustarts und Runtime-Health prüfen.                    |
| `StaleClaim`               | Ein öffentlicher Studio-Job-Claim besitzt seit mehr als 120 Sekunden keinen frischen Heartbeat.           | Ledger und Studio-Job gemeinsam lesen; das 150-Sekunden-Recovery-Budget beachten. |
| `DueWorkStalled`           | Ein Studio-Job ist seit mehr als 120 Sekunden fällig oder eine Retry-/Recheck-Deadline ist überschritten. | Lane, persistierte Deadline und Jobstatus korrelieren.                            |
| `GenerationWithoutOwner`   | `desired_generation > completed_generation`, aber kein aktiver öffentlicher Owner-Job ist vorhanden.      | Terminalevent und aktuellen Lifecycle-Vertrag prüfen.                             |
| `ObservabilityUnavailable` | Der aggregierte, read-only DB-Snapshot konnte nicht erhoben werden.                                       | Datenbankverbindung, Migration `0091` und Funktionsrechte prüfen.                 |

Prometheus-Regeln werden erst mit dem real betriebenen OTEL-Pfad aus Issue #1237 aktiviert. Die LogQL-Abfragen ersetzen keine Metrikflussprüfung für diesen späteren Pfad.

## Autorisierte Korrelation

Die folgenden Abfragen werden ausschließlich in einem berechtigten, instanzgebundenen Diagnosekontext ausgeführt. Platzhalter werden als Parameter gebunden; IDs werden nicht in öffentliche Tickets, Dashboards oder Chatkanäle kopiert.

```sql
BEGIN;
SET LOCAL ROLE iam_app;
SELECT set_config('app.instance_id', :'instance_id', true);

SELECT
  lifecycle.plugin_id,
  lifecycle.desired_operation,
  lifecycle.desired_generation,
  lifecycle.claimed_generation,
  lifecycle.completed_generation,
  lifecycle.readiness_status,
  lifecycle.active_job_id,
  lifecycle.retry_kind,
  lifecycle.retry_after,
  lifecycle.next_recheck_at,
  lifecycle.error_code,
  lifecycle.recovery_error_code,
  lifecycle.updated_at,
  job.status AS job_status,
  job.attempts,
  job.scheduled_at,
  job.started_at,
  job.heartbeat_at,
  job.finished_at
FROM iam.instance_plugin_lifecycle AS lifecycle
LEFT JOIN iam.studio_jobs AS job
  ON job.id = lifecycle.active_job_id
 AND job.instance_id = lifecycle.instance_id
WHERE lifecycle.instance_id = :'instance_id'
  AND lifecycle.plugin_id = :'plugin_id';

SELECT event_type, attempts, created_at
FROM iam.studio_job_events
WHERE instance_id = :'instance_id'
  AND job_id = :'job_id'
ORDER BY created_at DESC;

ROLLBACK;
```

Für den öffentlichen Betriebsvertrag ist `iam.studio_jobs` die alleinige Lease-Evidenz. Aus Instanz, Plugin und Job lassen sich die erwarteten Queue-Schlüssel deterministisch ableiten:

- Ausführung: `studio-job:<job_id>`
- Lease-Recovery: `plugin-tenant-lifecycle-recovery:<instance_id>:<plugin_id>`
- Retry oder Pending-Recheck: `plugin-tenant-lifecycle-retry:<instance_id>:<plugin_id>`

Die Metrik behauptet nicht, dass ein privater Graphile-Key fehlt. Eine Key-Existenzprüfung ist nur als berechtigte Tiefendiagnose durch einen Datenbankoperator zulässig, nachdem Ledger, Studio-Job und Event geprüft wurden. Sie ist keine normale App-Abfrage und keine Grundlage der Alerts:

```sql
-- Nur mit dem eingeschränkten Worker-/Diagnoseprincipal und freigegebener Incident-Referenz.
SELECT key, run_at, attempts, max_attempts
FROM graphile_worker.jobs
WHERE key = :'expected_deterministic_key';
```

Payloads, Fehlertexte, Datenbank-URLs und Secrets werden dabei nicht selektiert oder weitergegeben.

### Übergang bestehender Waste-Provisionierungsjobs

Der aktuelle Waste-Vertrag legt neue Tenant-Provisionierungsjobs auf `waste-provisioning` mit dem Task `studio_job_execute_privileged`. Ein Rollout verschiebt bereits gespeicherte Graphile-Jobs nicht von selbst. Vor und nach dem Rollout sind daher aktive Waste-Lifecycle-Jobs tenantgebunden über das obige Ledger sowie, falls nötig, durch einen berechtigten Datenbankoperator über den deterministischen Key `studio-job:<job_id>` zu inventarisieren. Für den Key werden nur Queue, Task-Identifier, Versuche und Lock-Zustand gelesen; Payloads und Secrets bleiben unberührt. `iam.studio_jobs.queue_name` bezeichnet bei einem Altjob weiterhin die bei seiner Anlage gespeicherte Queue und ist kein Beweis für die aktuelle Graphile-Zuordnung.

Ein noch `queued` oder `retrying` geführter Lifecycle-Job wird durch die bestehende Lifecycle-Kontrolle mit demselben Job-Key auf die registrierte Queue und privilegierte Task-Lane erneut eingereiht. Das ist im PostgreSQL-/Graphile-Vertragstest für einen Altjob und für genau einen fachlichen Abschluss geprüft. Ist der Job bereits `running` oder in Graphile gelockt, wird er nicht manuell verschoben: zuerst Lease, Heartbeat und Recovery-Ausgang prüfen. Graphile kann beim erneuten Enqueue eines gesperrten Keys einen neuen technischen Auftrag erzeugen; deshalb keine pauschalen Re-Enqueues, SQL-Updates, Löschungen oder Entsperrungen. Terminale beziehungsweise bewusst abgebrochene fachliche Jobs werden nicht automatisch neu gestartet.

Die Nachprüfung korreliert pro betroffenem Tenant den Lifecycle-Owner, den einen aktiven Studio-Job, dessen Events und den technischen Key. Für noch aktive Provisionierung müssen Queue `waste-provisioning` und Task `studio_job_execute_privileged` gelten; abgeschlossene Läufe benötigen genau einen fachlichen Terminalzustand. Abweichungen bleiben ein Incident zur begrenzten Einzelfallprüfung. Der reguläre Rollout und seine Freigaben folgen ausschließlich dem verlinkten Studio-Rollout-Prozess.

## Entscheidungspfad

### SSF ohne konfigurierte Plugin-Datenbank

SSF ist im Plugin-Manifest `optional`: Neue Instanzen erhalten das Modul nur
durch explizite Zuweisung. Vor einem Update von der bisherigen Richtlinie
`automatic` auf `optional` sind bestehende, weiter benötigte SSF-Zuweisungen
über die Modulverwaltung ausdrücklich zu aktivieren (`manualOverride=enabled`).
Bestehende manuelle Deaktivierungen bleiben erhalten. Der reguläre Studio-Server
betreibt SSF nicht; dort darf das Modul bei der Instanzanlage nicht ausgewählt
werden.

Der Fehler `ssf.root-database-not-configured` bezeichnet eine fehlende
`SVA_STUDIO_SSF_ROOT_DATABASE_URL`. Dieser Konfigurationsfehler beendet den
SSF-Reconcile-Auftrag terminal; automatische Wiederholungen können die fehlende
Konfiguration nicht herstellen. Vorübergehende Datenbank- oder Netzwerkfehler
bleiben davon unabhängig wiederholbar. Die SSF-Readiness bleibt gesperrt.

Zuerst prüfen, ob SSF auf der betroffenen Installation vorgesehen ist. Falls ja,
Plugin-Datenbank und Verbindungswerte über den regulären Rollout bereitstellen
und anschließend die autorisierte Lifecycle-Reparatur für den aktuellen
Sollzustand auslösen. Falls SSF dort nicht vorgesehen ist, die zuständige
Aktivierungsrichtlinie korrigieren. Historische Jobzeilen werden dabei nicht
gelöscht oder direkt umgeschrieben.

### Ausgeschöpftes Job-Budget

Ein retrybarer Plugin-Fehler darf das endgültige Fehlerurteil des Workers nicht
überschreiben. Nach dem letzten zulässigen Jobversuch bleibt der Lifecycle
`blocked` mit `retry_kind=terminal` und dem konkreten Plugin-Fehlercode; es gibt
bei unverändertem aktuellem Lifecycle-Vertrag keine automatische neue Generation
mit zurückgesetztem Versuchszähler. Eine
bereits geplante Lifecycle-Kontrolle startet für diesen unveränderten terminalen
Zustand ebenfalls keinen neuen Job.

Die Vertragsrevision wird beim Anfordern einer Generation gemeinsam mit deren
Sollzustand gespeichert. Nach erfolgreichem Vertrag A und fehlgeschlagenem
Vertrag B erkennt die Planung dadurch B als bereits versucht: Bei terminalem
Fehler bleibt sie gesperrt, bei retrybarem Fehler gilt dessen Frist. Ein neuer
Vertrag C bleibt ein Anlass für Reconcile. Die zuletzt erfolgreiche
Readiness-Revision und Abschlussgeneration werden dabei nicht vorgezogen;
Readiness aus A belegt keine Bereitschaft für B.

Historische Zeilen können noch A als Vertragsrevision enthalten, obwohl B
bereits fehlgeschlagen ist. Ohne direkte Datenkorrektur kann nach dem Rollout
ein weiterer, durch das Job-Budget begrenzter B-Lauf entstehen. Dessen Start
speichert B; die Live-Abnahme muss anschließend den terminalen Zustand und
mehrere automatische Kontrollen ohne weitere Generation nachweisen.

Die Ursache zuerst über Jobevent und Lifecycle diagnostizieren und beheben.
Danach die bestehende autorisierte Retry-/Repair-Aktion verwenden. Sie darf eine
neue Generation anlegen; ein direktes Zurücksetzen von Attempts oder Queue-Zeilen
ist weiterhin unzulässig. Dieser Fix ersetzt keinen Live-Nachweis für historische
SSF-Reconcile-Jobs.

### Allgemeine Recovery

1. **Abwarten:** Bei einem frischen Heartbeat, einer noch nicht fälligen Deadline oder innerhalb des dokumentierten 150-Sekunden-Recovery-Budgets keine zweite Arbeit anlegen.
2. **Gezielt erneut einplanen:** Erst nach Ablauf des Recovery-Budgets und nur über die vorhandene autorisierte Retry-/Repair-Aktion. Die Aktion erzeugt eine neue Generation beziehungsweise reconciliert idempotent; sie manipuliert keine Queue-Zeile direkt.
3. **Eskalieren:** Bei wiederholtem Lane-Fail-fast, fehlendem Terminalevent, widersprüchlicher Generation, unbekanntem `reason_code`, fehlender Migration/Funktionsberechtigung oder nicht eindeutig ableitbarem Key. Vor einer Änderung Logs und Traces redigiert sichern.

Verboten sind direkte `UPDATE`/`DELETE`-Befehle auf Lifecycle-, Studio-Job- oder Graphile-Tabellen, manuelles Zurücksetzen von Attempts oder Heartbeats, freie Enqueues und ad-hoc Prozessneustarts als vermeintlicher Konvergenznachweis.

## Abschlussnachweis

Ein Incident ist erst abgeschlossen, wenn:

- die zuständige Lane wieder `ready` ist,
- `desired_generation = completed_generation` oder eine dokumentierte spätere Deadline besteht,
- kein überalterter Claim beziehungsweise fälliger Job mehr gemessen wird,
- Jobstatus und genau ein Terminalevent übereinstimmen,
- der sichere Aggregatsnapshot keinen blockierenden Zustand mehr meldet.

Nach Umsetzung von Issue #1237 gehört zusätzlich die Auflösung des zugehörigen Alerts nach der nächsten Export-, Scrape- und Auswertungsrunde zum Abschlussnachweis.
