## Context

Plugin-Operations bieten bereits persistente Jobs mit Status, Fortschritt,
Fehlern und hostgeführtem Execution-Context. Waste nutzt diese Plattform für
tenantbezogene Datenbankprovisionierung, koppelt den Lifecycle aber noch an
Waste-spezifische Hostpfade. SSF benötigt dieselben Betriebsfähigkeiten bei
einer gemeinsamen, RLS-geschützten Datenbank.

## Goals / Non-Goals

### Goals

- Einen kleinen generischen Tenant-Lifecycle über vorhandenen Jobs definieren.
- Aktivierung, Fachprovisionierung und Readiness getrennt, aber korrelierbar
  halten.
- Pluginstatus ohne pluginId-spezifische Host-UI darstellen.
- Waste und SSF trotz unterschiedlicher Persistenzmodelle unterstützen.

### Non-Goals

- Keine gemeinsame Datenbanktopologie oder Schema-DSL.
- Keine fachlichen Migrationen im Core.
- Keine installationsweiten Runtime-Service-APIs.
- Keine automatische Datenlöschung.

## Decisions

### Der System-Assurance-Vertrag ist vor Folgeänderungen verbindlich

Die vollständigen Zustands-, Boundary-, Crash- und Evidenzmatrizen sowie die
stabilen Invarianten `AUTH-01` bis `OBS-01` stehen im
[System-Assurance-Vertrag](./assurance.md). Er entscheidet für diesen Change
die gemeinsame PostgreSQL-Transaktion für Lifecycle-Ledger, Studio-Job,
Job-Event und Graphile-Wake-up. Die Folgeumsetzung beginnt erst nach expliziter
menschlicher Freigabe dieses Vertrags.

### Lifecycle ist ein Plugin-Beitrag über bestehende Operations

Ein Plugin kann Lifecycle-Fähigkeiten und zugehörige Jobtypen deklarieren. Der
Host startet sie nur innerhalb eines validierten, aktiven Instanzkontexts und
stellt Logger, Progress, Abbruchsignal und Korrelationsdaten bereit. Der
persistente Studio-Job und seine Job-Events bilden denselben Auditnachweis wie
bei anderen Plugin-Operations; ein freier pluginseitiger Auditkanal gehört
nicht zum Lifecycle-Vertrag.

Eine Lifecycle-Operation ist genau dann abbrechbar, wenn sowohl ihr Beitrag als
auch der registrierte Job-Handler `supportsCancellation` deklarieren. Eine
Abweichung in beide Richtungen wird vor Sollgeneration und Jobanlage
fail-closed abgelehnt. Fortschritt, Fehler, Retry, Korrelation und Abbruch
werden nicht lifecycle-spezifisch dupliziert, sondern über den vorhandenen
Plugin-Operations-Vertrag persistiert.

### Sollgeneration und Claim verhindern konkurrierende Läufe

Jede Aktivierungs- oder Reparaturmutation erhöht eine Sollgeneration. Ein
Lifecycle-Job claimt Plugin, Instanz und Generation atomar. Veraltete Jobs
dürfen keinen neueren Zustand überschreiben.

Der Host persistiert diesen Vertrag in `iam.instance_plugin_lifecycle` mit
`desired_generation`, `claimed_generation`, `completed_generation` und
`active_job_id`. Eine neue Mutation erhöht `desired_generation` nur, wenn kein
älterer Claim oder aktiver Job existiert; konkurrierende Starts werden stabil
abgelehnt. Der anschließend erzeugte Studio-Job darf nur die exakt aktuelle
Operation und Generation claimen. Abschluss und Fehler werden ausschließlich
akzeptiert, wenn Job-ID, Instanz, Plugin, Claim- und Sollgeneration weiterhin
übereinstimmen. Eine leere Update-Rückgabe ist damit ein deterministischer
Stale- oder Konkurrenzkonflikt und kein wiederholbarer Schreibfehler; ein davor
bereits erzeugter, aber unterlegener Job wird terminal markiert und nicht als
verwaister Queue-Eintrag zurückgelassen.
Lifecycle-Request, Studio-Job, Claim, Execution-Wake-up und Recovery-Wake-up
werden mit demselben PostgreSQL-Executor in einer Transaktion geschrieben.
Terminale Korrelation, Jobstatus und genau ein Terminalevent werden ebenfalls
gemeinsam committet. Der partielle Eindeutigkeitsconstraint auf Job und Attempt
macht Redelivery idempotent; eine leere CAS-Rückgabe ist ein Konflikt.

Nach dem Commit einer Aktivierungsrichtlinie oder einer neuen Instanz plant der
Host fehlende oder retryable `provision`-Läufe für alle in der Instanz effektiv
aktiven Lifecycle-Plugins über denselben Lifecycle-Orchestrator. Damit werden
auch manuell aktivierte `optional`-Plugins berücksichtigt. Suspendierte
Lifecycle-Zustände bleiben bis zu einer expliziten Reaktivierung ausgeschlossen.
Die Aktivierungs- und IAM-Transaktion schreibt für jedes betroffene aktive
Lifecycle-Plugin einen persistenten Reconcile-Intent samt Graphile-Wake-up.
Ein rein speicherinterner Post-Commit-Hook ist kein Konvergenznachweis. Aktive
Jobs sowie zur aktuellen Check-Deklaration
passende, nicht blockierende Readiness-Evidenz verhindern eine erneute
Provisionierung; veraltete Evidenz löst dagegen einen neuen Lauf aus. Der Fleet-Reconcile
läuft nach Handler-Registrierung im Hintergrund und blockiert keinen normalen
Request mit fleetweiter Arbeit.

