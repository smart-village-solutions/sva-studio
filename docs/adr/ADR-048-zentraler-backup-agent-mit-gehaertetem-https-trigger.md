# ADR-048: Zentraler Backup-Agent mit gehärtetem HTTPS-Trigger

## Status

Angenommen

## Kontext

Der bisherige Promote-Pfad erzeugt pro Backup einen temporären Swarm-Stack. Der Pfad ist fail-closed, seine Task- und Log-Evidenz ist jedoch flüchtig. Ein dauerhafter Ausführungspunkt soll Backups für Staging und Production übernehmen, ohne eine allgemeine Remote-Shell einzuführen. Ein Produktionsincident hat zusätzlich gezeigt, dass ein kontrollierter Vollrestore nicht verlässlich über generische Remote-Ausführung bereitgestellt werden kann.

## Entscheidung

Ein einzelner `studio-backup-agent` wird als bewusst breite Vertrauenszone betrieben. Er ist mit den internen Staging- und Production-Netzen sowie dem bestehenden Traefik-Netz verbunden. Zwei dedizierte Backup-Subdomains führen über exakte HTTPS-`POST`-Routen ausschließlich `backup-and-verify` oder den versionierten Vertrag `restore-and-verify-v1` aus.

GitHub authentisiert sich mit einem kurzlebigen OIDC-Token. Der Agent bindet dessen Claims an Repository, Environment und eine Allowlist der Workflows auf `main`. Zusätzlich signieren getrennte HMAC-Schlüssel die Requests für Staging und Production. Datenbankziele, Buckets und Credentials stammen ausschließlich aus der internen Umgebungs-Allowlist.

Der Agent persistiert den Request vor `202 Accepted`, verarbeitet global genau einen Auftrag und schreibt das terminale Ergebnis nach MinIO. Bei Backups werden Request-ID, Ablaufzeit und Digest fail-closed geprüft; bei Restores zusätzlich Restore-Objekt, SHA-256 und Wartungsfenster. Backup- und Restore-Workflows sowie HMAC-Secrets besitzen getrennte Allowlists und Credentials.

Der signierte Vertrag erlaubt zusätzlich ausschließlich die Zielklasse `waste`. Ohne `database`-Feld bleibt der bestehende Studio-Vertrag unverändert; `database: "waste"` inventarisiert alle `ready`- und `disabled`-Datenbanken aus `iam.instance_waste_provisioning`. Dumps liegen unter `<umgebung>/waste/<instance_id>/`; ein tenantgenaues Manifest ordnet Instanz, registrierte Datenbank und Prüfsumme zu. Der Restorevertrag verlangt zusätzlich die signierte `tenantInstanceId`, akzeptiert nur deren Objektpräfix, löst die Registry erneut auf und schreibt ausschließlich in die aus dem registrierten Namen abgeleitete Drill-Datenbank. Rollen werden deterministisch aus demselben Datenbanknamen abgeleitet und nach dem Restore geprüft. Freie Datenbank-, Host-, Rollen- oder Bucketnamen bleiben ausgeschlossen; App-Zugangsdaten erhält der Agent nicht.

Ein Restore wird nur durch `.github/workflows/database-restore.yml` ausgelöst. Der Workflow legt App und Provisioner still; der Agent bestätigt den Session-Drain, prüft Objekt, SHA-256, Archiv und erforderliche Schemas, erzeugt einen verifizierten Sicherheitsdump und führt `pg_restore` mit demselben fest gepinnten PostgreSQL-18-Client wie der Backup-Pfad gegen die fest konfigurierte Datenbank aus. Der dedizierte Login-Principal `sva_restore` darf ausschließlich in die feste App-Rolle wechseln und besitzt keine frei wählbaren Ziele oder Optionen. Der Agent startet die App nie selbst. Erst nach erfolgreichen DB-Prüfungen startet der Workflow die App und prüft Liveness, Readiness und Tenant-Login. Jeder Fehler hält beziehungsweise versetzt die App wieder in den stillgelegten Zustand. Staging- und Production-Restores werden ausschließlich durch das jeweils gewählte GitHub Environment autorisiert und erzeugen keine Abhängigkeit zur anderen Umgebung.

Da Custom-Dumps bewusst ohne Owner- und ACL-Übernahme erzeugt werden, rekonstruiert der Agent nach `pg_restore` die fest allowlisteten Rechte des Runtime-Principals `sva_app` idempotent. Schema-Owner `sva`, Runtime-Principal `sva_app`, Rolle `iam_app`, Datenbank und Grants sind interne Konstanten und keine Request-Felder. Der Agent prüft anschließend Datenbank-, Schema-, Rollen-, Tabellen- und Sequenzrechte und meldet ohne vollständige Principal-Evidenz keinen erfolgreichen Restore. Er erhält dafür weder App-Passwort noch allgemeine SQL-Ausführung. Nach dem App-Neustart prüft der geschützte Workflow zusätzlich `/auth/me` und `/iam/me/permissions` mit einem dedizierten Restore-Smoke-Zugang.

Nach der erfolgreichen Backup-Betriebsabnahme am 31. Juli 2026 ist der Agent der Backup-Standard. Der noch vorhandene Schalter `BACKUP_EXECUTOR=temporary` ist ausschließlich Incident-Fallback und kein regulärer Betriebsmodus; seine Entfernung bleibt ein separater Folgechange. Jeder Restore wird über die explizite Freigabe des gewählten GitHub Environments autorisiert und vollständig in dieser Zielumgebung geprüft.

## Konsequenzen

- Der gemeinsame Agent vergrößert den möglichen Blast Radius und benötigt getrennte Secrets sowie strenge Request-Validierung.
- Der HTTPS-Ingress erweitert die Angriffsfläche, ist aber auf zwei Hosts, zwei exakte Pfade und `POST` begrenzt.
- MinIO-Evidenz ersetzt flüchtige Task-Logs als autoritativen Erfolgskanal.
- Automatische, wiederholte oder teilweise Restores bleiben ausgeschlossen; jeder Versuch benötigt eine neue Request-ID und Environment-Freigabe.
- Nach Beginn der Mutation gibt es keinen automatischen Gegenrestore. Der Sicherheitsdump ist der einzige neue Recovery-Punkt und darf nur in einem neuen freigegebenen Lauf verwendet werden.
- Die restore-spezifische ACL-Reconciliation erweitert die Trust Boundary des Agenten ausschließlich um statische additive Grants; frei wählbare Principals, Rollen oder SQL bleiben ausgeschlossen.
- Allgemeine Health-Prüfungen gelten nach einem Restore nicht als IAM-Nachweis. Datenbank-Principal-Probe und authentifizierter Anwendungssmoke sind getrennte Pflicht-Gates.

## Alternativen

- Polling von MinIO wurde wegen unnötiger Latenz und Last verworfen.
- MinIO-Webhooks wurden verworfen, weil keine belastbare interne MinIO-zu-Swarm-Route nachgewiesen ist.
- `quantum-cli exec` wurde verworfen, weil es eine allgemeine Remote-Kommandoausführung statt eines engen Backup-Vertrags eröffnet.
