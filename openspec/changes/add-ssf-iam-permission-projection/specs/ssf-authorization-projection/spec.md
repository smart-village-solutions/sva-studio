## ADDED Requirements

### Requirement: SSF-Autorisierung verwendet eine verifizierte tenantweite Projektion

Das System SHALL eine `authorizationRevision` ausschließlich aus einer
erfolgreich materialisierten und zurückgelesenen Permission-Projektion des
betroffenen Tenants ableiten. Gewünschte Permissions, Cachezustände und
Testkonstanten MUST im Produktivprofil als Revisionsquelle abgewiesen werden.

#### Scenario: Bestätigte Projektion wird bereit

- **GIVEN** die effektiven SSF-Permissions eines Tenants wurden in den SSF-Client-Scope seines gemeinsamen Tenant-Realms projiziert
- **AND** der anschließende Read-back bestätigt exakt diese Projektion
- **WHEN** Studio die SSF-Autorisierungsreadiness auswertet
- **THEN** liefert es den deterministischen Fingerprint als `authorizationRevision`

#### Scenario: Projektion oder Read-back schlägt fehl

- **GIVEN** Write, Read-back oder Reconcile der Tenantprojektion ist unvollständig
- **WHEN** SSF Runtime-Konfiguration oder eine neue Session anfordert
- **THEN** bleibt der Tenant für SSF-Autorisierung nicht bereit
- **AND** wird keine frühere oder gewünschte Revision als erfolgreich ausgegeben

### Requirement: Token und Runtime-Antwort sind revisionsgebunden

Das System MUST SSF-Tenant-Benutzertokenclaims und Runtime-Konfiguration für
einen Tenant an dieselbe bestätigte `authorizationRevision` binden. Das
installationsweite SSF-Service-Token MUST davon unabhängig bleiben und nur die
technische Backend-Identität, Audience und Action nachweisen. Ein Mismatch des
Benutzertokenclaims MUST fail-closed behandelt werden.

#### Scenario: Revisionen stimmen überein

- **GIVEN** Tenant-Benutzertokenclaim, bestätigte Projektion und Runtime-Antwort besitzen dieselbe Revision
- **WHEN** SSF eine neue Session aufbaut
- **THEN** darf SSF die projizierten Permissions verwenden

#### Scenario: Token ist veraltet

- **GIVEN** der Tenant-Benutzertokenclaim entspricht nicht mehr der bestätigten Tenantprojektion
- **WHEN** SSF den Token verwendet
- **THEN** wird der Zugriff abgewiesen
- **AND** ist eine erneute Tokenausstellung erforderlich

### Requirement: Alte Rechte laufen begrenzt aus

Das System SHALL die Projektion nach erfolgreichem Keycloak-Write, identischem
Read-back und erneuter Aktivierung des tenantlokalen SSF-Clients als `ready`
veröffentlichen. Ein Session-Widerruf MUST dafür nicht erforderlich sein. Für
ein produktives Enablement MUST nachgewiesen sein, dass SSF-Benutzer-Access-
Tokens höchstens 15 Minuten gültig sind. Refresh oder Neuausstellung MUST die
aktuell projizierten Claims verwenden.

#### Scenario: Permission-Änderung konvergiert ohne Session-Widerruf

- **GIVEN** eine effektive SSF-Permission eines Tenants ändert sich
- **WHEN** Write und Read-back die neue Projektion bestätigen und der SSF-Client wieder aktiviert ist
- **THEN** wird die bestätigte Revision als `ready` veröffentlicht
- **AND** enthalten neu ausgestellte Tokens die neue Revision
- **AND** wird kein erfolgreicher Session-Widerruf behauptet

#### Scenario: Bereits ausgestellter Token trägt alte Rechte

- **GIVEN** ein vor der Permission-Änderung ausgestellter SSF-Benutzer-Access-Token ist noch gültig
- **WHEN** die neue Projektion als `ready` veröffentlicht wird
- **THEN** darf der alte Token nur bis zu seinem Ablauf weiterwirken
- **AND** beträgt diese Nachwirkung höchstens 15 Minuten

#### Scenario: Optionale spätere Härtung ist nicht verfügbar

- **GIVEN** der tenantgebundene SSF-Session-Widerruf ist nicht konfiguriert oder nicht erreichbar
- **WHEN** Write, Read-back und erneute Client-Aktivierung erfolgreich sind
- **THEN** blockiert das die Projektionsreadiness nicht
- **AND** bleiben vorhandene Widerrufsfelder ohne falsche Erfolgsbestätigung leer