Verzögerte Retries werden pro Instanz und Plugin mit einem eigenen persistenten
Wake-up eingeplant. Dadurch kann ein späterer Retry eines Plugins den früheren
Retry eines anderen Plugins derselben Instanz nicht ersetzen. Das Cockpit pollt
Readiness sowohl bei einem aktiven Job als auch während eines persistierten
retryable Retry-Fensters und beendet das Polling nach der serverseitig
beobachteten Erholung.

`iam.studio_jobs` ist die alleinige hostlesbare Lease-Evidenz; private
Graphile-Tabellen sind kein Bestandteil des Vertrags. Der Owner ist
`(jobId, attempt, workerId)`. Start, Fortschritt, Heartbeat und Abschluss
verwenden CAS auf Owner und erwarteten Status. Heartbeats laufen alle 30
Sekunden. Nach 120 Sekunden verweigert PostgreSQL weitere Owner-Schreibvorgänge;
Recovery lässt frische Leases unangetastet, fenced stale Leases und plant
spätestens innerhalb weiterer 30 Sekunden eine neue Lifecycle-Generation.
Plan 041 verantwortet weiterhin Prozess- und Lane-Supervision, nicht diesen
Lease- und Resume-Vertrag.

Idempotenz bleibt zweistufig: Der Host verhindert doppelte Jobanlage über den
vorhandenen Studio-Job-Idempotenzvertrag; der Plugin-Handler reconciliiert die
Fachartefakte für die übergebene Sollgeneration. Das Lifecycle-Ledger enthält
keine pluginfachlichen Ressourcen und ersetzt keine plugin-eigene
Migrationshistorie.

### Readiness ist ein gemeinsamer Ergebnisvertrag

Plugins melden `pending`, `ready`, `degraded` oder `blocked` sowie namespaced
Checks. Der Host berechnet den Aggregatstatus bei jedem Lesen gegen die aktuell
deklarierten Checks und deren aktuelle `required`-Kennzeichnung neu; ein alter
Aggregatwert darf eine verschärfte Deklaration nicht umgehen. Texte und
fachliche Diagnose bleiben beim Plugin.
Ein persistiertes `pending` enthält immer `next_recheck_at`; derselbe Commit
plant den serverseitigen Wake-up. Vertragsrevisionen werden vor historischer
Terminal- oder Retry-Evidenz ausgewertet.

### Aktivierung und Fachbereitschaft sind getrennt

Ein Plugin kann aktiv, aber noch nicht fachlich bereit sein. Tenant-Routen und
interne Fachzugriffe bleiben bis zur erforderlichen Readiness fail-closed. Bei
`required` blockiert fehlende Readiness zusätzlich die Installationsbereitschaft.

### Autorisierung stammt ausschließlich aus Hostevidenz

Autorisierbare Plugin-Beiträge besitzen vor Snapshot-Veröffentlichung eine
explizite vollständige Access-Anforderung. Plugin-Deskriptoren dürfen keine
statische `resourceCapability` tragen. Bei ressourcenbezogenen Server-Handlern
löst ausschließlich der Host die Capability aus validiertem Request-Kontext
und autoritativen Fachdaten auf und übergibt sie getrennt von der statischen
Anforderung an den zentralen Access-Evaluator.

Für Service-Credentials trennt der Host das Lesen des Readiness-Modells von
jeder ausführbaren Lifecycle-Operation. Der Request-Body wird validiert, bevor
die Operation auf ihre fully-qualified Action abgebildet wird. Browser-Sessions
behalten die bestehende Plattformautorisierung und bei Mutationen den
CSRF-Schutz.

### Persistenz bleibt plugin-owned

Der gemeinsame Vertrag umfasst Joblauf, Secret-Zugriff nach Capability,
Readiness, Backup-Hinweise und Diagnose. Ob ein Plugin eine Datenbank pro Tenant
oder eine gemeinsame RLS-Datenbank verwendet, entscheidet und testet das
Plugin.

## Risks / Trade-offs

- Zu allgemeine Hooks können zu einem Workflow-Framework anwachsen. → Nur fünf
  konkrete Lifecycle-Operationen und ein Readiness-Vertrag.
- Waste-Migration kann bestehendes Verhalten verändern. → Adapter zuerst,
  unveränderte Fachoperationen und Regressionstests.
- Plugin-Fehler könnten die Instanzoberfläche dominieren. → Core- und
  Pluginstatus getrennt, aber korrelierbar anzeigen.

## Migration Plan

1. Lifecycle- und Readiness-Verträge im SDK ergänzen.
2. Host-Orchestrierung auf bestehende Plugin-Operations aufsetzen.
3. Waste-Provisionierung über einen kompatiblen Adapter anbinden.
4. Generische Instanzanzeige und Reparaturaktion einführen.
5. Erst danach SSF als neuen Verbraucher implementieren.
6. Vor weiteren Lifecycle-Folgeänderungen den System-Assurance-Vertrag
   freigeben und jede betroffene Invariante mit ihrer führenden Evidenzklasse
   nachweisen.

## Open Questions

- Maximale Zahl und Stabilitätsregeln für Readiness-Checks.
