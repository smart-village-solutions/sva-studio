## ADDED Requirements

### Requirement: Kontrollierter Datenbank-Vollrestore über den Backup-Agenten

Das System SHALL vollständige PostgreSQL-Datenbankrestores ausschließlich über einen versionierten, GitHub-gesteuerten und umgebungsgebundenen Backup-Agent-Vertrag ermöglichen. Der Vertrag SHALL eine ausschließlich für Restore erlaubte Workflow-Allowlist verwenden und keine frei wählbaren Shell-Befehle, Hosts, Datenbanknamen, Buckets oder Restore-Optionen akzeptieren.

#### Scenario: Freigegebener Production-Vollrestore

- **WHEN** ein dedizierter GitHub-Actions-Workflow für `prod` eine eindeutige Request-ID, eine revisionsfähige Wartungsfensterreferenz sowie den exakten Schlüssel und die SHA-256 eines vorhandenen Production-Dumps übergibt
- **THEN** akzeptiert der Agent ausschließlich den fest verdrahteten Production-Bucket, das Production-Präfix und die Production-Zieldatenbank
- **AND** erzeugt und verifiziert er vor der Mutation einen frischen Production-Sicherheitsdump
- **AND** führt er den Vollrestore nur aus, nachdem der Workflow die App kontrolliert stillgelegt und alle App-Sessions gegen die Ziel-Datenbank beendet hat
- **AND** persistiert er redigierte Evidenz für Request, Sicherheitsdump und Ergebnis

#### Scenario: Unzulässiger oder manipuliert wirkender Restore-Auftrag

- **WHEN** ein Restore-Auftrag abgelaufen ist, eine ungültige Signatur oder OIDC-Identität besitzt, von einem nicht erlaubten Restore-Workflow stammt, eine falsche Umgebung adressiert, eine bereits verwendete Request-ID oder einen nicht erlaubten Objektpfad enthält oder dessen SHA-256 nicht mit dem geprüften Objekt übereinstimmt
- **THEN** lehnt der Agent den Auftrag vor jeder Datenbankmutation fail-closed ab
- **AND** schreibt er ausschließlich redigierte Fehler-Evidenz

### Requirement: Teilfehler halten die App stillgelegt

Das System SHALL nach Beginn eines Vollrestores keinen automatischen Wiederholungs- oder Gegenrestore ausführen.

#### Scenario: `pg_restore` schlägt nach Beginn fehl

- **WHEN** `pg_restore` nach Übernahme des exklusiven Restore-Locks fehlschlägt oder timeoutet
- **THEN** bleibt die App stillgelegt
- **AND** persistiert das System die Fehlerklasse sowie den verifizierten Sicherheitsdump
- **AND** erfordert jeder weitere Restore einen neuen GitHub-Run und eine neue explizite Freigabe

### Requirement: Vollrestore endet mit systematischer Nachprüfung

Das System SHALL nach einem erfolgreichen Datenbank-Vollrestore die Wiederherstellung durch Schema-, Principal-, Registry-, Health- und Tenant-Login-Prüfungen bewerten. Keycloak SHALL nicht Teil der Datenbankmutation sein.

#### Scenario: Datenbankrestore ist abgeschlossen, aber ein Tenant-Login ist nicht bereit

- **WHEN** der Datenbankrestore technisch erfolgreich beendet ist, aber mindestens eine erforderliche Nachprüfung fehlschlägt
- **THEN** markiert der Agent den Restore als fehlgeschlagenen Recovery-Vorgang
- **AND** beendet er den Wartungsmodus nicht automatisch
- **AND** dokumentiert er die Fehlerklasse sowie den vorhandenen Sicherheitsdump ohne Secrets oder Datenbankinhalte
