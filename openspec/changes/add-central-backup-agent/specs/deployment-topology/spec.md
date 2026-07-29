## ADDED Requirements

### Requirement: Zentraler umgebungsgebundener Studio-Backup-Agent

Das System SHALL einen zentralen, dauerhaft betriebenen Backup-Agenten bereitstellen, der ausschließlich signierte `backup-and-verify`-Aufträge für die expliziten Zielumgebungen `staging` und `prod` über einen gehärteten HTTPS-Endpoint ausführt.

#### Scenario: Valider Staging-Auftrag erzeugt einen überprüften Dump

- **WHEN** der freigegebene Staging-Promote oder -Drill einen gültig signierten und per GitHub-OIDC authentisierten Staging-Auftrag mit eindeutiger Request-ID und unveränderlichem Image-Digest an `https://studio-staging.smart-village.app/_ops/backup/v1/requests` sendet
- **THEN** erstellt der Agent ausschließlich aus der Staging-Konfiguration einen PostgreSQL-Custom-Dump im Bucket `studio-db-backup-staging`
- **AND** bestätigt er Upload, Download, Größe, SHA-256-Wert und `pg_restore --list` in einem terminalen redigierten Ergebnisobjekt
- **AND** akzeptiert der Agent ausschließlich HTTPS-`POST` auf diesen Pfad, keine allgemeine Kommandoausführung und keine operativen Details in seiner HTTP-Antwort

#### Scenario: Production-Auftrag bleibt an den kontrollierten Promote gebunden

- **WHEN** ein Production-Promote einen per GitHub-OIDC authentisierten Backup-Auftrag an `https://studio.smart-village.app/_ops/backup/v1/requests` sendet
- **THEN** enthält der Auftrag eine gültige Production-Umgebung, einen revisionsfähigen Wartungsfenster-Verweis und den Ziel-Digest
- **AND** akzeptiert der Agent ausschließlich das Production-Datenbankziel und den Bucket `studio-db-backup-production`
- **AND** blockiert der Promote Migration, Bootstrap und App-Deploy, bis das passende erfolgreiche Ergebnisobjekt vorliegt

#### Scenario: Ungültige oder wiederverwendete Aufträge bleiben folgenlos

- **WHEN** ein Auftrag eine ungültige Signatur, ein abgelaufenes Zeitfenster, eine unbekannte Umgebung oder eine bereits terminal verarbeitete Request-ID enthält
- **THEN** führt der Agent kein Backup aus
- **AND** schreibt ausschließlich redigierte Fehler-Evidenz ohne Zugangsdaten oder Datenbankinhalte

#### Scenario: Umgebungsgrenzen werden innerhalb des gemeinsamen Dienstes erzwungen

- **WHEN** ein formal gültiger Auftrag versucht, Bucket, Datenbankhost oder Objektpräfix einer anderen Umgebung vorzugeben
- **THEN** verwirft der Agent den Auftrag vor jedem Datenbank- oder MinIO-Zugriff
- **AND** leitet er alle Zielwerte ausschließlich aus der validierten Umgebungs-Allowlist ab
