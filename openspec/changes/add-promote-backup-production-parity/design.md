## Context

Der bestehende `Promote`-Workflow kann für Staging gehärtete Migrations- und Bootstrap-One-shot-Jobs ausführen. Production blockiert diese Modi derzeit fail-closed. MinIO steht als S3-kompatibler Speicher unter `https://fileserver.smart-village.app` bereit; für Staging und Production existieren getrennte Buckets.

## Goals / Non-Goals

### Goals

- Staging und Production verwenden denselben technischen Ablauf für schema- oder bootstraprelevante Rollouts.
- Jeder solcher Rollout erzeugt und validiert ein neues, extern gespeichertes Postgres-Backup vor der ersten Mutation.
- Der Rollout bleibt fail-closed, wenn Backup, Upload oder Archivprüfung nicht erfolgreich sind.
- Produktionsänderungen bleiben bewusst manuell promotet und imagegebunden.

### Non-Goals

- Kein Backup für reine App-Deploys ohne Migrations- oder Bootstrap-Job.
- Kein automatisches Restore und kein automatisches Datenbank-Rollback.
- Keine neue allgemeine Backup-Plattform oder tägliche Backup-Scheduling-Lösung.

## Decisions

### Gemeinsamer Backup-Job vor mutierenden One-shot-Jobs

Der Workflow entscheidet nach Gate-Auswertung, ob Migration oder Bootstrap ausgeführt werden muss. Wenn mindestens einer dieser Jobs erforderlich ist, startet er genau einen Backup-Job vor beiden Jobs. Ohne erfolgreich bestätigtes Backup erfolgt keine Migration, kein Bootstrap und kein App-Deploy.

### Isolierter Swarm-Job und externer Speicher

Der Backup-Job läuft als eindeutiger temporärer Stack im vorhandenen internen Overlay-Netz des Zielstacks. Er verwendet die gleichen Datenbank-Verbindungsinformationen wie die Migrationsjobs, enthält aber keinen `app`-, `postgres`- oder `redis`-Service. Er erzeugt einen PostgreSQL-Custom-Dump und lädt ihn ausschließlich in MinIO hoch:

| Umgebung | Bucket |
| --- | --- |
| `staging` | `studio-db-backup-staging` |
| `prod` | `studio-db-backup-production` |

Die Zieladresse wird aus den Environment-Secrets und -Variablen abgeleitet. Access-Key und Secret-Key sind in jedem GitHub-Environment getrennt hinterlegt, auch wenn technisch derselbe globale MinIO-Account verwendet wird.

### Objektidentität und Validierung

Der Objektpfad enthält mindestens Umgebung, UTC-Zeitpunkt, Ziel-Digest und eindeutige Run-ID. Der Job bildet vor dem Upload eine SHA-256-Prüfsumme, speichert sie als Objektmetadatum oder gleichnamiges `.sha256`-Objekt und lädt das Archiv anschließend erneut herunter. Größe, der lokal berechnete SHA-256-Wert und der SHA-256-Wert des heruntergeladenen Objekts müssen übereinstimmen; zusätzlich prüft `pg_restore --list` die Lesbarkeit. Der S3-ETag ist kein Integritätsnachweis. Nur ein vorhandenes, nicht leeres und lesbares Archiv mit übereinstimmender Prüfsumme gilt als Backup-Erfolg.

### Schlanker Nachweis der Staging-Parität

Ein erfolgreich abgeschlossener Staging-Promote schreibt eine redigierte maschinenlesbare Evidenz mit Ziel-Digest, Staging-Workflow-Run-ID, Abschlusszeit und bestandenem Postflight als GitHub-Actions-Artefakt. Der Production-Workflow erhält dafür ausschließlich die Berechtigung `actions: read` und akzeptiert die Evidenz nur, wenn das Ziel-Digest exakt übereinstimmt. Fehlt die Evidenz, ist sie nicht erfolgreich oder ist das Digest abweichend, bleibt Production vor Backup und jeder Mutation fail-closed.

### Bucket-Lifecycle als Betriebsprämisse

Vor der Abnahme muss der Storage-Betrieb für beide vorhandenen Buckets eine Lifecycle-Regel konfigurieren und deren Aufbewahrungsdauer im Swarm-Runbook dokumentieren. Der Change führt weder eine Scheduling-Plattform noch Object-Lock, Versionierung oder einen Restore-Drill ein.

### Production-Parität mit kontrollierten Schutzmechanismen

Production erhält dieselben `run`-Modi und dieselbe Reihenfolge wie Staging. Zusätzlich muss der Ziel-Digest in Staging erfolgreich verifiziert worden sein, und jede Production-Datenmutation braucht einen Wartungsfenster-Verweis. `prod` bleibt ein manuell ausgelöster Workflow; `auto` bleibt ausschließlich Dev vorbehalten.

### Evidenz und Geheimnisschutz

Summary und Artefakte enthalten nur Bucket, Objektpfad, Zeit, Größe, Prüfsumme, Ergebnis und Recovery-Hinweis. Sie enthalten keine Dumps, `.env`-Dateien, MinIO-Credentials, Datenbankzugangsdaten oder unredigierte SQL-/Tool-Ausgaben.

## Risks / Trade-offs

- Das Backup verlängert schema- und bootstraprelevante Deploys und benötigt ausreichenden temporären Speicher im Job-Container. Dies ist gegenüber einem unbelegten Recovery-Pfad bewusst akzeptiert.
- `pg_restore --list` bestätigt ein lesbares Archiv, aber keine vollständige Wiederherstellung in einer Datenbank. Ein regelmäßiger Restore-Drill bleibt eine separate, explizite Betriebsaufgabe.
- Globale MinIO-Credentials besitzen einen größeren Berechtigungsumfang als getrennte Service-Accounts. Die Implementierung begrenzt ihren Gebrauch auf Environment-Secrets; ein späterer Wechsel auf bucket-spezifische Credentials bleibt möglich.

## Migration Plan

1. Backup-Job-Image, Compose-Definition und sichere MinIO-Konfiguration implementieren.
2. Backup-Job in `Promote` vor Migration und Bootstrap integrieren und strukturierte Evidenz ergänzen.
3. Production-`run`-Gates auf denselben Ablauf wie Staging erweitern, inklusive Staging-Digest-Paritätsnachweis.
4. Unit-, Workflow-, Compose-Render- und Sicherheitsprüfungen ergänzen.
5. Architektur, Runbook und Recovery-Dokumentation aktualisieren.
6. Zuerst Staging mit Migration oder Bootstrap ausführen und das MinIO-Backup prüfen; anschließend denselben verifizierten Digest kontrolliert nach Production promoten.

## Open Questions

- Soll die Prüfsumme als Objekt-Metadatum oder als separates, gleichnamiges `.sha256`-Objekt gespeichert werden?
