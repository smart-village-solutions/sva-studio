# Betrieb tenantbezogener Waste-Datenbanken

## Geltungsbereich

Dieses Runbook beschreibt Diagnose und Wiederherstellung für automatisch provisionierte Waste-Datenbanken. Reguläre Rollouts erfolgen ausschließlich nach dem [Studio-Rollout-Prozess](./studio-rollout-process.md). Direkte Datenbank- oder Stack-Eingriffe sind nur Incident-Recovery und kein zweiter Standardpfad.

## Kanonischer Zustand

Der zentrale Zustand liegt in `iam.instance_waste_provisioning`. `ready` erlaubt Runtime-Zugriff, `provisioning` hält ihn fail-closed, `failed` bietet die berechtigte Retry-Aktion und `disabled` erhält Datenbank sowie Sicherungen bei gesperrter Runtime.

```sql
SELECT instance_id, status, desired_generation, completed_generation,
       active_job_id, error_code, requested_at, started_at, completed_at, updated_at
FROM iam.instance_waste_provisioning
ORDER BY updated_at DESC;
```

Die allgemeine Interface-UI ist keine Diagnosequelle: pluginverwaltete Waste-Interfaces sind dort absichtlich unsichtbar und nicht mutierbar.

## Hängende Provisionierung

Als verdächtig gilt `provisioning`, wenn weder Jobfortschritt noch `updated_at` innerhalb des betrieblich festgelegten Zeitfensters fortschreiten. Dabei werden Registry und Job gemeinsam geprüft:

```sql
SELECT provisioning.instance_id, provisioning.status, provisioning.active_job_id,
       job.status AS job_status, job.progress_phase, job.heartbeat_at,
       provisioning.error_code
FROM iam.instance_waste_provisioning provisioning
LEFT JOIN iam.studio_jobs job
  ON job.id = provisioning.active_job_id
 AND job.instance_id = provisioning.instance_id
WHERE provisioning.status IN ('provisioning', 'failed');
```

Vorgehen:

1. Prüfen, ob der vorhandene `provisioner`-Service läuft und die privilegierte Worker-Lane aktiv ist.
2. Ausschließlich redigierte Fehlercodes, Jobphase und Korrelation erfassen; keine Jobpayloads, URLs oder Secrets kopieren.
3. Bei `failed` die Studio-Retry-Aktion verwenden. Sie reconciled Datenbank, Rollen, Schema und Interface idempotent.
4. Bei weiterlaufendem Job keine zweite manuelle Provisionierung starten.
5. Wiederholte Drift- oder Rechtefehler eskalieren; Datenbank oder Rollen nicht löschen, da bereits Fachdaten vorhanden sein können.

## Schema- oder Berechtigungsdrift

Der Provisionierer prüft nach jedem Reconcile Schemaobjekte sowie Rechte der Studio- und Public-Runtime. Ein unvollständiger Zustand bleibt `failed`; das Interface wird nicht aktiviert.

- Fehlende additive Schemaobjekte: Retry/Reconcile über den bestehenden Jobpfad.
- Unerwartete oder inkompatible Schemaobjekte: keine automatische Löschung; Dump und Diagnose sichern, dann fachliche Migration freigeben.
- Fehlende Grants: Retry/Reconcile rekonstruiert den Sollzustand.
- Fremder Owner, erhöhte Runtime-Rechte oder abweichende Datenbankidentität: Sicherheitsincident; Runtime bleibt gesperrt.

## Backup-Fehler

Ein Waste-Backup ist nur erfolgreich, wenn das Registry-Inventar vollständig verarbeitet wurde. Das Ergebnisobjekt enthält `inventoryCount` und pro Tenant Status, Objektpfad, Größe und SHA-256.

1. Registry-Einträge mit `ready` oder `disabled` zählen und mit `inventoryCount` vergleichen.
2. Für jeden Tenant ein Dump unter `<umgebung>/waste/<instance_id>/` und einen erfolgreichen `archive-validate`-Schritt verlangen.
3. `waste_inventory_*`-Fehler als Registry-/Identitätsproblem behandeln; keine freie Datenbank als Ersatz in den Request schreiben.
4. Bei Dump-, Upload- oder Prüfsummenfehlern den gesamten fail-closed Lauf mit neuer Request-ID wiederholen.
5. Aufbewahrungsregeln gelten für alle Tenantpräfixe einschließlich `disabled`; Deaktivierung löscht keine Sicherung.

## Restore-Probe

Der Workflow **Waste Database Restore Drill** verlangt Umgebung, `tenant_instance_id`, exakten Dump-Pfad, SHA-256 und Freigabereferenz. Vor Mutation prüft der Agent:

- Pfad `<umgebung>/waste/<tenant_instance_id>/...`,
- vorhandenen `ready`- oder `disabled`-Registry-Eintrag,
- exakte registrierte Datenbank,
- daraus abgeleitete isolierte Drill-Datenbank und Owner-Rolle.

Ein Restore schreibt nie in die aktive Tenant-Datenbank und nie still in den Bestand eines anderen Tenants. Erfolgreiche Evidenz umfasst Zielprüfung, Sicherheitsdump, Runtime-Reconciliation, Rechteprobe und fachliche Tabellenchecks.

## Rotation des Provisionierer-Secrets

Die externen, umgebungsgetrennten Swarm-Secrets `studio_staging_waste_database_provisioner_password_v1` und `studio_waste_database_provisioner_password_v1` sind die Referenzen für die jeweils eingeschränkte PostgreSQL-Provisioniererrolle im vorhandenen Provisioner- und Backup-Agent-Pfad.

1. Neues starkes Secret als neue versionierte Swarm-Secret-Referenz anlegen.
2. Über den regulären Rollout die PostgreSQL-Rolle und beide Consumer auf dieselbe neue Version umstellen.
3. Provisioner-Readiness, einen idempotenten Tenant-Reconcile und einen vollständigen Waste-Backup-Lauf prüfen.
4. Erst danach die alte Secret-Version aus den Stacks entfernen und gemäß Secret-Richtlinie löschen.

Während einer uneinheitlichen Rotation werden keine Tenant-Aktivierungen oder Restore-Proben gestartet. Das Secret, sein Klartextwert und tenantbezogene Runtime-URLs dürfen nicht in Logs, Tickets oder Evidenz erscheinen.

## Alerting-Mindestumfang

Die Betriebsüberwachung soll mindestens melden:

- `provisioning` ohne Fortschritt oder Heartbeat,
- wiederholtes `failed` mit stabilem redigiertem Fehlercode,
- fehlgeschlagenes oder unvollständiges Waste-Inventar-Backup,
- ausgebliebene Sicherung eines `disabled`-Bestands,
- fehlgeschlagene Runtime-Rechteprobe,
- überfällige Restore-Probe oder Secret-Rotation.

Alerts korrelieren Instanz, Modul, Job-ID, Phase und Fehlercode, enthalten aber weder Datenbank-URL noch Credentials oder Fachdaten.
