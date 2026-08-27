## ADDED Requirements

### Requirement: Mainserver-Identitätsreconciliation ist eine direkte geschützte Admin-Aktion

Das System SHALL Mainserver-Identitätsreconciliation ausschließlich über die fully-qualified Action `iam.reconcileMainserverUserConflict` und getrennt von normalen Tenant-Admin-Mutationen ausführen. Die Action SHALL auf `system_admin` der Zielinstanz begrenzt sein und vor jeder externen Mutation Zielinstanz, normalisierte E-Mail-Gleichheit, CSRF-Schutz und serverseitig gebundene Fresh-Reauth-Evidenz prüfen. Eine zweite administrative Freigabe SHALL nicht erforderlich sein.

#### Scenario: System-Admin führt bestätigten Rebind aus

- **GIVEN** ein `system_admin` ist für die Zielinstanz authentifiziert
- **AND** ein aktueller Befund bestätigt dieselbe normalisierte E-Mail-Adresse
- **AND** die Session enthält gültige serverseitige Fresh-Reauth-Evidenz
- **WHEN** der System-Admin die Wirkung bestätigt und die Action ausführt
- **THEN** darf der Server den Mainserver-Rebind innerhalb dieser Instanz starten

#### Scenario: Fresh Reauth fehlt

- **WHEN** ein `system_admin` die Action ohne gültige serverseitige Fresh-Reauth-Evidenz aufruft
- **THEN** lehnt der Server die Operation vor jedem Mainserver-Aufruf ab

#### Scenario: Actor ist für die Zielinstanz nicht berechtigt

- **WHEN** ein Benutzer ohne `system_admin`-Berechtigung für die Zielinstanz die Action aufruft
- **THEN** lehnt der Server die Operation vor jedem Mainserver-Aufruf ab
