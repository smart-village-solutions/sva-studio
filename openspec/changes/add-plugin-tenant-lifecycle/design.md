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
`active_job_id`. Eine neue Mutation erhöht `desired_generation` und löst einen
älteren Claim. Der anschließend erzeugte Studio-Job darf nur die exakt aktuelle
Operation und Generation claimen. Abschluss und Fehler werden ausschließlich
akzeptiert, wenn Job-ID, Instanz, Plugin, Claim- und Sollgeneration weiterhin
übereinstimmen. Eine leere Update-Rückgabe ist damit ein deterministischer
Stale- oder Konkurrenzkonflikt und kein wiederholbarer Schreibfehler.

Idempotenz bleibt zweistufig: Der Host verhindert doppelte Jobanlage über den
vorhandenen Studio-Job-Idempotenzvertrag; der Plugin-Handler reconciliiert die
Fachartefakte für die übergebene Sollgeneration. Das Lifecycle-Ledger enthält
keine pluginfachlichen Ressourcen und ersetzt keine plugin-eigene
Migrationshistorie.

### Readiness ist ein gemeinsamer Ergebnisvertrag

Plugins melden `pending`, `ready`, `degraded` oder `blocked` sowie namespaced
Checks. Der Host aggregiert nur Status und Handlungsmöglichkeiten; Texte und
fachliche Diagnose bleiben beim Plugin.

### Aktivierung und Fachbereitschaft sind getrennt

Ein Plugin kann aktiv, aber noch nicht fachlich bereit sein. Tenant-Routen und
interne Fachzugriffe bleiben bis zur erforderlichen Readiness fail-closed. Bei
`required` blockiert fehlende Readiness zusätzlich die Installationsbereitschaft.

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

## Open Questions

- Maximale Zahl und Stabilitätsregeln für Readiness-Checks.
