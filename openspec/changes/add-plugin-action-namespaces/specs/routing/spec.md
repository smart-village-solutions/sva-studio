## MODIFIED Requirements
### Requirement: Plugin-Route-Exports
Plugins SHALL eigene Routen als Exporte bereitstellen können, die von der zentralen Route-Registry aufgenommen werden, ohne dass das Routing-Package plugin-spezifische Guard-Werte kennen muss.

#### Scenario: Plugin liefert Route mit Action-Referenz
- **WHEN** ein Plugin eine Route mit `requiredActions` exportiert
- **THEN** kann die App diese Route registrieren
- **AND** die Route referenziert strukturierte `RouteActionReference`-Werte (scope: `core`, `plugin` oder `shared`) statt einer geschlossenen Guard-Union

#### Scenario: Routing prüft Aktionen generisch
- **WHEN** eine Plugin-Route geschützt ist
- **THEN** ruft `@sva/routing` `authorization.requireActions(refs)` auf der injizierten `AuthorizationContext`-Instanz auf
- **AND** das Routing-Package enthält kein hart codiertes Mapping einzelner Plugin-Action-Namen auf Account-Guards

#### Scenario: Route-Guard und Navigation-Guard sind unabhängig
- **WHEN** ein Navigation-Item `visibilityActions` deklariert, aber die Ziel-Route kein `requiredActions` trägt
- **THEN** bleibt die Route direkt über URL ohne Autorisierungsprüfung erreichbar
- **AND** das System SHALL einen Konfigurationsfehler loggen, wenn ein Navigation-Item Sichtbarkeitsaktionen hat, die Ziel-Route aber keine `requiredActions`

## ADDED Requirements
### Requirement: Namespace-isolierte Plugin-Route-Aktionen
Das System SHALL Plugin-Routen über namespaced Action-Referenzen absichern, damit Plugins eigene Aktionen ergänzen können, ohne Rechte in fremden Plugin-Namespaces zu deklarieren oder zu konsumieren.

#### Scenario: Plugin verwendet eigenen Namespace
- **WHEN** ein Plugin mit `id = "news"` eine Route mit Plugin-Aktionen deklariert
- **THEN** dürfen diese Referenzen nur Actions mit `{ scope: 'plugin', pluginId: 'news', ... }` verwenden
- **AND** Core-Actions bleiben nur über `{ scope: 'core', actionId: CoreActionId }` referenzierbar

#### Scenario: Fremder Plugin-Namespace wird zurückgewiesen
- **WHEN** ein Plugin `news` in einer Route eine Action mit `pluginId: 'events'` referenziert
- **THEN** schlägt die Plugin-Registrierung fehl
- **AND** die Anwendung erhält einen expliziten Validierungsfehler statt einer stillschweigenden Übernahme

#### Scenario: Neue Plugin-Aktion erfordert keine Router-Codeänderung
- **WHEN** ein Plugin eine neue eigene Aktion wie `{ scope: 'plugin', pluginId: 'news', actionId: 'export' }` ergänzt
- **THEN** muss `@sva/routing` nicht um einen weiteren Guard-Sonderfall erweitert werden
- **AND** die Route kann über die generische `authorization.requireActions()`-Schnittstelle integriert werden

### Requirement: Shared-Scope für plugin-übergreifende Aktionen
Das System SHALL einen `shared`-Scope unterstützen, über den der Host plugin-übergreifende Aktions-Namespaces registrieren kann.

#### Scenario: Plugin referenziert Shared-Action
- **WHEN** ein Plugin eine Route mit `{ scope: 'shared', namespace: 'export', actionId: 'pdf' }` deklariert
- **THEN** prüft die Registry, ob der Namespace `export` vom Host registriert wurde
- **AND** bei unbekanntem Shared-Namespace schlägt die Registrierung fail-closed fehl
