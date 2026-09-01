## ADDED Requirements

### Requirement: Plugins können ausdrücklich freigegebene Plattformbeiträge deklarieren

Das System SHALL Plugins erlauben, Routen, Navigation, Aktionen und serverseitige Beiträge ausdrücklich für den Plattform-Scope zu deklarieren. Der Host MUST jeden Plattformbeitrag vor der Snapshot-Materialisierung gegen Contribution-Typ, Extension-Tier, Plattformrolle und konsistenten Scope validieren; ein Plugin darf daraus keine tenantlokale Autorisierung ableiten.

#### Scenario: Freigegebenes Admin-Plugin trägt eine Root-Route bei

- **GIVEN** ein installiertes, hostkompatibles Plugin besitzt einen Extension-Tier, der Plattformrouten erlaubt
- **AND** seine Route und Navigation verlangen im Plattform-Scope die Rolle `instance_registry_admin`
- **WHEN** der Host den Plugin-Snapshot für einen Root-Request materialisiert
- **THEN** registriert er Route und Navigation im Plattform-Scope
- **AND** wertet keine tenantlokalen Actions oder Modulzuweisungen als Plattformberechtigung aus

#### Scenario: Tenant-Plugin beansprucht unzulässig den Plattform-Scope

- **GIVEN** der Extension-Tier eines Plugins erlaubt keine Plattformbeiträge
- **WHEN** das Plugin eine Plattformroute, Plattformaktion oder einen Plattform-Serverbeitrag deklariert
- **THEN** lehnt der Host den Plugin-Descriptor fail-closed mit einem stabilen Validierungsfehler ab
- **AND** materialisiert keine Beiträge dieses Plugins teilweise

#### Scenario: Contribution-Scope ist innerhalb eines Pfads widersprüchlich

- **GIVEN** Route, Navigation, Action oder Serverbeitrag eines Plugin-Pfads deklarieren widersprüchliche Plattform- und Tenant-Anforderungen
- **WHEN** der Host den Descriptor validiert
- **THEN** lehnt er den widersprüchlichen Pfad vor der Runtime-Registrierung ab
- **AND** verwendet weder Root-Rollen im Tenant-Scope noch Tenant-Actions im Plattform-Scope

### Requirement: Installierte Plugins deklarieren eine Tenant-Aktivierungsrichtlinie

Das System SHALL für jedes installierte Plugin genau eine tenantbezogene Aktivierungsrichtlinie `optional`, `automatic` oder `required` im hostvalidierten Manifest führen. Die Richtlinie ist ein generischer Plattformvertrag und darf nicht aus Plugin-ID, Feature Flags oder fachlichen Integrationsdaten erraten werden.

#### Scenario: Optionales Plugin bleibt initial deaktiviert

- **GIVEN** ein installiertes Plugin deklariert `optional`
- **WHEN** eine neue Instanz angelegt oder eine bestehende Instanz reconciliert wird
- **THEN** bleibt das Plugin ohne explizite autorisierte Aktivierung tenantbezogen deaktiviert

#### Scenario: Automatisches Plugin wird initial aktiviert

- **GIVEN** ein installiertes Plugin deklariert `automatic`
- **AND** für die Instanz besteht kein manueller Deaktivierungs-Override
- **WHEN** eine neue Instanz angelegt oder die Richtlinie kontrolliert reconciliert wird
- **THEN** wird das Plugin dem expliziten Modulsatz der Instanz zugewiesen
- **AND** startet die deklarierte IAM- und Fachprovisionierung idempotent

#### Scenario: Pflicht-Plugin wird für jeden Tenant aktiviert

- **GIVEN** ein installiertes Plugin deklariert `required`
- **WHEN** eine neue oder bestehende Instanz reconciliert wird
- **THEN** gehört das Plugin zwingend zum expliziten Modulsatz der Instanz
- **AND** wird die Installation erst als bereit ausgewiesen, wenn der erforderliche Reconcile erfolgreich ist

### Requirement: Effektive Plugin-Aktivierung ist persistent, auditiert und reconciliierbar

Das System SHALL den effektiven tenantbezogenen Aktivierungszustand mit Richtlinie, Herkunft, Revision, Reconcile-Evidenz und optionalem manuellem Override persistent führen. Aktivierungsänderungen MUST autorisiert, concurrency-sicher und auditierbar sein.

#### Scenario: Manuelle Deaktivierung eines automatischen Plugins bleibt bestehen

- **GIVEN** ein Plugin deklariert `automatic` und ist für eine Instanz aktiv
- **WHEN** ein berechtigter Root-Admin es für diese Instanz ausdrücklich deaktiviert
- **THEN** persistiert das System einen manuellen Deaktivierungs-Override
- **AND** weder Neustart noch Richtlinien-Reconcile aktiviert das Plugin ohne explizite Aufhebung dieses Overrides erneut

#### Scenario: Deaktivierung eines Pflicht-Plugins wird abgelehnt

- **GIVEN** ein installiertes Plugin deklariert `required`
- **WHEN** UI oder API seine tenantbezogene Deaktivierung anfordert
- **THEN** lehnt der Server die Mutation mit einem stabilen Fehlercode ab
- **AND** bleiben Aktivierung, IAM-Basis und Plugin-Daten unverändert

#### Scenario: Bestehende Tenants werden nach Plugin-Installation kontrolliert reconciliert

- **GIVEN** ein `automatic`- oder `required`-Plugin wird nachträglich in ein Studio-Deployment aufgenommen
- **WHEN** der Installations-Reconcile läuft
- **THEN** verarbeitet er jede bestehende Instanz idempotent und mit persistenter Einzelevidenz
- **AND** überschreibt keinen bestehenden zulässigen manuellen Override
- **AND** weist bei Teilfehlern die betroffenen Instanzen und den Installationsstatus diagnostizierbar aus

### Requirement: Plugin-Deaktivierung und -Entfernung löschen keine Fachdaten automatisch

Das System MUST Aktivierungsstatus, Deployment-Installation und fachliche Datenlöschung als getrennte Lifecycle-Operationen behandeln.

#### Scenario: Automatisches Plugin wird für einen Tenant deaktiviert

- **GIVEN** ein `automatic`-Plugin besitzt tenantbezogene Fachdaten
- **WHEN** es für diesen Tenant autorisiert deaktiviert wird
- **THEN** sperrt der Host tenantbezogene Routen, Aktionen, Jobs und interne Fachzugriffe
- **AND** entfernt die modulbezogene IAM-Basis gemäß Instanzvertrag
- **AND** löscht weder Plugin-Fachdaten noch Audit-Historie automatisch

#### Scenario: Plugin-Distribution wird aus dem Deployment entfernt

- **GIVEN** ein Plugin ist für einen oder mehrere Tenants aktiv oder besitzt erhaltene Daten
- **WHEN** ein Operator die Distribution in einem getrennten Deployment-Vorgang entfernt
- **THEN** behandelt der Host das Plugin als nicht verfügbar
- **AND** führt die Entfernung ohne eine separate, ausdrücklich autorisierte Daten-Lifecycle-Operation zu keiner automatischen Datenlöschung
