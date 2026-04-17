## ADDED Requirements
### Requirement: Namespaced Action-Ownership für Plugins
Das System SHALL Core-, Plugin- und Shared-Aktionen über einen zentralen, namespaced Action-Vertrag modellieren und Namespace-Eigentum für Plugins erzwingen.

#### Scenario: Plugin deklariert eigene Actions
- **WHEN** ein Plugin geladen wird
- **THEN** kann es eigene Actions in einem deklarativen Katalog bereitstellen
- **AND** jede Plugin-Action ist eindeutig über `pluginId` und `actionId` identifizierbar

#### Scenario: Identifier-Format wird validiert
- **WHEN** ein Plugin mit einer `pluginId` oder `actionId` registriert wird
- **THEN** müssen beide Werte dem Format `/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/` entsprechen
- **AND** bei Format-Verletzung verweigert das System die Registrierung mit einem expliziten Validierungsfehler

#### Scenario: Fremde Namespace-Deklaration wird verhindert
- **WHEN** ein Plugin versucht, eine Action im Namespace eines anderen Plugins oder des Hosts zu deklarieren
- **THEN** verweigert das System die Registrierung des Plugins
- **AND** es wird keine teilweise Aktivierung des Plugins durchgeführt
- **AND** das System loggt ein strukturiertes Audit-Event mit den Feldern `plugin_id`, `attempted_namespace`, `owned_namespace`, `reason="namespace_violation"` auf Level `warn` über `createSdkLogger({ component: 'plugin-registry' })`

#### Scenario: Registry wird nach App-Start eingefroren
- **WHEN** alle Plugins beim App-Start registriert wurden
- **THEN** wird die Registry eingefroren und akzeptiert keine weiteren Registrierungen
- **AND** Versuche, nach dem Start Plugins hinzuzufügen, schlagen mit einem expliziten Fehler fehl

### Requirement: Zentrale Autorisierung für Route-Actions
Das System SHALL Route-Actions unabhängig von ihrer Herkunft über dieselbe zentrale `AuthorizationContext`-Schnittstelle prüfen.

#### Scenario: Core- und Plugin-Action teilen denselben Prüfpfad
- **WHEN** eine Route eine Core-Action oder eine Plugin-Action referenziert
- **THEN** erfolgt die Entscheidung über denselben zentralen Autorisierungspfad
- **AND** die Antwort bleibt deterministisch und begründet
- **AND** das Ergebnis ist für `{ scope: 'core', actionId: 'content.read' }` und `{ scope: 'plugin', pluginId: 'news', actionId: 'publish' }` strukturell identisch

#### Scenario: Deklaration gewährt keine Berechtigung
- **WHEN** ein Plugin eine neue Action wie `{ scope: 'plugin', pluginId: 'news', actionId: 'export' }` deklariert
- **THEN** besitzt ein Benutzer diese Aktion nicht automatisch
- **AND** erst die zentrale IAM-Autorisierung entscheidet, ob die Action im aktiven Kontext erlaubt ist

#### Scenario: Unbekannte Action wird fail-closed behandelt
- **WHEN** eine Route oder Navigation eine unbekannte oder nicht registrierte Action referenziert
- **THEN** verweigert das System den Zugriff fail-closed
- **AND** das System loggt ein strukturiertes Denial-Event mit den Feldern `component`, `event: "action_denied"`, `plugin_id?`, `action_id`, `reason`, `trace_id` über `createSdkLogger`
- **AND** der strukturierte Denial-Kontext enthält keine PII oder Session-Details
