# instance-provisioning Specification

## Purpose

Spezifikation für den automatisierten Provisioning-Workflow neuer Studio-Instanzen, einschließlich Keycloak-Realm-Verwaltung, IAM-Basis-Konfiguration und idempotenter Fehlerbehandlung.
## Requirements
### Requirement: Zentrale Instanz-Registry

Das System SHALL eine zentrale Registry für Studio-Instanzen bereitstellen, die Tenant-Identität, Hostnamen, Lebenszyklusstatus und Basis-Konfiguration führt.

#### Scenario: Aktive Instanz ist in der Registry beschrieben

- **WHEN** eine Studio-Instanz produktiv erreichbar sein soll
- **THEN** existiert ein Registry-Eintrag mit `instanceId`, `status`, `primaryHostname` und den benötigten Basis-Metadaten
- **AND** enthält der Auth-Vertrag mindestens `authRealm`, `authClientId` und `tenantAdminClient`
- **AND** kann die Runtime daraus Tenant-Kontext, Login-Konfiguration und Tenant-Admin-Konfiguration getrennt ableiten

### Requirement: Gesteuerter Tenant-Lebenszyklus

Das System SHALL den Lebenszyklus einer Instanz über explizite Statuswerte steuern.

#### Scenario: Instanz wird aktiviert

- **WHEN** eine neue Instanz erfolgreich provisioniert und freigegeben wurde
- **THEN** wechselt ihr Status kontrolliert auf `active`
- **AND** erst ab diesem Zeitpunkt darf produktiver Traffic für ihren Host zugelassen werden

#### Scenario: Instanz wird suspendiert oder archiviert

- **WHEN** eine Instanz außer Betrieb genommen oder temporär gesperrt wird
- **THEN** wird ihr Status fachlich nachvollziehbar auf `suspended` oder `archived` gesetzt
- **AND** produktiver Host-Traffic wird danach fail-closed abgelehnt

### Requirement: Idempotenter Provisioning-Workflow

Das System SHALL neue Instanzen über einen idempotenten Provisioning-Workflow anlegen, der technische Teilaufgaben und Teilfehler kontrolliert behandelt.

#### Scenario: Erfolgreiche Neuanlage einer Instanz

- **WHEN** eine berechtigte Person eine neue Instanz mit gültiger `instanceId` und gültigem Ziel-Hostname anfordert
- **THEN** legt das System einen Provisioning-Lauf an
- **AND** erstellt oder reserviert die benötigten Registry- und Basis-Konfigurationsartefakte
- **AND** erzeugt oder validiert getrennt den Login-Client `authClientId` und den Tenant-Admin-Client `tenantAdminClient.clientId`
- **AND** dokumentiert den Übergang bis zum Status `active`

### Requirement: Administrativer Steuerungspfad für neue Instanzen

Das System SHALL einen administrativen Steuerungspfad für die Anlage und Verwaltung neuer Instanzen bereitstellen.

#### Scenario: Instanzanlage über Studio-Control-Plane

- **WHEN** ein berechtigter Admin eine neue Instanz im Studio anlegt
- **THEN** verwendet die UI denselben fachlichen Provisioning-Pfad wie automatisierte oder CLI-basierte Prozesse
- **AND** validiert `instanceId`, Hostname und Pflichtkonfiguration vor dem Start
- **AND** validiert der Pfad getrennt die Pflichtfelder für Login-Client und Tenant-Admin-Client
- **AND** ist der Zugriff auf dedizierte Admin-Rollen mit Least-Privilege begrenzt
- **AND** erfordern kritische Mutationen eine frische Re-Authentisierung

### Requirement: Auditierbarkeit von Tenant-Mutationen

Das System SHALL jede Anlage, Aktivierung, Suspendierung, Archivierung und relevante Rekonfiguration einer Instanz auditierbar machen.

#### Scenario: Mutationen einer Instanz werden nachvollziehbar gespeichert

- **WHEN** ein Operator den Zustand oder die Basis-Konfiguration einer Instanz ändert
- **THEN** speichert das System den fachlichen Vorgang mit Zeitbezug und Akteur-Kontext
- **AND** können spätere Betriebs- und Support-Fälle diese Änderung nachvollziehen
- **AND** enthalten Audit-Ereignisse mindestens `instanceId`, Akteur, Aktion, Ergebnis und Korrelation (`requestId` oder gleichwertig)
- **AND** werden Audit-Ereignisse append-only gespeichert

### Requirement: Tenant-Isolation bei Tenant-Mutationen

Das System SHALL tenant-fremde Lese- und Schreiboperationen für Instanzverwaltung und Provisioning fail-closed ablehnen.

#### Scenario: Tenant-fremde Mutation wird abgelehnt

- **WHEN** ein Aufruf eine Mutation für eine Instanz außerhalb des zulässigen Tenant-Kontexts ausführen will
- **THEN** lehnt das System den Aufruf fail-closed ab
- **AND** bleibt das Außenverhalten ohne tenant-spezifische Detailoffenlegung

### Requirement: Reproduzierbare lokale Test- und Seed-Pfade für Instanzen

Das System SHALL reproduzierbare lokale Seed- und Testpfade für Instanzen bereitstellen, damit Registry-Auflösung und Provisioning ohne produktive Infrastruktur prüfbar bleiben.

#### Scenario: Lokale Seed-Instanzen stehen für Entwicklung bereit

