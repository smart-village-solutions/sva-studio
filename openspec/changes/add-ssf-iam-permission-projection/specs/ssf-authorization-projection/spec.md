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

### Requirement: Permission-Änderungen widerrufen bestehende SSF-Sessions

Das System SHALL nach bestätigter Änderung der effektiven SSF-Permissions alle
betroffenen bestehenden SSF-Sessions über eine tenantgebundene SSF-
Sessiongrenze widerrufen, bevor der neue Zustand als vollständig konvergiert
gilt. Ein reiner SSF-Permission-Wechsel MUST NOT einen realmweiten
Keycloak-Benutzerlogout auslösen. Studio MUST den ausgehenden Aufruf mit einer
eigenen technischen Service-Identität authentifizieren, an die kanonische
Studio-Instanz und die bestätigte `authorizationRevision` binden und
idempotent sowie mit begrenzter Laufzeit ausführen.

#### Scenario: Permission-Änderung konvergiert

- **GIVEN** eine effektive SSF-Permission eines Tenants ändert sich
- **WHEN** die neue Projektion bestätigt wurde
- **THEN** werden bestehende SSF-Sessions dieses Tenants widerrufen
- **AND** enthalten neu ausgestellte Tokens die neue Revision
- **AND** bleiben Sessions anderer Tenants unverändert
- **AND** bleiben Studio-Sessions desselben Benutzers bestehen

#### Scenario: Studio wiederholt einen unbestätigten Widerruf

- **GIVEN** Studio hat für einen Tenant und eine bestätigte Revision einen Widerruf angefordert, aber keine erfolgreiche Antwort erhalten
- **WHEN** der begrenzte Retry denselben Widerruf erneut sendet
- **THEN** verwendet Studio denselben deterministischen Idempotency-Key und denselben Payload
- **AND** wird kein anderer Tenant adressiert

#### Scenario: SSF-Provider ist noch nicht verfügbar

- **GIVEN** der Studio-Consumer ist implementiert, aber SSF stellt den vereinbarten Provider noch nicht bereit
- **WHEN** der Plugin-Lifecycle den Widerruf ausführt
- **THEN** bleibt die Projektion außerhalb von `ready`
- **AND** bleiben produktive Runtime-Freigabe und neue SSF-Tokenausstellung gesperrt
