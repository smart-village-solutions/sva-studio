## ADDED Requirements
### Requirement: Plugins deklarieren Rechte nur über einen host-owned Vertrag
Das IAM-System SHALL plugin-spezifische Rechte ausschließlich über einen generischen, host-owned Plugin-Permission-Vertrag übernehmen, damit Plugins keine Core-internen Rechtestrukturen kennen oder implementieren müssen.

#### Scenario: Plugin deklariert eigenes Recht ohne Core-Kopplung
- **GIVEN** ein Plugin mit Namespace `news` deklariert ein Recht `news.read`
- **WHEN** die Build-Time-Registry aufgebaut wird
- **THEN** übernimmt der Host diese Deklaration in eine zentrale Plugin-Permission-Registry
- **AND** das Plugin muss dafür weder `content.*`-Core-Rechte noch IAM-interne Persistenzdetails kennen

#### Scenario: Plugin-Action verweist auf registrierte eigene Permission
- **GIVEN** das Plugin `news` deklariert die Action `news.create`
- **AND** die Plugin-Permission-Registry enthält `news.create`
- **WHEN** der Build-Time-Snapshot validiert wird
- **THEN** akzeptiert der Host die Action-Permission-Bindung
- **AND** die spätere Allow/Deny-Entscheidung bleibt ausschließlich Aufgabe der hostseitigen IAM-Autorisierung

#### Scenario: Plugin-Action referenziert content-Recht als Guard
- **GIVEN** ein produktives Fachplugin deklariert eine autorisierbare Action mit Guard `content.create`
- **WHEN** der Build-Time-Snapshot validiert wird
- **THEN** wird die Plugin-Definition abgewiesen
- **AND** die Diagnose benennt den veralteten `content.*`-Guard-Vertrag

### Requirement: Plugin-spezifische Fachrechte für produktive Content-Plugins
Das IAM-System SHALL für die produktiven Fachplugins `news`, `events` und `poi` eigene fachliche Rechtefamilien bereitstellen, damit Berechtigungen nicht ausschließlich über gemeinsame `content.*`-Rechte vergeben werden.

#### Scenario: News-Recht berechtigt nicht automatisch für Events
- **GIVEN** ein Benutzer besitzt im aktiven Instanzkontext die Berechtigung `news.read`
- **WHEN** derselbe Benutzer die Event-Liste oder eine Event-Detailroute aufruft
- **THEN** wird der Zugriff verweigert
- **AND** `news.read` wird nicht implizit als `events.read`, `poi.read` oder generisches Plugin-Leserecht interpretiert

#### Scenario: Plugin-spezifische Schreibrechte bleiben namespace-isoliert
- **GIVEN** ein Benutzer besitzt `poi.update`, aber nicht `news.update`
- **WHEN** er eine News-Änderung auslösen will
- **THEN** wird die Aktion als `forbidden` abgewiesen
- **AND** die Entscheidung bleibt auf die angeforderte Plugin-Rechtefamilie referenzierbar

### Requirement: Gruppen- und Rollenauflösung berücksichtigt plugin-spezifische Rechte
Das IAM-System SHALL plugin-spezifische Rechte in derselben Gruppen-/Rollenauflösung behandeln wie bestehende IAM-Rechte.

#### Scenario: Gruppe vermittelt plugin-spezifisches Recht
- **GIVEN** eine Gruppe bündelt eine Rolle mit `events.create`
- **WHEN** ein Benutzer Mitglied dieser Gruppe ist
- **THEN** enthält die effektive Berechtigungsauflösung `events.create` als wirksame Quelle

### Requirement: Namespace-Validierung bei Build-Time
Das IAM-System SHALL Plugin-Namespaces bei Build-Time validieren, um Namespace-Spoofing und Kollisionen zu verhindern.

#### Scenario: Plugin verwendet Reserved-Namespace
- **GIVEN** ein Plugin versucht den Namespace `iam` zu registrieren
- **WHEN** die Build-Time-Registry aufgebaut wird
- **THEN** wird die Plugin-Definition abgewiesen
- **AND** die Diagnose benennt `iam` als reservierten Namespace

#### Scenario: Zwei Plugins beanspruchen denselben Namespace
- **GIVEN** Plugin A und Plugin B deklarieren beide den Namespace `news`
- **WHEN** die Build-Time-Registry aufgebaut wird
- **THEN** bricht die Registry fail-fast ab
- **AND** die Diagnose benennt den Namespace-Duplikat-Konflikt

#### Scenario: Plugin-Namespace mit ungültigem Format
- **GIVEN** ein Plugin deklariert den Namespace `News_Plugin!`
- **WHEN** die Build-Time-Registry aufgebaut wird
- **THEN** wird die Plugin-Definition abgewiesen
- **AND** die Diagnose verweist auf das zulässige Format

### Requirement: Fail-closed bei unbekannter Permission zur Laufzeit
Das IAM-System SHALL den Zugriff verweigern, wenn eine Guard-Prüfung zur Laufzeit eine Permission-ID referenziert, die nicht in der aktiven Plugin-Permission-Registry registriert ist.

#### Scenario: Guard referenziert nicht-registrierte Permission
- **GIVEN** eine Route referenziert die Permission `news.export`
- **AND** `news.export` ist nicht in der Plugin-Permission-Registry registriert
- **WHEN** ein Benutzer diese Route aufruft
- **THEN** wird der Zugriff deny-by-default verweigert
