## ADDED Requirements
### Requirement: Instanzdetails enthalten Keycloak-Control-Plane-Zustand
Das System SHALL im Instanzdetail den relevanten Keycloak-Control-Plane-Zustand einer Instanz ohne Offenlegung von Secrets bereitstellen.

#### Scenario: Instanzdetail zeigt Secret nur als Konfigurationszustand
- **WHEN** ein Plattform-Admin das Detail einer Instanz lädt
- **THEN** enthält die Antwort nur ein Flag, ob ein Tenant-Client-Secret konfiguriert ist
- **AND** niemals den Secret-Klartext

#### Scenario: Instanzdetail zeigt Keycloak-Readiness
- **WHEN** ein Plattform-Admin den Keycloak-Status einer Instanz abfragt
- **THEN** enthält die Antwort Informationen zu Realm, Client, Mapper, Redirect-/Logout-Drift und Tenant-Admin-Rollen

#### Scenario: Instanzdetail zeigt Preflight, Plan und Provisioning-Runs
- **WHEN** ein Plattform-Admin das Detail einer Instanz lädt
- **THEN** enthält die Antwort zusätzlich den aktuellen Preflight, den aktuellen Plan und die bekannten Provisioning-Runs
- **AND** jeder Run enthält Modus, Intent, Gesamtstatus, Drift-Zusammenfassung und Schrittprotokoll

### Requirement: Tenant-spezifische Client-Secrets bleiben write-only
Das System SHALL tenant-spezifische OIDC-Client-Secrets write-only behandeln.

#### Scenario: Update ohne neues Secret behält bestehendes Secret
- **WHEN** eine Instanz aktualisiert wird ohne neues Client-Secret
- **THEN** bleibt das bestehende Secret unverändert gespeichert

#### Scenario: Reconcile nutzt das gespeicherte Secret
- **WHEN** ein Keycloak-Provisioning ausgeführt wird
- **THEN** verwendet er das verschlüsselt gespeicherte tenant-spezifische Client-Secret für den Ziel-Client

### Requirement: Keycloak-Provisioning folgt einem expliziten Ablauf
Das System SHALL Keycloak-Provisioning als expliziten Ablauf aus Preflight, Plan, Ausführung und persistiertem Protokoll modellieren.

#### Scenario: Blockierter Preflight verhindert Provisioning
- **WHEN** ein Preflight den Status `blocked` liefert
- **THEN** wird kein Keycloak-Mutationslauf ausgeführt
- **AND** der erzeugte Run bleibt als fehlgeschlagener oder blockierter Vorgang nachvollziehbar

#### Scenario: Getrennte Aktionen für Speichern und Ausführen
- **WHEN** ein Plattform-Admin Instanzdaten aktualisiert
- **THEN** schreibt die Operation nur Registry-Daten
- **AND** eine Keycloak-Mutation erfolgt erst durch einen separaten Execute-Aufruf
