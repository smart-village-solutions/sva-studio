# ADR-057: Generischer Plugin-Tenant-Lifecycle und Readiness-Gate

**Status:** Accepted
**Entscheidungsdatum:** 2026-08-30
**Entschieden durch:** SVA Studio Team

## Kontext

Aktivierung allein belegt nicht, dass ein Plugin seine tenantbezogenen
Fachressourcen erfolgreich provisioniert hat. Waste und SSF benötigen trotz
unterschiedlicher Datenbanktopologien denselben Hostvertrag für Provisioning,
Reconcile, Suspendierung, Reaktivierung und Betriebsbereitschaft. Ohne ein
zentrales Gate könnten Routen oder normale Jobs bereits auf fachlich
unvollständige beziehungsweise suspendierte Ressourcen zugreifen.

## Entscheidung

1. Plugins dürfen einen begrenzten, versionierten Tenant-Lifecycle mit den
   Operationen `provision`, `reconcile`, `suspend`, `reactivate` und
   `readiness` deklarieren.
2. Der Host führt diese Operationen als bestehende Plugin-Operations-Jobs aus
   und bindet sie an Instanz, Plugin, Sollgeneration und atomaren Claim.
3. `iam.instance_plugin_lifecycle` speichert ausschließlich generischen Soll-,
   Claim-, Job-, Readiness- und Fehlerzustand. Fachschema, Migrationen,
   Repositories und Secrets bleiben unter Plugin-Ownership.
4. Readiness verwendet `pending`, `ready`, `degraded` und `blocked` sowie eine
   deklarierte Liste namespaceter Checks. Persistierte Evidenz wird vor jeder
   Access-Entscheidung gegen diese Deklaration validiert.
5. Fachzugriff ist nur bei aktivem, nicht suspendiertem Plugin mit valider
   Evidenz und `ready` oder `degraded` zulässig. Fehlende oder ungültige
   Evidenz, `pending`, `blocked` und Suspendierung bleiben fail-closed.
6. Der Host wendet die Entscheidung an zentralen Grenzen an: lifecycle-verwaltete
   Module werden bei fehlender Freigabe aus `/auth/me.assignedModules`
   entfernt; normale Plugin-Jobs werden vor Idempotenzreservierung und
   Jobanlage abgewiesen.
7. Deklarierte Lifecycle-Jobtypen dürfen nicht über den generischen
   Plugin-Jobendpunkt gestartet werden. Reparatur und Readiness laufen nur über
   den generationsgebundenen Lifecycle-Orchestrator.
8. Plugins ohne Lifecycle-Vertrag behalten die bestehende Modul- und
   Action-Autorisierung. Neue plugin-spezifische Server-Handler verwenden den
   exportierten Host-Access-Entscheid zusätzlich zu ihrer normalen IAM-Prüfung.
9. Verzögerte Retry-Wake-ups sind pro Instanz und Plugin getrennt. Das Cockpit
   aktualisiert Readiness während aktiver Jobs und retryable Retry-Fenster, bis
   der Server einen abgeschlossenen Zustand liefert. Lifecycle-HTTP-Fehler
   folgen der vom Request bevorzugten unterstützten Sprache.

## Konsequenzen

### Positiv

- SSF und Waste teilen Lifecycle, Jobs, Audit, Readiness und Reparatur ohne
  gemeinsame Datenbanktopologie.
- UI-Routen, Navigation und Jobstarts sehen denselben effektiven Modulzustand.
- Blockierte oder suspendierte Plugins erzeugen keine normalen Folgejobs.
- Fehlende oder driftende Evidenz kann keinen Zugriff versehentlich öffnen.

### Negativ

- `/auth/me` benötigt für lifecycle-verwaltete Plugins zusätzlich den
  Readiness-Read-Pfad.
- Plugin-spezifische Server-Handler müssen das Host-Gate ausdrücklich in ihren
  Execution-Context übernehmen, bis ein allgemeiner Handler-Dispatcher diese
  Prüfung zentral materialisiert.
- `degraded` muss fachlich so verwendet werden, dass alle erforderlichen
  Checks weiterhin zugriffsfähig sind; blockierende Pflichtprüfungen melden
  `blocked`.

## Verworfene Alternativen

### Aktivierung gleich Betriebsbereitschaft

Verworfen, weil eine erfolgreiche Modulzuweisung keine Fachmigration oder
externe Abhängigkeit belegt.

### Plugin-spezifische Gates in Waste und SSF

Verworfen, weil dadurch parallele Sicherheits-, Fehler- und Reparaturverträge
entstünden.

### Freier Start von Lifecycle-Jobtypen

Verworfen, weil ein solcher Start Sollgeneration, Claim und
Stale-Completion-Schutz umgehen könnte.

## Verwandte ADRs

- [ADR-030](ADR-030-registry-basierte-instance-freigabe-und-provisioning.md)
- [ADR-038](ADR-038-instanz-modul-zuordnung-und-fail-closed-modulaktivierung.md)
- [ADR-040](ADR-040-graphile-worker-als-standard-fuer-hintergrundprozesse.md)
- [ADR-041](ADR-041-plugin-plattform-v2-fuer-externe-distribution.md)
- [ADR-050](ADR-050-zentraler-scopegebundener-ui-zugriff.md)
- [ADR-056](ADR-056-extension-tiers-und-scopegebundene-plugin-beitraege.md)
