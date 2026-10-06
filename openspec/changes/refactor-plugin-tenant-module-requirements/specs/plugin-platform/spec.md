## ADDED Requirements

### Requirement: Plugins deklarieren direkte Tenant-Modulvoraussetzungen

Ein Plugin SHALL seine direkten Tenant-Modulvoraussetzungen im vorhandenen
`PluginDefinition`-Beitrag deklarieren. Die Instance Registry MUST die
Voraussetzungen für Assign und Bootstrap gegen die verfügbaren
Modul-IAM-Beiträge und den Ziel-Tenant prüfen. Eine fehlende Voraussetzung
MUST die betroffene Mutation vor dem ersten Write abbrechen; sie MUST nicht
die Veröffentlichung des hostweiten Plugin-Snapshots verhindern.

#### Scenario: `news`, `events` und `poi` deklarieren `categories`

- **GIVEN** die Plugin-Beiträge für `news`, `events` und `poi` deklarieren jeweils `categories` als Voraussetzung
- **WHEN** der Host die Beiträge lädt
- **THEN** enthält der validierte Beitrag die deklarierte Voraussetzung
- **AND** die Instance Registry benötigt keine Zuordnung anhand dieser Plugin-IDs

#### Scenario: Fehlende Voraussetzung verhindert die Tenant-Mutation

- **GIVEN** ein Plugin deklariert eine Voraussetzung, die im Ziel-Tenant nicht verfügbar ist
- **WHEN** ein Admin das Plugin zuweist oder den Tenant bootstrappt
- **THEN** weist die Instance Registry die gesamte Mutation vor dem ersten Persistenz-, IAM-, Audit- oder Lifecycle-Write ab
- **AND** der hostweite Plugin-Snapshot bleibt davon unberührt

### Requirement: Tenant-Modulzuweisungen erfüllen direkte Voraussetzungen

Die Instance Registry MUST bei Assign und Bootstrap fehlende direkte
Voraussetzungen gemäß den bestehenden Aktivierungsrichtlinien ergänzen. Sie
MUST den Revoke einer Voraussetzung ablehnen, solange ein anderes noch
zugewiesenes Modul diese benötigt oder die Aktivierungsrichtlinie den Entzug
verbietet.

#### Scenario: Zuweisung ergänzt eine fehlende direkte Voraussetzung

- **GIVEN** ein Admin weist ein Plugin zu, dessen direkte Voraussetzung noch nicht zugewiesen ist
- **AND** die Voraussetzung ist im Ziel-Tenant verfügbar
- **WHEN** die Instance Registry die Zuweisung ausführt
- **THEN** weist sie Plugin und Voraussetzung gemäß ihren bestehenden Aktivierungsrichtlinien zu
- **AND** reconciliert IAM und Lifecycle für die geänderte Zuweisungsmenge

#### Scenario: Benötigte Voraussetzung kann nicht entzogen werden

- **GIVEN** ein zugewiesenes Modul benötigt direkt das Ziel des Revoke
- **WHEN** ein Admin dieses Zielmodul entziehen möchte
- **THEN** lehnt die Instance Registry den Entzug vor dem ersten Write ab
- **AND** alle Zuweisungen bleiben unverändert

#### Scenario: Nicht mehr benötigtes optionales Modul kann entzogen werden

- **GIVEN** kein anderes zugewiesenes Modul benötigt das optionale Modul
- **AND** dessen Aktivierungsrichtlinie erlaubt den Entzug
- **WHEN** ein Admin das Modul entzieht
- **THEN** entfernt die Instance Registry die Zuweisung und nutzt den bestehenden Plugin-Tenant-Lifecycle

### Requirement: Plugin-Tenant-Lifecycle bleibt für Provisionierung zuständig

Die Instance Registry MUST Moduländerungen über den bestehenden
Plugin-Tenant-Lifecycle verarbeiten lassen und MUST keine Waste-spezifische
Provisionierungs- oder Deaktivierungsaktion direkt aufrufen. Die bestehenden
Waste-Status- und Retry-Consumer MUST über ihre plugin-spezifische Fassade
erhalten bleiben.

#### Scenario: Waste-Lifecycle wird über den vorhandenen Lifecycle ausgelöst

- **GIVEN** eine Moduländerung betrifft `waste-management`
- **WHEN** die Instance Registry die Mutation abgeschlossen hat
- **THEN** wird die Lifecycle-Verarbeitung über den bestehenden Plugin-Tenant-Lifecycle ausgelöst
- **AND** Statusanzeige und manueller Retry bleiben über die bestehende Waste-Fassade verfügbar
