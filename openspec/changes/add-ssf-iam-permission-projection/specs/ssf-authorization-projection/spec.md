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

### Requirement: Gesprächszugriff benötigt keine projizierten Benutzerclaims

Das System MUST die Benutzerclaims `studio_tenant_id`,
`ssf_authorization_revision`, `ssf_permissions` und `ssf_roles` als Voraussetzung
für Gesprächszugriff als deprecated kennzeichnen. Nach der Consumer-Umstellung in SSF #438
MUST ein gültiges reguläres Keycloak-Benutzertoken eines zugelassenen
Tenant-Realms für Gesprächszugriff ausreichen. Der Tenant MUST ausschließlich
über den verifizierten Aussteller und dessen eindeutige Zuordnung im
vertrauenswürdigen Login-Verzeichnis bestimmt werden.

Der Vergleich einer Benutzerrevision mit der Runtime-Antwort MUST für
Gesprächszugriff entfallen. Die Runtime-Felder `authorizationRevision` und
`configurationRevision`, Service-Autorisierung, Tenant-Isolation und gesonderte
Verwaltungsberechtigungen MUST erhalten bleiben. Studio MUST die vorhandenen
Producer bis zur geprüften Migration ihrer verbleibenden Verbraucher erhalten.
Diese Deprecation allein MUST keine Studio-Readiness-Gates abschalten.

#### Scenario: Aktives Konto ohne SSF-Sonderattribute

- **GIVEN** SSF #438 ist umgesetzt und der Tenant ist veröffentlicht und betriebsbereit
- **AND** ein reguläres Keycloak-Konto besitzt ein gültiges SSF-Benutzertoken ohne die deprecated Claims
- **WHEN** der Nutzer eine Gesprächsfunktion aufruft
- **THEN** berechtigt der gültige Login zur Nutzung innerhalb des aus dem Aussteller bestimmten Tenants
- **AND** ist kein entsprechender Studio-IAM-Account als zusätzliche Gesprächsvoraussetzung erforderlich

#### Scenario: Legacy-Felder ändern keine Gesprächsberechtigung

- **GIVEN** der SSF-Consumer wurde umgestellt und der Tenant aus dem verifizierten Aussteller bestimmt
- **WHEN** deprecated Benutzerfelder fehlen, veraltet oder fehlerhaft geformt sind
- **THEN** blockieren diese Felder allein den Gesprächszugriff nicht
- **AND** können sie weder die Tenant-Zuordnung ändern noch Verwaltungsrechte freigeben

#### Scenario: Producer bleibt während der Migration kompatibel

- **GIVEN** bisherige Consumer benötigen noch projizierte Claims
- **WHEN** Studio die Deprecation dokumentiert
- **THEN** bleiben bestehende Claims, Schemas und Laufzeitprüfungen unverändert
- **AND** erfolgt die Entfernung erst nach verifizierter Consumer-Migration

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

### Requirement: Readiness berücksichtigt aktuelle Login-Voraussetzungen

Eine gespeicherte identische Projektionsrevision SHALL allein kein `ready`
begründen. Der Lifecycle MUST Client-Verträge, Claim-Mapper und Tenant-Baseline
verifizieren und veraltete Ready-Generationen unter demselben Tenant-Lock erneut
beanspruchen. Directory und Runtime MUST denselben hostseitigen Readiness-Pfad
verwenden; eine während des Read-back wechselnde Revision sperrt die Freigabe.

#### Scenario: Gleiche Revision mit fehlender Baseline

- **GIVEN** eine gespeicherte Projektion ist `ready`, aber Client oder Tenant-Grunddatensatz fehlt
- **WHEN** ein Reconcile ausgeführt wird
- **THEN** stellt er die Voraussetzungen idempotent her und prüft die Projektion erneut
- **AND** darf ein Fehler keine neue Veröffentlichung auslösen

#### Scenario: Fehler nach Aktivierung

- **WHEN** die gemeinsame Readiness-Prüfung nach Aktivierung des Browserclients fehlschlägt
- **THEN** bleibt die Projektion gesperrt und der Lifecycle erfolglos
- **AND** versucht der Adapter, ausschließlich die Browser-Tokenausstellung wieder zu sperren
