# instance-provisioning Specification

## Purpose

Spezifikation für den automatisierten Provisioning-Workflow neuer Studio-Instanzen, einschließlich Keycloak-Realm-Verwaltung, IAM-Basis-Konfiguration und idempotenter Fehlerbehandlung.

## Requirements
### Requirement: Zentrale Instanz-Registry

Das System SHALL eine zentrale Registry für Studio-Instanzen bereitstellen, die Tenant-Identität, Hostnamen, Lebenszyklusstatus und Basis-Konfiguration führt.

#### Scenario: Aktive Instanz ist in der Registry beschrieben

- **WHEN** eine Studio-Instanz produktiv erreichbar sein soll
- **THEN** existiert ein Registry-Eintrag mit `instanceId`, `status`, `primaryHostname` und den benötigten Basis-Metadaten
- **AND** die Runtime kann daraus Tenant-Kontext und Tenant-Konfiguration ableiten

#### Scenario: Registry ist die fuehrende Freigabequelle

- **WHEN** die Runtime prüft, ob ein Tenant-Host gültig ist
- **THEN** trifft sie die fachliche Freigabeentscheidung anhand der Registry
- **AND** verwendet keine tenant-spezifischen App-Deployments als Ersatz für diese Entscheidung

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
- **AND** dokumentiert den Übergang bis zum Status `active`

#### Scenario: Wiederholung nach Teilfehler

- **WHEN** ein Provisioning-Lauf nach einem technischen Teilfehler erneut gestartet wird
- **THEN** fuehrt das System bereits erfolgreich abgeschlossene Schritte nicht unkontrolliert doppelt aus
- **AND** bleibt der Lauf fuer Operatoren nachvollziehbar

#### Scenario: Parallele Provisioning-Anforderung fuer dieselbe Instanz

- **WHEN** zwei Provisioning-Anforderungen fuer dieselbe `instanceId` nahezu zeitgleich eingehen
- **THEN** erlaubt das System hoechstens einen aktiven Lauf
- **AND** liefert fuer weitere Anforderungen eine deterministische Konfliktbehandlung ohne Doppelanlage

### Requirement: Administrativer Steuerungspfad fuer neue Instanzen

Das System SHALL einen administrativen Steuerungspfad fuer die Anlage und Verwaltung neuer Instanzen bereitstellen.

#### Scenario: Instanzanlage ueber Studio-Control-Plane

- **WHEN** ein berechtigter Admin eine neue Instanz im Studio anlegt
- **THEN** verwendet die UI denselben fachlichen Provisioning-Pfad wie automatisierte oder CLI-basierte Prozesse
- **AND** validiert `instanceId`, Hostname und Pflichtkonfiguration vor dem Start
- **AND** ist der Zugriff auf dedizierte Admin-Rollen mit Least-Privilege begrenzt
- **AND** erfordern kritische Mutationen eine frische Re-Authentisierung

#### Scenario: Instanzanlage ueber nicht-interaktiven Ops-Pfad

- **WHEN** eine Instanz ueber einen CLI- oder Automationspfad angelegt wird
- **THEN** nutzt dieser Pfad denselben fachlichen Provisioning-Vertrag
- **AND** ist der Lauf auditierbar und fuer wiederholbare Automation geeignet
- **AND** nutzt der Pfad kurzlebige Maschinenidentitaeten statt statischer Shared-Credentials

### Requirement: Auditierbarkeit von Tenant-Mutationen

Das System SHALL jede Anlage, Aktivierung, Suspendierung, Archivierung und relevante Rekonfiguration einer Instanz auditierbar machen.

#### Scenario: Mutationen einer Instanz werden nachvollziehbar gespeichert

- **WHEN** ein Operator den Zustand oder die Basis-Konfiguration einer Instanz aendert
- **THEN** speichert das System den fachlichen Vorgang mit Zeitbezug und Akteur-Kontext
- **AND** koennen spaetere Betriebs- und Supportfaelle diese Aenderung nachvollziehen
- **AND** enthalten Audit-Ereignisse mindestens `instanceId`, Akteur, Aktion, Ergebnis und Korrelation (`requestId` oder gleichwertig)
- **AND** werden Audit-Ereignisse append-only gespeichert

### Requirement: Tenant-Isolation bei Tenant-Mutationen

Das System SHALL tenant-fremde Lese- und Schreiboperationen fuer Instanzverwaltung und Provisioning fail-closed ablehnen.

#### Scenario: Tenant-fremde Mutation wird abgelehnt

- **WHEN** ein Aufruf eine Mutation fuer eine Instanz ausserhalb des zulaessigen Tenant-Kontexts ausfuehren will
- **THEN** lehnt das System den Aufruf fail-closed ab
- **AND** bleibt das Aussenverhalten ohne tenant-spezifische Detailoffenlegung

### Requirement: Reproduzierbare lokale Test- und Seed-Pfade fuer Instanzen

Das System SHALL reproduzierbare lokale Seed- und Testpfade fuer Instanzen bereitstellen, damit Registry-Aufloesung und Provisioning ohne produktive Infrastruktur pruefbar bleiben.

#### Scenario: Lokale Seed-Instanzen stehen fuer Entwicklung bereit

- **WHEN** ein Teammitglied einen lokalen Standardmodus startet
- **THEN** stehen mindestens zwei aktive Seed-Instanzen fuer Entwicklung und Tests reproduzierbar bereit
- **AND** ist mindestens ein negativer Tenant-Fall fuer fail-closed-Tests definiert

#### Scenario: Lokales Provisioning nutzt denselben fachlichen Vertrag

- **WHEN** eine neue Instanz lokal ueber CLI, Test-Setup oder Admin-Pfad angelegt wird
- **THEN** nutzt dieser Pfad dieselben Validierungs- und Statusregeln wie der produktive Provisioning-Vertrag
- **AND** kann die neue Instanz ohne neues App-Deployment im lokalen Multi-Tenant-Pfad getestet werden