- **WHEN** ein Teammitglied einen lokalen Standardmodus startet
- **THEN** stehen mindestens zwei aktive Seed-Instanzen für Entwicklung und Tests reproduzierbar bereit
- **AND** ist mindestens ein negativer Tenant-Fall für fail-closed-Tests definiert

#### Scenario: Lokales Provisioning nutzt denselben fachlichen Vertrag

- **WHEN** eine neue Instanz lokal über CLI, Test-Setup oder Admin-Pfad angelegt wird
- **THEN** nutzt dieser Pfad dieselben Validierungs- und Statusregeln wie der produktive Provisioning-Vertrag
- **AND** kann die neue Instanz ohne neues App-Deployment im lokalen Multi-Tenant-Pfad getestet werden

### Requirement: Runtime-IAM und Provisioning verwenden kompatible Driftklassifikation

Das System SHALL Runtime-IAM-Fehler und Instanz-/Keycloak-Provisioning-Drift auf denselben kompatiblen Driftklassifikationen aufbauen, damit UI und Betrieb dieselbe Ursache entlang von Runtime, Preflight, Plan und Run nachvollziehen können.

#### Scenario: Runtime-Fehler und Instanzpanel sprechen dieselbe Drift-Sprache

- **WHEN** ein Tenant sowohl im Runtime-IAM-Fehlerfall als auch im Instanzpanel betrachtet wird
- **THEN** verwenden beide Pfade kompatible Klassifikationen für Realm-, Client-, Secret-, Mapper- und Tenant-Admin-Drift
- **AND** kann das Instanzpanel aus einem Runtime-Fehler heraus mit konsistentem Diagnosewortschatz fortgesetzt werden

### Requirement: Verzahnte Runtime- und Provisioning-Diagnose für Tenant-IAM

Das System SHALL Runtime-IAM-Fehler und Instanz-/Keycloak-Provisioning-Diagnosen so aufeinander beziehen, dass Tenant-Drift zwischen Registry, Realm, Clients, Secrets und Runtime-Konfiguration nicht in getrennten Diagnosewelten bearbeitet werden muss.

#### Scenario: Runtime-Fehler verweist auf tenant-spezifische Driftklasse

- **WHEN** ein Runtime-IAM-Fehler auf fehlende oder inkonsistente Tenant-Konfiguration hindeutet
- **THEN** ordnet das System den Fehler einer Drift- oder Provisioning-nahen Fehlerklasse zu
- **AND** kann diese Klasse mit bestehenden Keycloak-Preflight-, Plan- oder Run-Informationen korreliert werden

#### Scenario: Preflight und Runtime nutzen kompatible Diagnosebegriffe

- **WHEN** die UI oder der Betrieb denselben Tenant sowohl im Instanz-/Keycloak-Panel als auch in einem Runtime-IAM-Fehlerfall betrachtet
- **THEN** verwenden beide Pfade kompatible Diagnosebegriffe für Realm-, Client-, Secret-, Mapper- oder Tenant-Admin-Abweichungen
- **AND** müssen Operatoren die Ursache nicht aus widersprüchlichen Zustandsmodellen ableiten

#### Scenario: Runtime-Drift kann auf Provisioning-Evidenz verweisen

- **WHEN** ein Runtime-IAM-Fehler als `registry_or_provisioning_drift` klassifiziert wird
- **THEN** kann der Diagnosepfad auf vorhandene Preflight-, Plan- oder Run-Evidenz mit korrelierbarer Request-ID oder gleichwertigem Referenzanker verweisen
- **AND** bleibt für UI und Betrieb sichtbar, ob das Problem aus Runtime-Konfiguration, Provisioning-Blockern oder nachträglicher Drift stammt

### Requirement: Getrennter Tenant-Admin-Client-Vertrag pro Instanz

Das System SHALL pro Instanz einen separaten technischen Vertrag für den tenant-lokalen Admin-Client führen.

#### Scenario: Registry beschreibt Login- und Admin-Client getrennt

- **WHEN** eine Instanz gelesen oder aktualisiert wird
- **THEN** enthält der Instanzvertrag `authClientId` für den interaktiven Login-Pfad
- **AND** enthält er zusätzlich `tenantAdminClient.clientId`
- **AND** enthält `tenantAdminClient` mindestens den Secret-Status
- **AND** bleibt das zugehörige Secret write-only

#### Scenario: Tenant-Admin-Client fehlt bei betriebsfähiger Tenant-Administration

- **WHEN** eine Instanz keinen vollständigen `tenantAdminClient` besitzt
- **THEN** markieren Preflight, Doctor oder Status diesen Zustand als `warning` oder `blocked`
- **AND** normale Tenant-Admin-Mutationen werden nicht freigeschaltet

### Requirement: Provisioning prüft Login-Client und Tenant-Admin-Client getrennt

Das System SHALL Login-Client und Tenant-Admin-Client im Provisioning und Reconcile getrennt prüfen und ausweisen.

#### Scenario: Preflight weist getrennte Client-Artefakte aus

- **WHEN** ein Preflight oder Statuslauf für eine Instanz ausgeführt wird
- **THEN** enthält die Checkliste getrennte Einträge für Login-Client und Tenant-Admin-Client
- **AND** zeigen Details Realm, Client-ID, Secret-Status und Drift je Artefakt getrennt

#### Scenario: Provisioning erzeugt fehlenden Tenant-Admin-Client nach

- **WHEN** Realm und Login-Client existieren, der Tenant-Admin-Client aber fehlt
- **THEN** darf der Provisioning-Lauf genau diesen Client idempotent nachziehen
- **AND** bleibt der Lauf auditierbar und deterministisch wiederholbar

