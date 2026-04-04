## ADDED Requirements
### Requirement: Instanzdetails enthalten Keycloak-Bootstrap-Zustand
Das System SHALL im Instanzdetail den relevanten Keycloak-Bootstrap-Zustand einer Instanz ohne Offenlegung von Secrets bereitstellen.

#### Scenario: Instanzdetail zeigt Secret nur als Konfigurationszustand
- **WHEN** ein Plattform-Admin das Detail einer Instanz lädt
- **THEN** enthält die Antwort nur ein Flag, ob ein Tenant-Client-Secret konfiguriert ist
- **AND** niemals den Secret-Klartext

#### Scenario: Instanzdetail zeigt Keycloak-Readiness
- **WHEN** ein Plattform-Admin den Keycloak-Status einer Instanz abfragt
- **THEN** enthält die Antwort Informationen zu Realm, Client, Mapper, Redirect-/Logout-Drift und Tenant-Admin-Rollen

### Requirement: Tenant-spezifische Client-Secrets bleiben write-only
Das System SHALL tenant-spezifische OIDC-Client-Secrets write-only behandeln.

#### Scenario: Update ohne neues Secret behält bestehendes Secret
- **WHEN** eine Instanz aktualisiert wird ohne neues Client-Secret
- **THEN** bleibt das bestehende Secret unverändert gespeichert

#### Scenario: Reconcile nutzt das gespeicherte Secret
- **WHEN** ein Keycloak-Reconcile ausgeführt wird
- **THEN** verwendet er das verschlüsselt gespeicherte tenant-spezifische Client-Secret für den Ziel-Client
