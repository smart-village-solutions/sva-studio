# ADR-048: Zentraler Backup-Agent mit gehärtetem HTTPS-Trigger

## Status

Angenommen

## Kontext

Der bisherige Promote-Pfad erzeugt pro Backup einen temporären Swarm-Stack. Der Pfad ist fail-closed, seine Task- und Log-Evidenz ist jedoch flüchtig. Ein dauerhafter Ausführungspunkt soll Backups für Staging und Production übernehmen, ohne eine allgemeine Remote-Shell einzuführen. Ein Produktionsincident hat zusätzlich gezeigt, dass ein kontrollierter Vollrestore nicht verlässlich über generische Remote-Ausführung bereitgestellt werden kann.

## Entscheidung

Ein einzelner `studio-backup-agent` wird als bewusst breite Vertrauenszone betrieben. Er ist mit den internen Staging- und Production-Netzen sowie dem bestehenden Traefik-Netz verbunden. Zwei dedizierte Backup-Subdomains führen über exakte HTTPS-`POST`-Routen ausschließlich `backup-and-verify` oder den versionierten Vertrag `restore-and-verify-v1` aus.

GitHub authentisiert sich mit einem kurzlebigen OIDC-Token. Der Agent bindet dessen Claims an Repository, Environment und eine Allowlist der Workflows auf `main`. Zusätzlich signieren getrennte HMAC-Schlüssel die Requests für Staging und Production. Datenbankziele, Buckets und Credentials stammen ausschließlich aus der internen Umgebungs-Allowlist.

Der Agent persistiert den Request vor `202 Accepted`, verarbeitet global genau einen Auftrag und schreibt das terminale Ergebnis nach MinIO. Request-ID, Ablaufzeit, Digest beziehungsweise Restore-Objekt und SHA-256 sowie das Wartungsfenster werden fail-closed geprüft. Backup- und Restore-Workflows sowie HMAC-Secrets besitzen getrennte Allowlists und Credentials.

Ein Restore wird nur durch `.github/workflows/database-restore.yml` ausgelöst. Der Workflow legt App und Provisioner still; der Agent bestätigt den Session-Drain, prüft Objekt, SHA-256, Archiv und erforderliche Schemas, erzeugt einen verifizierten Sicherheitsdump und führt `pg_restore` mit festem PostgreSQL-16-Client gegen die fest konfigurierte Datenbank aus. Der dedizierte Login-Principal `sva_restore` darf ausschließlich in die feste App-Rolle wechseln und besitzt keine frei wählbaren Ziele oder Optionen. Der Agent startet die App nie selbst. Erst nach erfolgreichen DB-Prüfungen startet der Workflow die App und prüft Liveness, Readiness und Tenant-Login. Jeder Fehler hält beziehungsweise versetzt die App wieder in den stillgelegten Zustand. Production erfordert zusätzlich die Artefakte eines erfolgreichen Staging-Restore-Drills.

Nach der erfolgreichen Backup-Betriebsabnahme am 31. Juli 2026 ist der Agent der Backup-Standard. Der noch vorhandene Schalter `BACKUP_EXECUTOR=temporary` ist ausschließlich Incident-Fallback und kein regulärer Betriebsmodus; seine Entfernung bleibt ein separater Folgechange. Der Production-Restore wird erst nach dokumentiertem Staging-Drill und expliziter Freigabe des GitHub Environments genutzt.

## Konsequenzen

- Der gemeinsame Agent vergrößert den möglichen Blast Radius und benötigt getrennte Secrets sowie strenge Request-Validierung.
- Der HTTPS-Ingress erweitert die Angriffsfläche, ist aber auf zwei Hosts, zwei exakte Pfade und `POST` begrenzt.
- MinIO-Evidenz ersetzt flüchtige Task-Logs als autoritativen Erfolgskanal.
- Automatische, wiederholte oder teilweise Restores bleiben ausgeschlossen; jeder Versuch benötigt eine neue Request-ID und Environment-Freigabe.
- Nach Beginn der Mutation gibt es keinen automatischen Gegenrestore. Der Sicherheitsdump ist der einzige neue Recovery-Punkt und darf nur in einem neuen freigegebenen Lauf verwendet werden.

## Alternativen

- Polling von MinIO wurde wegen unnötiger Latenz und Last verworfen.
- MinIO-Webhooks wurden verworfen, weil keine belastbare interne MinIO-zu-Swarm-Route nachgewiesen ist.
- `quantum-cli exec` wurde verworfen, weil es eine allgemeine Remote-Kommandoausführung statt eines engen Backup-Vertrags eröffnet.
