## Kontext

Der Backup-Agent besitzt bereits Zugriff auf die internen Datenbanknetze und umgebungsgebundene MinIO-Credentials. Diese Vertrauenszone ist für Backups nötig, darf aber keinen frei programmierbaren Fernzugriff erhalten. Ein Vollrestore ist destruktiv und muss gegen die eindeutige Zielumgebung, ein geprüftes Backup und einen human-in-the-loop-Freigabepfad gebunden sein.

## Ziele

- Vollständige Restores eines vorhandenen, umgebungsgebundenen PostgreSQL-Custom-Dumps ermöglichen.
- Einen reproduzierbaren, GitHub-auditierbaren und fail-closed Incident-Recovery-Pfad bereitstellen.
- Vor Datenverlust durch frischen Sicherheitsdump, GitHub-Environment-Freigabe und Zielprüfungen schützen.
- Keine frei wählbaren Hosts, Buckets, Datenbanknamen, Restore-Optionen oder Shell-Befehle erlauben.

## Nicht-Ziele

- Kein Point-in-Time-Recovery sowie keine tabellen-, schema- oder datensatzgenauen Restores.
- Kein automatischer Restore, kein Restore über die Admin-Oberfläche und keine allgemeine Operator-Schnittstelle.
- Keine automatische Änderung von Keycloak oder anderen externen Systemen.
- Keine persistente Plan-/Bestätigungs-API oder allgemeine Recovery-Orchestrierung.

## Entscheidungen

### GitHub-gesteuerter, enger Restore-Vertrag

Der Restore wird ausschließlich von einem dedizierten GitHub-Actions-Workflow mit geschütztem Environment ausgelöst. Der Agent prüft kurzlebige OIDC-Claims, eine umgebungsspezifische HMAC-Signatur, Repository und eine Restore-Workflow-Allowlist. Der Request enthält nur versionierte, allowlistbare Daten: Umgebung, Request-ID, Ablaufzeit, Wartungsfensterreferenz, exakten Objektpfad und erwartete SHA-256. Die bestehende HTTPS-Route darf genutzt werden, wenn Request-Schema und Workflow-Allowlist die Restore-Action strikt von `backup-and-verify` trennen.

### Einmaliger, nicht fortsetzbarer Restore-Lauf

Der Agent schreibt den angenommenen Request vor Start nach MinIO. Eine bereits vorhandene Request-ID wird abgelehnt. Der Agent führt nach Neustart keinen Restore automatisch fort. Scheitert der Prozess nach Beginn der Mutation, bleibt die App stillgelegt; ein weiterer Versuch benötigt einen neuen GitHub-Run und eine neue Environment-Freigabe.

### Deterministischer Restore-Executor

Der Agent lädt den Dump ausschließlich in ein restriktives temporäres Verzeichnis, verifiziert SHA-256 und Archivformat erneut, erzeugt einen frischen Sicherheitsdump und führt `pg_restore` ausschließlich gegen die fest konfigurierte Ziel-Datenbank aus. Der Restore verwendet einen dedizierten Restore-Principal, nicht den App-Principal.

Der Workflow nimmt die App vor dem Restore kontrolliert aus dem Schreibbetrieb und wartet, bis App-Sessions gegen die Ziel-Datenbank beendet sind. Erst dann darf der Agent den Restore ausführen. Der Agent beendet die Stilllegung nicht selbst. Bei einem Fehler ab Beginn von `pg_restore` bleibt die App stillgelegt; ein weiterer Restore erfordert einen neuen GitHub-Run und eine neue explizite Freigabe.

### Verifikation und Evidenz

Der Agent schreibt Request-, Sicherheitsbackup- und Ergebnisobjekte getrennt nach MinIO. Die Evidenz enthält keine Secrets und keine Datenbankinhalte. Nach dem Restore sind mindestens Goose-Version, IAM-Schema-Guard, App-DB-Principal, Registry, `health/live`, `health/ready` und ein repräsentativer Tenant-Login zu prüfen. Jede fehlschlagende Prüfung hält die App stillgelegt und erfordert eine manuelle Recovery-Entscheidung.

## Alternativen

- Direkter Operator-Endpunkt: verworfen, weil er einen weiteren produktiven Authentifizierungs- und Freigabekanal schafft.
- `quantum-cli exec`: verworfen, weil es eine generische Remote-Shell eröffnet und im Incident nicht zuverlässig verfügbar war.
- Freie `pg_restore`-Parameter: verworfen, weil sie Ziel- und Befehlsinjektion ermöglichen würden.

## Risiken und Gegenmaßnahmen

- Vollrestore überschreibt aktuelle Daten: frischer Sicherheitsdump, kontrollierte App-Stilllegung mit Session-Drain und GitHub-Environment-Gate.
- Backup ist unvollständig oder falsch: umgebungsgebundene Präfix-Allowlist, SHA-256, Archivlesbarkeit und Schema-Prüfung vor Mutation.
- Datenbank und Keycloak driften: Restore-Ergebnis dokumentiert den externen Drift; ein getrennter, bestehender Reconcile-Pfad bleibt erforderlich.
- Teilrestores können eine unvollständige Datenbank hinterlassen: App bleibt stillgelegt; ein neuer, explizit freigegebener Restore vom Sicherheitsdump ist der einzige Recovery-Schritt.
- Agent-Kompromittierung: enges Request-Schema, OIDC/HMAC, keine Shell-Parameter, getrennte Staging-/Production-Secrets und separater Restore-Principal.

## Migrations- und Rollback-Plan

1. Kontrollierte App-Stilllegung mit Session-Drain als notwendige Workflow-Voraussetzung implementieren oder über einen separaten, zuerst abgeschlossenen Change bereitstellen.
2. Dedizierten Restore-Principal in Staging einrichten.
3. Restore-Vertrag und Workflow zunächst nur für Staging bereitstellen und mit einem kontrollierten Drill nachweisen.
4. Production erst nach dokumentierter Staging-Evidenz und expliziter Production-Freigabe aktivieren.
5. Bei Fehlern vor `pg_restore` bleibt die Ziel-Datenbank unverändert; der frische Sicherheitsdump ist als neuer Recovery-Punkt verfügbar.
6. Bei Fehlern nach Beginn des Restores bleibt die App stillgelegt. Ein weiterer Restore erfolgt ausschließlich über einen neuen GitHub-Run und eine neue explizite Freigabe.
