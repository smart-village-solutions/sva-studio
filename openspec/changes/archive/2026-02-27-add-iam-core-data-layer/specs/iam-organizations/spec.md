# IAM Organizations Specification Delta

## ADDED Requirements

### Requirement: Instanzzentriertes Mandantenmodell

Das System SHALL `instanceId` als kanonischen Mandanten-Scope verwenden. Organisationen sind Untereinheiten innerhalb einer Instanz.

#### Scenario: Instanz mit mehreren Organisationen

- **WHEN** eine Instanz mehrere Organisationen enthält
- **THEN** können Benutzer innerhalb derselben Instanz einer oder mehreren Organisationen zugeordnet werden
- **AND** diese Zuordnungen bleiben auf die Instanz begrenzt

### Requirement: Lokale Postgres-Bereitstellung für IAM-Datenmodell

Das System SHALL eine reproduzierbare lokale Postgres-Bereitstellung über Docker für Entwicklung und Tests bereitstellen.

#### Scenario: Lokaler Start der IAM-Datenbank

- **WHEN** ein Entwickler die lokale IAM-Umgebung startet
- **THEN** ist die Postgres-Instanz erreichbar und health-checked
- **AND** das `iam`-Schema kann durch Migrationen erstellt werden

### Requirement: RLS-basierte Instanzisolation

Das System SHALL instanzüberschreitende Datenzugriffe auf Datenbankebene durch Row-Level-Security verhindern.

#### Scenario: Zugriff auf fremde Instanzdaten

- **WHEN** ein Request-Kontext auf `instanceId=A` begrenzt ist
- **AND** ein Datenzugriff auf Datensätze mit `instanceId=B` erfolgt
- **THEN** liefert die Datenbank keinen Zugriff auf diese Datensätze

### Requirement: Migrations- und Seed-Betriebssicherheit

Das System SHALL versionierte Migrationen mit Rollback-Pfad und idempotenten Seeds für IAM-Basisdaten bereitstellen.

#### Scenario: Wiederholte Seed-Ausführung

- **WHEN** Seeds mehrfach ausgeführt werden
- **THEN** entstehen keine doppelten Basisrollen oder inkonsistenten Zuordnungen
- **AND** der Datenbestand bleibt konsistent

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)

---

## ADDED Requirements (Security-Review 26.02.2026)

### Requirement: Verschlüsselung sensibler IAM-Daten at Rest

Das System SHALL sensible IAM-Daten verschlüsselt speichern, wo dies sinnvoll und notwendig ist.

#### Scenario: Verschlüsselung von Credentials und PII-Feldern

- **WHEN** sensible Daten (Credentials, PII-Felder) in IAM-Tabellen gespeichert werden
- **THEN** werden diese Felder auf Spaltenebene verschlüsselt (Column-Level Encryption)
- **AND** der Verschlüsselungsschlüssel wird nicht in der Datenbank gespeichert

#### Scenario: Klartext-Zugriff nur über autorisierte Pfade

- **WHEN** verschlüsselte Daten gelesen werden
- **THEN** erfolgt die Entschlüsselung nur über autorisierte Anwendungspfade
- **AND** direkte SQL-Abfragen liefern nur verschlüsselte Werte

### Requirement: Datenklassifizierung für IAM-Entitäten

Das System SHALL IAM-Daten nach Schutzlevel klassifizieren und entsprechende Schutzmaßnahmen anwenden.

#### Scenario: Schutzlevel-Zuordnung

- **WHEN** IAM-Entitäten gespeichert werden
- **THEN** gelten folgende Schutzlevel:
  - **Vertraulich:** Accounts (E-Mail, Credentials), Session-Daten, Audit-Logs mit PII
  - **Intern:** Organisationsmetadaten, Rollenzuordnungen, Hierarchiebeziehungen
  - **Öffentlich:** Rollennamen, Permission-Definitionen (Systemrollen)
- **AND** für „Vertraulich"-Daten gelten Verschlüsselung und Zugriffsbeschränkung
- **AND** die Klassifizierung ist im Schema dokumentiert

### Requirement: RLS-Bypass-Schutz und Negativtests

Das System SHALL sicherstellen, dass RLS-Policies im Laufzeitbetrieb nicht durch Privilege-Escalation oder fehlerhafte Connection-Konfiguration umgangen werden können.

#### Scenario: Laufzeitrollen ohne RLS-Bypass-Rechte

- **WHEN** die Anwendung Datenbankzugriffe im Runtime-Pfad ausführt
- **THEN** nutzt sie ausschließlich Rollen ohne `SUPERUSER` und ohne `BYPASSRLS`
- **AND** privilegierte Rollen sind auf Migration/Breakglass-Pfade begrenzt und werden auditiert

#### Scenario: Connection-Pooling mit korrektem Rollenkontext

- **WHEN** eine Anwendung über Connection-Pooling auf die Datenbank zugreift
- **THEN** wird der korrekte Rollenkontext (`SET ROLE`) pro Request gesetzt
- **AND** ein fehlender Rollenkontext führt zu einem Zugriffsfehler (Fail-Closed)

#### Scenario: Migrationen mit dokumentiertem RLS-Bypass

- **WHEN** eine Migration RLS-Policies deaktiviert oder umgeht
- **THEN** ist dies explizit im Migrationsskript dokumentiert
- **AND** die Deaktivierung ist auf den minimalen notwendigen Scope begrenzt
- **AND** nach Abschluss der Migration sind RLS-Policies wieder aktiv
