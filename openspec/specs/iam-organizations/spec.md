# iam-organizations Specification

## Purpose
Diese Spezifikation beschreibt das instanzzentrierte Mandanten- und Organisationsmodell im IAM, den Wechsel des Organisationskontexts innerhalb einer Instanz sowie die technischen Leitplanken für lokale Postgres-Bereitstellung, RLS-basierte Instanzisolation und betriebssichere Migrationen/Seeds.
## Requirements
### Requirement: Multi-Org-Kontextwechsel im aktiven Instanzkontext

Das System MUST Benutzern mit mehreren Organisationszuordnungen den Kontextwechsel innerhalb der aktiven `instanceId` ermöglichen.

#### Scenario: Benutzer wechselt Organisationskontext

- **WHEN** ein authentifizierter Benutzer Mitglied in mehreren Organisationen derselben Instanz ist
- **THEN** kann er den aktiven Organisationskontext wechseln
- **AND** der gewählte Kontext wird in der Session für nachgelagerte Zugriffe bereitgestellt

### Requirement: Keine Persistenz- und RLS-Modellierung in Child A

Das System MUST in Child A keine vollständige Organisationspersistenz, RLS-Policy-Definition oder Hierarchieauswertung spezifizieren; diese liegen in Child B/D.

#### Scenario: Datenmodell außerhalb Child-A-Scope

- **WHEN** Anforderungen zu `iam.organizations`, RLS-Policies oder Hierarchie-Vererbung entstehen
- **THEN** werden diese in den zugehörigen Child-Changes (B/D) spezifiziert
- **AND** Child A bleibt auf Identity- und Kontextbereitstellung begrenzt

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
