## ADDED Requirements

### Requirement: Mainserver-Content-Scopes verwenden im Zielzustand exakte automatische Bindungen

Das System SHALL Mainserver-Inhalte im automatischen Resolver ausschließlich anhand der aktuellen konfliktfreien Principal-zu-DataProvider-Bindungen autorisieren. Fehlende oder konfliktbehaftete erforderliche Bindungen SHALL fail-closed ablehnen. `credential_visible_compatibility` SHALL nur in den expliziten Rolloutmodi `shadow` und `compatibility` erzwungen werden. Die passende fully-qualified Action-Permission, Instanzgrenze, aktive Organisation, Principal-Policy und Mainserver-Autorisierung SHALL in jedem Modus erforderlich bleiben.

Ein Projection-, Listen- oder Cache-Treffer SHALL keine Mutation autorisieren. Update, Publish, Archive, Restore und Hard Delete SHALL jeweils einen frischen erfolgreichen Pre-Read mit exakt demselben Credential-Kontext wie der anschließende Write verlangen. Jede Aktion SHALL ihre eigene fully-qualified Permission verlangen.

#### Scenario: Own-Scope ohne aktuelle Bindung wird automatisch abgelehnt

- **GIVEN** der persönliche Principal besitzt für seine aktuelle Credential-Version noch keine konfliktfreie DataProvider-Bindung
- **AND** der Benutzer besitzt die fully-qualified Update-Permission mit `own`
- **WHEN** er einen Mainserver-Inhalt mit `actingPrincipalType = user` aktualisiert
- **THEN** lehnt Studio die Mutation im automatischen Resolver vor dem Write ab
- **AND** erfindet es kein lokales Owner-Mapping
- **AND** bleiben Mainserver-`401`, `403` oder `404` ebenfalls fail-closed

#### Scenario: Organization-Scope ohne vollständige policy-gesteuerte Bindung wird abgelehnt

- **GIVEN** bei `org_only` fehlt die aktuelle Organisationsbindung oder bei `org_or_personal` eine der persönlichen beziehungsweise organisatorischen Bindungen
- **AND** der Benutzer besitzt die passende Content-Action mit `organization`
- **WHEN** er mit einem zulässigen expliziten Principal handelt
- **THEN** lehnt Studio die Mutation im automatischen Resolver ab
- **AND** verbreitert es den Scope nicht anhand der Credential-Sichtbarkeit
- **AND** berücksichtigt keine andere Membership oder einen anderen Credential-Kontext

#### Scenario: Hard Delete bleibt separat autorisiert

- **GIVEN** ein Inhalt ist mit dem ausgewählten Credential unmittelbar lesbar
- **AND** der Benutzer besitzt Update-, aber keine Delete-Permission
- **WHEN** er Hard Delete auslösen möchte
- **THEN** lehnt Studio die Aktion vor dem Mainserver-Delete ab
- **AND** leitet aus der allgemeinen Bearbeitbarkeit kein Löschrecht ab

#### Scenario: Hard Delete ist im Kompatibilitätsmodus erlaubt

- **GIVEN** ein Inhalt ist mit dem ausgewählten Credential unmittelbar lesbar
- **AND** der Benutzer besitzt die passende fully-qualified Delete-Permission
- **WHEN** er Hard Delete auslöst
- **THEN** darf Studio den Delete mit demselben Credential ausführen
- **AND** bleibt die Mainserver-Autorisierung die nachgelagerte Obergrenze
- **AND** verwendet Audit den DataProvider aus dem verpflichtenden Pre-Read

#### Scenario: Projection-Treffer ersetzt keinen Pre-Read

- **GIVEN** ein Inhalt ist in einer älteren credential-spezifischen Projection vorhanden
- **WHEN** der Mainserver ihn mit dem für die Mutation ausgewählten Credential nicht mehr lesen lässt
- **THEN** autorisiert die Projection die Mutation nicht
- **AND** lehnt Studio die Aktion ohne Write ab

#### Scenario: Own-Scope wechselt automatisch zur exakten Auswertung

- **GIVEN** der persönliche Principal ist für seine aktuelle Credential-Version konfliktfrei einem DataProvider zugeordnet
- **WHEN** Studio `own` auswertet
- **THEN** erlaubt es nur Inhalte dieses persönlichen DataProviders
- **AND** verwendet es für diesen Scope nicht mehr `credential_visible_compatibility`
- **AND** auditiert den automatischen Zustandswechsel

#### Scenario: Organization-Scope verwendet policy-gesteuerte Readiness

- **GIVEN** bei `org_only` ist die aktive Organisation konfliktfrei zugeordnet oder bei `org_or_personal` sind persönlicher Principal und aktive Organisation konfliktfrei zugeordnet
- **WHEN** Studio `organization` auswertet
- **THEN** erlaubt es Inhalte des persönlichen oder organisatorischen DataProviders
- **AND** DataProvider anderer Memberships matchen nicht
- **AND** ohne aktive Organisation fällt der Scope auf `own` zurück

#### Scenario: Konflikt blockiert den automatischen Resolver

- **GIVEN** eine Identity- oder nachgelagerte Create-Beobachtung widerspricht einer bestehenden Bindung
- **WHEN** Studio `own` oder `organization` auswertet
- **THEN** überschreibt es keine Bindung
- **AND** lehnt der automatische Resolver den betroffenen Scope fail-closed ab
- **AND** macht den Konflikt in Administration und Diagnose sichtbar

#### Scenario: All-Scope bleibt durch Mainserver-Sichtbarkeit begrenzt

- **WHEN** eine Authorize-Anfrage eine Permission mit `accessScope = all` verwendet
- **THEN** benötigt Studio kein Principal-zu-DataProvider-Mapping
- **AND** erlaubt nur Inhalte derselben Studio-Instanz, die im verwendeten Mainserver-Read-Kontext tatsächlich verfügbar sind
- **AND** überstimmt es keine nachgelagerte Mainserver-Autorisierung

#### Scenario: Fehlende Action-Permission bleibt fail-closed

- **GIVEN** der Mainserver würde einen Inhalt mit dem ausgewählten Credential lesen und mutieren
- **WHEN** der Benutzer die passende fully-qualified Content-Action nicht besitzt
- **THEN** lehnt Studio die Aktion vor dem Write ab
- **AND** erzeugt Credential-Verfügbarkeit keine Studio-Permission
