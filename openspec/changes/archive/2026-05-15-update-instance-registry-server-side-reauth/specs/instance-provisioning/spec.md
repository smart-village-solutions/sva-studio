## MODIFIED Requirements
### Requirement: Administrativer Steuerungspfad für neue Instanzen

Das System SHALL einen administrativen Steuerungspfad für die Anlage und Verwaltung neuer Instanzen bereitstellen.

#### Scenario: Instanzanlage über Studio-Control-Plane

- **WHEN** ein berechtigter Admin eine neue Instanz im Studio anlegt
- **THEN** verwendet die UI denselben fachlichen Provisioning-Pfad wie automatisierte oder CLI-basierte Prozesse
- **AND** validiert `instanceId`, Hostname und Pflichtkonfiguration vor dem Start
- **AND** validiert der Pfad getrennt die Pflichtfelder für Login-Client und Tenant-Admin-Client
- **AND** ist der Zugriff auf dedizierte Admin-Rollen mit Least-Privilege begrenzt
- **AND** erfordern kritische Mutationen eine frische Re-Authentisierung

## ADDED Requirements
### Requirement: Serverseitig gebundene Fresh-Reauth fuer kritische Instanz-Mutationen

Das System SHALL fuer kritische Root-Host-Control-Plane-Mutationen der Instanzverwaltung einen serverseitig gebundenen Fresh-Reauth-Nachweis verlangen.

#### Scenario: Kritische Mutation mit gueltigem Fresh-Reauth-Nachweis

- **WHEN** ein berechtigter Root-Host-Operator eine kritische Instanz- oder Keycloak-Mutation ausfuehrt
- **AND** die Session eine serverseitig gesetzte Fresh-Reauth-Evidenz innerhalb des gueltigen Frischefensters traegt
- **THEN** darf die Mutation den Reauth-Guard passieren
- **AND** bleibt die Rollen- und Root-Host-Pruefung weiterhin zusaetzlich verpflichtend

#### Scenario: Kritische Mutation ohne serverseitige Fresh-Reauth-Evidenz

- **WHEN** ein berechtigter Root-Host-Operator eine kritische Instanz- oder Keycloak-Mutation ausfuehrt
- **AND** keine gueltige serverseitige Fresh-Reauth-Evidenz im Session-Kontext vorliegt
- **THEN** lehnt das System die Mutation fail-closed mit `reauth_required` oder gleichwertigem stabilem Fehlercode ab
- **AND** fuehrt es keine fachliche Mutation aus

#### Scenario: Klientseitige Reauth-Marker heben den Guard nicht auf

- **WHEN** ein Request fuer eine kritische Instanz- oder Keycloak-Mutation nur einen klientseitigen Header, Query-Parameter oder UI-Marker fuer Reauth mitliefert
- **THEN** hebt dieser Marker den Fresh-Reauth-Guard nicht auf
- **AND** bleibt allein die serverseitig gebundene Fresh-Reauth-Evidenz entscheidend

#### Scenario: Lokaler Nicht-Produktiv-Pfad bleibt explizit

- **WHEN** dieselbe Mutation in einem explizit als lokal oder nicht-produktiv definierten Entwicklungsprofil ausgefuehrt wird
- **THEN** verwendet das System einen dokumentierten serverseitigen Dev-Pfad oder einen expliziten Nicht-Produktiv-Bypass
- **AND** ist dieses Verhalten ausserhalb dieser Profile nicht verfuegbar
