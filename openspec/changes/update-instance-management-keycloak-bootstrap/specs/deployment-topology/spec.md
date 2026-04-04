## MODIFIED Requirements
### Requirement: Root-Host rendert die globale Instanzverwaltung
Der Root-Host SHALL die globale Instanzverwaltung bereitstellen und dabei Registry- sowie Keycloak-Basiszustand pro Instanz bearbeiten und verifizieren können.

#### Scenario: Plattform-Admin pflegt Tenant-Realm-Grundeinstellungen
- **WHEN** ein Benutzer mit `instance_registry_admin` die Seite `/admin/instances` auf dem Root-Host öffnet
- **THEN** kann er die Realm-Grundeinstellungen einer Instanz bearbeiten
- **AND** das Studio kann den Keycloak-Status der Instanz gegen Realm, Client, Mapper und Tenant-Admin prüfen

#### Scenario: Tenant-Host zeigt keine globale Instanzverwaltung
- **WHEN** dieselbe Seite auf einem Tenant-Host angefragt wird
- **THEN** bleibt die globale Instanzverwaltung gesperrt

### Requirement: Registry und Keycloak bleiben pro Instanz abgleichbar
Das System SHALL pro Instanz einen idempotenten Abgleich zwischen Registry-Daten und Keycloak-Basiszustand unterstützen.

#### Scenario: Keycloak-Reconcile gleicht den Tenant-Basiszustand an
- **WHEN** ein Plattform-Admin für eine Instanz einen Keycloak-Reconcile auslöst
- **THEN** werden Realm, OIDC-Client, Redirect- und Logout-Ziele, `instanceId`-Mapper und initialer Tenant-Admin auf den im Studio gepflegten Sollzustand abgeglichen
