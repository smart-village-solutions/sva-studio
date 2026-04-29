## ADDED Requirements
### Requirement: Plugin-Routen verwenden plugin-spezifische Guards
Das Routing-System SHALL für die produktiven Fachplugins `news`, `events` und `poi` plugin-spezifische Guards aus dem Plugin-Permission-Vertrag statt generischer `content.*`-Guards verwenden.

#### Scenario: News-Liste erfordert News-Leserecht
- **WHEN** ein Benutzer `/plugins/news` aufruft
- **THEN** prüft der Host ein plugin-spezifisches News-Leserecht
- **AND** ein generisches anderes Plugin-Recht wie `events.read` reicht nicht aus

#### Scenario: POI-Erstellung erfordert POI-Erstellungsrecht
- **WHEN** ein Benutzer `/plugins/poi/new` aufruft oder die zugehörige Aktion auslöst
- **THEN** prüft der Host ein plugin-spezifisches POI-Erstellungsrecht
- **AND** die Guard-Entscheidung bleibt mit der konfigurierten Plugin-Action konsistent

#### Scenario: Route mit altem content-Guard wird nicht materialisiert
- **GIVEN** ein produktives Fachplugin deklariert eine Route unter `/plugins/events`
- **AND** die Route referenziert `content.read` statt `events.read`
- **WHEN** die Plugin-Routen materialisiert werden
- **THEN** bricht die Routing-Registrierung fail-fast ab
- **AND** es wird kein Route-Tree veröffentlicht, der einen dauerhaften `content.*`-Fallback für Events enthält
