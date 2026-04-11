## MODIFIED Requirements
### Requirement: Root-Host rendert die globale Instanzverwaltung
Der Root-Host SHALL die globale Instanzverwaltung bereitstellen und dabei Registry-, Preflight-, Plan- und Keycloak-Basiszustand pro Instanz bearbeiten und verifizieren können.

#### Scenario: Plattform-Admin pflegt Tenant-Realm-Grundeinstellungen
- **WHEN** ein Benutzer mit `instance_registry_admin` die Seite `/admin/instances` auf dem Root-Host öffnet
- **THEN** kann er die Realm-Grundeinstellungen einer Instanz bearbeiten
- **AND** das Studio kann Preflight, Plan und Keycloak-Status der Instanz gegen Realm, Client, Mapper und Tenant-Admin prüfen
- **AND** die UI trennt zwischen `Instanzdaten speichern` und `Provisioning ausführen`

#### Scenario: Tenant-Host zeigt keine globale Instanzverwaltung
- **WHEN** dieselbe Seite auf einem Tenant-Host angefragt wird
- **THEN** bleibt die globale Instanzverwaltung gesperrt

### Requirement: Registry und Keycloak bleiben pro Instanz abgleichbar
Das System SHALL pro Instanz einen idempotenten, realm-modusbewussten Abgleich zwischen Registry-Daten und Keycloak-Basiszustand unterstützen.

#### Scenario: Keycloak-Provisioning gleicht den Tenant-Basiszustand an
- **WHEN** ein Plattform-Admin für eine Instanz ein Provisioning mit Realm-Modus `new` oder `existing` auslöst
- **THEN** werden Realm, OIDC-Client, Redirect- und Logout-Ziele, `instanceId`-Mapper und initialer Tenant-Admin auf den im Studio gepflegten Sollzustand abgeglichen
- **AND** der Lauf erzeugt ein sichtbares Schrittprotokoll mit `requestId` und Ergebnisstatus
