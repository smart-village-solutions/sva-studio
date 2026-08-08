## ADDED Requirements

### Requirement: Autorisierbare Plugin-Beiträge deklarieren ihren Access-Bezug vollständig

Das System MUST für autorisierbare Plugin-Aktionen, Navigationseinträge, Routen sowie Admin-Resource-Aktionen einen expliziten Access-Bezug verlangen. Permission- und Action-Referenzen MUST vollständig qualifiziert, im kanonischen Katalog bekannt und mit dem Plugin- und Module-IAM-Vertrag konsistent sein. Modulgebundene Beiträge MUST zusätzlich ihr kanonisches `moduleId` referenzieren; eine Permission ersetzt keine Modulzuweisung.

#### Scenario: Vollständiger Plugin-Beitrag wird registriert

- **WENN** ein Plugin eine Route, Navigation und Create-, Update- oder Delete-Aktion registriert
- **DANN** referenziert jeder autorisierbare Beitrag eine explizit deklarierte vollständig qualifizierte Action beziehungsweise Access-Anforderung
- **UND** validiert der Host die Referenzen gegen Plugin-Permissions, Module-IAM, `moduleId` und den kanonischen Permission-Katalog
- **UND** veröffentlicht er erst danach einen konsistenten Registry-Snapshot

#### Scenario: Autorisierbarer Beitrag besitzt keinen Access-Bezug

- **WENN** ein Plugin nach Abschluss der Migrationsphase eine autorisierbare Route, Navigation oder UI-Aktion ohne expliziten Access-Bezug registriert
- **DANN** weist die Registry den Beitrag fail-fast mit einem deterministischen Diagnosecode ab
- **UND** veröffentlicht sie keinen partiell geschützten Plugin-Snapshot

#### Scenario: Permission-Verträge driften auseinander

- **WENN** `plugin.permissions`, `plugin.moduleIam.permissionIds`, Action-Referenzen oder Admin-Resource-Permissions unbekannte beziehungsweise voneinander abweichende Permission-Mengen enthalten
- **DANN** meldet die gemeinsame Cross-Validation den konkreten Namespace und die abweichenden IDs
- **UND** wird die Abweichung nach der Migrationsphase zum Build- oder Registry-Fehler

#### Scenario: Permission existiert, Modul ist aber nicht zugewiesen

- **WENN** eine Plugin-Action im aktuellen Tenant-Permission-Snapshot vorkommt
- **UND** das deklarierte Plugin-Modul der Instanz nicht zugewiesen ist
- **DANN** löst der Host die Action als nicht erlaubt auf
- **UND** darf das Plugin die fehlende Modulzuweisung weder über einen lokalen Default noch über die Permission umgehen

### Requirement: Plugin-UI konsumiert hostaufgelöste Action-Entscheidungen

Das System SHALL Plugin-Oberflächen mit hostaufgelösten, scope- und modulgebundenen Entscheidungen für ihre deklarierten Actions versorgen. Plugins dürfen eine UI-Freigabe nicht aus Rollenbezeichnungen, Dev-Auth-Verfügbarkeit, einer unscoped Action-Liste oder einer bloßen Build-time-Registrierung ableiten.

#### Scenario: Standard-Content-Detailseite wird read-only gerendert

- **WENN** ein Benutzer die `<plugin>.read`-Permission, aber nicht `<plugin>.update` oder `<plugin>.delete` besitzt
- **DANN** kann der Host die Plugin-Detailseite lesbar materialisieren
- **UND** übergibt er `update` und `delete` als nicht erlaubt
- **UND** rendert der Plugin-Editor weder ausführbare Save- noch Delete-Controls

#### Scenario: Standard-Content-Erstellung benötigt Create-Permission

- **WENN** eine Standard-Content-Erstellungsfläche materialisiert wird
- **DANN** stammt ihre Create-Capability aus der hostaufgelösten `<plugin>.create`-Entscheidung im aktuellen Scope
- **UND** kann das Plugin die Erstellungsaktion nicht über einen lokalen Default auf `true` setzen

#### Scenario: Plugin erhält eine Ressourcen-Capability

- **WENN** eine Plugin-Aktion eine datensatzbezogene Capability benötigt
- **DANN** erhält das Plugin ausschließlich die bereits hostaufgelöste Entscheidung aus dem fachlich führenden Serververtrag
- **UND** rekonstruiert es keine Ownership- oder ABAC-Regel aus Listen-, Projection- oder Sessiondaten

#### Scenario: Plugin verwendet eine technische Rolle als fachlichen Ersatz

- **WENN** ein Plugin eine tenantlokale Mutation allein wegen einer Rollenbezeichnung wie `system_admin` freigeben würde
- **DANN** gilt dies als Vertragsverletzung
- **UND** muss die UI stattdessen die vollständig qualifizierte Action-Entscheidung verwenden
- **UND** bleiben ausdrückliche Plattform-Sonderrollen auf ihren dokumentierten Plattform-Scope begrenzt
