# Betrieb des Plugin-Tenant-Lifecycles

## Zweck und Grenzen

Dieses Runbook beschreibt die nicht-destruktive Diagnose blockierter Plugin-Tenant-Lifecycle-Läufe. Reguläre Rollouts erfolgen ausschließlich nach dem [Studio-Rollout-Prozess](../guides/studio-rollout-process.md). Das Runbook autorisiert weder direkte Statusänderungen noch das Löschen oder manuelle Entsperren von Studio- oder Graphile-Jobs.

Die Lifecycle-Metriken sind absichtlich fleetweit aggregiert. Sie enthalten nur die begrenzten Dimensionen `lane`, `status` und `reason_code`. Instanz-, Plugin-, Job-, Request- und Korrelations-IDs erscheinen nicht als Metriklabels. Die DB-Aggregate können aus mehreren Runtime-Prozessen exportiert werden; ein späterer Prometheus-Vertrag dedupliziert sie deshalb mit `max by (reason_code)`. Lane-Metriken beschreiben dagegen den jeweils eigenen Worker-Prozess und werden mit `min by (lane)` bewertet.

## Betriebsstatus der Alarmierung

Die produktiven Studio-Profile exportieren derzeit keine OTEL-Metriken an einen betriebenen Collector. Lifecycle-Alerts sind deshalb bewusst nicht in der aktiven Prometheus-Regeldatei enthalten: `absent(...)` würde sonst gesunde Lanes als Ausfall melden, während Stale-Work-Metriken Prometheus nicht erreichen. [Issue #1237](https://github.com/smart-village-solutions/sva-studio/issues/1237) verfolgt den produktiven Exportpfad und die anschließende Aktivierung.

Bis dahin dienen der sichere Aggregatsnapshot, Runtime-Logs und die nachfolgenden berechtigten Diagnoseabfragen als Betriebsnachweis. Die vorbereiteten Alarmklassen bleiben der Zielvertrag für Issue #1237:

## Vorbereitete Alarmklassen

| Alertklasse                | Sichere Aussage                                                                                           | Erste Prüfung                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `LaneUnavailable`          | Die privilegierte Lane fehlt oder meldet nicht bereit.                                                    | Provisioner-Service, Task-Neustarts und Runtime-Health prüfen.                    |
| `StaleClaim`               | Ein öffentlicher Studio-Job-Claim besitzt seit mehr als 120 Sekunden keinen frischen Heartbeat.           | Ledger und Studio-Job gemeinsam lesen; das 150-Sekunden-Recovery-Budget beachten. |
| `DueWorkStalled`           | Ein Studio-Job ist seit mehr als 120 Sekunden fällig oder eine Retry-/Recheck-Deadline ist überschritten. | Lane, persistierte Deadline und Jobstatus korrelieren.                            |
| `GenerationWithoutOwner`   | `desired_generation > completed_generation`, aber kein aktiver öffentlicher Owner-Job ist vorhanden.      | Terminalevent und aktuellen Lifecycle-Vertrag prüfen.                             |
| `ObservabilityUnavailable` | Der aggregierte, read-only DB-Snapshot konnte nicht erhoben werden.                                       | Datenbankverbindung, Migration `0091` und Funktionsrechte prüfen.                 |

Zeitbudgets für Warning und Critical werden erst mit dem real betriebenen OTEL- und Prometheus-Pfad aus Issue #1237 verbindlich aktiviert und dort durch einen gezielten Metrikfluss nachgewiesen.

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

## Entscheidungspfad

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
