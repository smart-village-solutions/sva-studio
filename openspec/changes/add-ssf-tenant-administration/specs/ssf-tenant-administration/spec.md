## ADDED Requirements

### Requirement: Eine Studio-Installation bildet genau eine SSF-Installation ab

Das System SHALL ein Studio-Deployment innerhalb derselben Deployment-Grenze wie genau eine SSF-Installation betreiben. Eine logische Studio-Instanz MUST genau einem SSF-Mandanten entsprechen; SSF-Fähigkeit entsteht ausschließlich durch ein installiertes, hostvalidiertes SSF-Plugin und nicht durch einen SSF-spezifischen Core-Modus.

#### Scenario: Deployment mit SSF-Plugin ist SSF-fähig

- **GIVEN** die SSF-Plugin-Distribution ist im Studio-Deployment installiert und kompatibel
- **WHEN** der Host seinen Plugin-Katalog materialisiert
- **THEN** stehen die freigegebenen SSF-Plattformbeiträge zur Verfügung
- **AND** jede aktivierte Studio-Instanz wird über ihre kanonische `instanceId` genau einem SSF-Mandanten zugeordnet

#### Scenario: Deployment ohne SSF-Plugin bleibt SSF-neutral

- **GIVEN** die SSF-Plugin-Distribution ist nicht installiert
- **WHEN** das Studio startet
- **THEN** enthält der Core weder SSF-Routen noch SSF-Fachfelder oder einen SSF-Betriebsmodus
- **AND** bestehende generische Studio-Funktionen bleiben nutzbar

### Requirement: SSF-Rollen werden strikt auf Root- und Tenant-Scope abgebildet

Das System SHALL SSF-`system_admin` ausschließlich als Root-Identität mit `instance_registry_admin`, SSF-`tenant_admin` ausschließlich als tenantlokalen `system_admin` und operative SSF-Admins ausschließlich über gezielte `ssf.*`-Permissions modellieren. SSF-Customer erhalten in diesem Administrationsvertrag keine reguläre Studio-Identität.

#### Scenario: Root-System-Admin legt Tenant und initialen Admin an

- **GIVEN** ein authentifizierter Root-Benutzer besitzt `instance_registry_admin`
- **WHEN** er einen neuen SSF-Mandanten anlegt
- **THEN** darf er Instanz, Realm und initialen Tenant-Admin provisionieren
- **AND** erhält er daraus keine reguläre tenantlokale Benutzerverwaltungsberechtigung

#### Scenario: Tenant-Admin verwaltet nur den eigenen Mandanten

- **GIVEN** ein Benutzer besitzt im Realm einer Instanz den geschützten `system_admin`
- **WHEN** er Benutzer, Gruppen oder Rollen verwaltet
- **THEN** laufen alle Reads und Mutationen ausschließlich im aktiven `instanceId`-Kontext
- **AND** gewährt die Rolle keinen Root- oder Fremdtenant-Zugriff

### Requirement: SSF-Keycloak trennt Root-Realm, Tenant-Realms und Clients

Das System SHALL das Keycloak der SSF-Installation mit einem Root-Realm und genau einem eigenen Realm pro SSF-Mandanten verwenden. Studio und SSF MUST getrennte OIDC-Clients und Audiences erhalten; interaktive Login-Clients und technische Admin-Clients bleiben getrennt.

#### Scenario: Neuer Tenant erhält getrennte Realm- und Client-Artefakte

- **WHEN** eine neue SSF-Instanz provisioniert wird
- **THEN** erzeugt oder reconciliiert das System idempotent ihren eigenen Tenant-Realm
- **AND** erzeugt oder validiert es getrennte Studio- und SSF-Clients sowie die erforderlichen technischen Admin-Clients
- **AND** bindet alle Artefakte eindeutig an die Instanz-Registry

#### Scenario: Benutzeridentitäten werden nicht realmübergreifend verknüpft

- **GIVEN** dieselbe E-Mail-Adresse existiert in zwei Tenant-Realms
- **WHEN** Benutzer synchronisiert oder angemeldet werden
- **THEN** behandelt das System sie als getrennte Identitäten
- **AND** verknüpft sie weder automatisch per E-Mail noch kopiert Root-Benutzer in Tenant-Realms

#### Scenario: Falsche Audience wird abgelehnt

- **GIVEN** ein Token wurde für den SSF-Client statt für den Studio-Client oder für einen anderen Tenant ausgestellt
- **WHEN** es an einem geschützten Studio-Pfad verwendet wird
- **THEN** lehnt das System das Token fail-closed ab
- **AND** erzeugt keinen Studio-Session- oder Tenant-Kontext

### Requirement: SSF besitzt eine einzelne plugin-eigene mandantenfähige Datenbank

