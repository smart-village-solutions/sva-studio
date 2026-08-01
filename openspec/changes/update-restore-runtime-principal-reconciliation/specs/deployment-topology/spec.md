## MODIFIED Requirements

### Requirement: Kontrollierter Datenbank-Vollrestore über den Backup-Agenten

Das System SHALL vollständige PostgreSQL-Datenbankrestores ausschließlich über einen versionierten, GitHub-gesteuerten und umgebungsgebundenen Backup-Agent-Vertrag ermöglichen. Der Vertrag SHALL eine ausschließlich für Restore erlaubte Workflow-Allowlist verwenden und keine frei wählbaren Shell-Befehle, Hosts, Datenbanknamen, Buckets, Principals, Rollen, SQL-Anweisungen oder Restore-Optionen akzeptieren. Nach `pg_restore` SHALL der Agent die fest allowlisteten Runtime-Principal-ACLs idempotent rekonstruieren, bevor er einen Restore als erfolgreich meldet.

#### Scenario: Freigegebener Production-Vollrestore

- **WHEN** ein dedizierter GitHub-Actions-Workflow für `prod` eine eindeutige Request-ID, eine revisionsfähige Wartungsfensterreferenz sowie den exakten Schlüssel und die SHA-256 eines vorhandenen Production-Dumps übergibt
- **THEN** akzeptiert der Agent ausschließlich den fest verdrahteten Production-Bucket, das Production-Präfix und die Production-Zieldatenbank
- **AND** erzeugt und verifiziert er vor der Mutation einen frischen Production-Sicherheitsdump
- **AND** führt er den Vollrestore nur aus, nachdem der Workflow die App kontrolliert stillgelegt und alle App-Sessions gegen die Ziel-Datenbank beendet hat
- **AND** rekonstruiert er anschließend ausschließlich die intern festgelegten IAM-Rechte des allowlisteten Production-Runtime-Principals
- **AND** persistiert er redigierte Evidenz für Request, Sicherheitsdump, ACL-Reconciliation, Principal-Probe und Ergebnis

#### Scenario: Wiederhergestellter Dump enthält keine Runtime-ACLs

- **WHEN** ein valider Dump Schema und Daten enthält, aber keine ACL- oder Default-ACL-Einträge für den allowlisteten Runtime-Principal
- **THEN** rekonstruiert der Agent die fest definierten Datenbank-, Schema-, Tabellen-, Sequenz- und Rollenrechte idempotent
- **AND** verwendet er dafür weder App-Zugangsdaten noch vom Request gelieferte Rollen- oder SQL-Werte
- **AND** gilt der Restore erst nach erfolgreicher Principal-Probe als datenbankseitig abgeschlossen

#### Scenario: Unzulässiger oder manipuliert wirkender Restore-Auftrag

- **WHEN** ein Restore-Auftrag abgelaufen ist, eine ungültige Signatur oder OIDC-Identität besitzt, von einem nicht erlaubten Restore-Workflow stammt, eine falsche Umgebung adressiert, eine bereits verwendete Request-ID oder einen nicht erlaubten Objektpfad enthält, dessen SHA-256 nicht mit dem geprüften Objekt übereinstimmt oder zusätzliche Principal-, Rollen- oder SQL-Felder übergibt
- **THEN** lehnt der Agent den Auftrag vor jeder Datenbankmutation fail-closed ab
- **AND** schreibt er ausschließlich redigierte Fehler-Evidenz

### Requirement: Vollrestore endet mit systematischer Nachprüfung

Das System SHALL nach einem erfolgreichen Datenbank-Vollrestore die Wiederherstellung durch Schema-, ACL-, Principal-, Registry-, Health-, authentifizierte IAM- und Tenant-Login-Prüfungen bewerten. Keycloak SHALL nicht Teil der Datenbankmutation sein. Datenbanknahe Prüfungen SHALL vor der terminalen Agent-Erfolgsevidenz erfolgen; der reale IAM-Anwendungssmoke SHALL nach dem App-Neustart im geschützten GitHub-Workflow erfolgen.

#### Scenario: Runtime-Principal besitzt nach Restore keinen vollständigen IAM-Zugriff

- **WHEN** ACL-Reconciliation oder Principal-Probe fehlende Rollen, fehlendes Schema-`USAGE`, unzureichende Tabellen- oder Sequenzrechte oder einen abweichenden Runtime-Principal erkennt
- **THEN** meldet der Agent keinen erfolgreichen Restore
- **AND** persistiert er die redigierte Fehlerklasse ohne Zugangsdaten, SQL-Ergebnisse oder Datenbankinhalte
- **AND** bleibt die App stillgelegt

#### Scenario: Datenbankprobe ist erfolgreich, aber der reale Anwendungspfad bleibt degradiert

- **WHEN** die datenbanknahe Principal-Probe erfolgreich ist, aber `/auth/me` nach dem Neustart einen degradierten Berechtigungszustand liefert oder `/iam/me/permissions` nicht erfolgreich antwortet
- **THEN** markiert der GitHub-Workflow den Recovery-Vorgang als fehlgeschlagen
- **AND** versetzt oder hält er die App gemäß Restore-Vertrag im Wartungszustand
- **AND** veröffentlicht er nur redigierte Fehler-Evidenz

#### Scenario: Datenbankrestore ist abgeschlossen, aber ein Tenant-Login ist nicht bereit

- **WHEN** der Datenbankrestore technisch erfolgreich beendet ist, aber mindestens eine erforderliche Nachprüfung fehlschlägt
- **THEN** markiert der Agent beziehungsweise der geschützte GitHub-Workflow den Restore als fehlgeschlagenen Recovery-Vorgang
- **AND** beendet das System den Wartungsmodus nicht automatisch
- **AND** dokumentiert es die Fehlerklasse sowie den vorhandenen Sicherheitsdump ohne Secrets oder Datenbankinhalte
