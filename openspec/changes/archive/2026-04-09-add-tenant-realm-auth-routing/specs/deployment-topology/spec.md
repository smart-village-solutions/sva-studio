## MODIFIED Requirements

### Requirement: Multi-Host-Runtime nutzt tenant-spezifische Auth-Konfiguration
Die Plattform SHALL Authentifizierung und Keycloak-Admin-Operationen für Tenant-Hosts aus der Instanz-Registry auflösen statt aus globalen produktiven Realm-Variablen.

#### Scenario: Tenant-Host startet Login im eigenen Realm
- **WHEN** ein anonymer Nutzer `https://bb-guben.studio.smart-village.app/auth/login` aufruft
- **THEN** die Runtime löst `bb-guben` aus der Registry auf
- **AND** startet den OIDC-Flow gegen den für `bb-guben` gespeicherten Realm
- **AND** verwendet Redirect- und Logout-URLs auf demselben Tenant-Host