Das System SHALL pro SSF-Installation genau eine PostgreSQL-Datenbank unter Ownership des SSF-Plugins betreiben. Tenantbezogene Datensätze MUST die kanonische Studio-`instanceId` führen und durch serverseitig gebundenen Datenbankkontext sowie Row-Level Security isoliert werden; installationsweite und explizite Root-Zugriffe bleiben davon getrennt.

#### Scenario: Tenant-Handler liest nur den gebundenen Tenant

- **GIVEN** der Host führt einen SSF-Plugin-Handler im verifizierten Kontext von Instanz A aus
- **WHEN** der Handler tenantbezogene Daten liest
- **THEN** setzt die Runtime den DB-Kontext serverseitig für Instanz A
- **AND** verhindern Repository-Filter und RLS das Lesen von Datensätzen der Instanz B

#### Scenario: Frei übergebene instanceId ändert den DB-Scope nicht

- **GIVEN** ein Request ist an Instanz A gebunden
- **WHEN** Pfad, Query oder Body eine `instanceId` von Instanz B enthält
- **THEN** erweitert oder ersetzt dieser Wert den gebundenen DB-Kontext nicht
- **AND** wird der Scope-Konflikt fail-closed abgelehnt und auditiert

#### Scenario: Deaktivierung erhält Plugin-Daten

- **GIVEN** ein SSF-Tenant besitzt persistierte Daten
- **WHEN** das automatische SSF-Plugin für die Instanz deaktiviert oder die Instanz suspendiert wird
- **THEN** bleiben Tenantdatensatz, Revision und Audit-Historie erhalten
- **AND** werden sie nicht ohne separate autorisierte Lifecycle-Operation gelöscht

### Requirement: SSF-Tenant-Provisionierung nutzt den generischen Plugin-Lifecycle

Das System SHALL die Anlage eines SSF-Tenants als korrelierte Prozesskette aus Instanz, Realm, Clients, initialem Tenant-Admin, automatischer Plugin-Aktivierung, tenantlokaler SSF-IAM-Basis und SSF-Tenant-Grunddatensatz ausführen. Die SSF-Fachschritte MUST den generischen Plugin-Tenant-Lifecycle verwenden und bei Wiederholung denselben Sollzustand reconciliieren.

#### Scenario: Vollständige Tenant-Anlage wird ready

- **WHEN** alle Core-, IAM- und SSF-Lifecycle-Schritte für eine neue Instanz erfolgreich abgeschlossen sind
- **THEN** existieren genau ein Tenant-Realm, die erforderlichen Clients, genau der angeforderte initiale Tenant-Admin und genau ein SSF-Tenant-Grunddatensatz
- **AND** weist das System den SSF-Tenant erst danach als `ready` aus

#### Scenario: Teilfehler bleibt fail-closed und wiederholbar

- **GIVEN** Realm und Clients wurden erstellt, aber der SSF-Tenant-Grunddatensatz konnte nicht angelegt werden
- **WHEN** die Prozesskette den Fehler persistiert
- **THEN** bleibt der SSF-Tenant für Fachzugriffe gesperrt
- **AND** zeigt die Readiness den fehlgeschlagenen Plugin-Teilvertrag mit Korrelationsbezug
- **AND** legt ein Retry weder zweiten Realm noch zweiten Tenantdatensatz an

#### Scenario: Suspendierung und Reaktivierung bewahren Identität

- **GIVEN** ein betriebsbereiter SSF-Tenant wird durch einen Root-Admin suspendiert
- **WHEN** er später reaktiviert wird
- **THEN** verwendet das System dieselbe Instanz-, Realm- und Tenant-Identität
- **AND** reconciliert Aktivierung, IAM-Basis, Schema und Grunddatensatz vor erneuter Freigabe

### Requirement: Root-Status bleibt Teil der bestehenden Instanzverwaltung

Das System SHALL SSF-Aktivierung, Lifecycle, Readiness und Reparaturaktionen im bestehenden Instanz-Setup, -Cockpit und -Operations-Modell darstellen. Es MUST die Instanz-Registry als einzige führende Tenantliste verwenden.

#### Scenario: Root-Admin sieht SSF-Zustand in der Instanzdetailansicht

- **GIVEN** eine Studio-Instanz besitzt das aktive SSF-Plugin
- **WHEN** ein `instance_registry_admin` die Instanzdetailansicht öffnet
- **THEN** sieht er Aktivierungsrichtlinie, effektiven Zustand, Lifecycle-Job und SSF-Readiness
- **AND** kann eine zulässige Reparatur- oder Lifecycle-Aktion dort auslösen

#### Scenario: Es entsteht keine zweite SSF-Tenant-Registry

- **WHEN** Root-Navigation und Plugin-Beiträge materialisiert werden
- **THEN** bleibt die bestehende Instanzliste die kanonische Mandantenverwaltung
- **AND** führt das SSF-Plugin keine parallele Tenantliste mit eigenem Lebenszyklus ein
