## ADDED Requirements
### Requirement: Tenant-Auth-Vertrag priorisiert Host- und Realm-Scope
Das System SHALL fuer tenant-spezifische Studio-Instanzen den Tenant-Kontext primaer ueber Registry, Hostname und den zugeordneten Realm modellieren.

#### Scenario: Tenant-Realm ist die fuehrende technische Benutzergrenze

- **WHEN** eine aktive Instanz ueber `primaryHostname`, `authRealm` und `authClientId` in der Registry beschrieben ist
- **THEN** ist ein erfolgreicher Login im zugeordneten Tenant-Realm technisch ausreichend, um den Benutzer dem Tenant-Kontext dieser Instanz zuzuordnen
- **AND** die Runtime leitet `instanceId` fuer die Session aus diesem tenant-spezifischen Auth-Scope ab
- **AND** ein zusaetzliches benutzerbezogenes Keycloak-Attribut `instanceId` ist dafuer keine normative Vorbedingung

### Requirement: Keycloak-Artefakte unterscheiden zwischen Login-Vertrag und Interop
Das System SHALL Keycloak-Artefakte fuer tenant-spezifische Instanzen danach unterscheiden, ob sie fuer den interaktiven Login-Vertrag zwingend oder nur fuer Interoperabilitaet, Diagnose oder Zusatzprozesse relevant sind.

#### Scenario: instanceId-Mapper ist kein hartes Login-Gate mehr

- **WHEN** fuer eine aktive Instanz der OIDC-Client, Realm, Redirect- und Logout-URLs korrekt am Tenant-Host ausgerichtet sind
- **THEN** bleibt ein fehlender Protocol Mapper `instanceId` ein Diagnose- oder Interop-Befund
- **AND** er blockiert tenant-spezifische Studio-Logins nicht als eigener Pflichtvertrag
- **AND** Checklisten, Statusanzeigen und Doku unterscheiden explizit zwischen Login-relevanten Pflichtartefakten und optionalen Zusatzartefakten
- **AND** ein fehlendes Tenant-Admin-User-Attribut `instanceId` wird analog als Warnung oder Diagnosehinweis behandelt
