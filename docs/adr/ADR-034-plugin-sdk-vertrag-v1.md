# ADR-034: Plugin-SDK-Vertrag v1

**Status:** Accepted
**Entscheidungsdatum:** 2026-04-13
**Entschieden durch:** Studio/Architektur Team
**GitHub Issue:** TBD
**GitHub PR:** TBD

## Kontext

Die bestehende Plugin-Integration im Studio war funktional, aber noch kein belastbarer öffentlicher Vertrag. Plugins lieferten bisher lose Route-Arrays, während Navigation, i18n, Content-Typen und Guard-Zuordnung implizit im Host verblieben. Dadurch entstanden drei Probleme:

1. Plugins hatten keinen vollständigen, dokumentierten Integrationsvertrag.
2. Die Shell musste plugin-spezifische Details kennen statt nur generische Metadaten.
3. Das erste produktive Fachplugin `@sva/plugin-news` hätte ohne stabilen Vertrag entweder App-Interna importieren oder ein zweites Integrationsmuster einführen müssen.

Gleichzeitig war das Ziel ausdrücklich nicht, bereits ein dynamisches Runtime-Plugin-System zu bauen. Für den aktuellen Scope reicht eine statische Registrierung im App-Bundle, solange die Boundary zwischen Host und Plugin sauber definiert ist.

## Entscheidung

- `@sva/sdk` ist die einzige öffentliche Boundary für Studio-Plugins.
- Plugins exportieren genau ein `PluginDefinition`-Objekt statt lose Routen oder host-spezifische Registrierungsaufrufe.
- `PluginDefinition` umfasst in v1:
  - `id`
  - `displayName`
  - `routes`
  - `navigation`
  - `contentTypes`
  - `translations`
- Der Host materialisiert daraus statisch:
  - Plugin-Registry
  - Plugin-Routen
  - Plugin-Navigation
  - Plugin-Content-Typen
  - Plugin-Übersetzungen
- Guards bleiben Host-Verantwortung. Plugins deklarieren nur fachliche Guard-Metadaten (`content.read`, `content.create`, `content.write`).
- Plugin-i18n wird über einen SDK-seitigen Resolver angebunden; Plugin-UI nutzt `usePluginTranslation(pluginId)` statt App-Interna.
- Die Registrierung bleibt in v1 bewusst statisch im App-Bundle. Runtime-Loading, externe Plugin-Pakete und Sandbox-Isolation sind nicht Teil dieser Entscheidung.

## Begründung

### Positive Konsequenzen

- Einheitlicher öffentlicher Vertrag für Referenz- und Produktiv-Plugins
- Geringere Kopplung zwischen App-Shell und einzelnen Plugins
- Framework-agnostische Kernmetadaten im SDK; React-spezifisch bleibt nur die UI-Ebene
- Navigation, Routing, i18n und Content-Typen lassen sich konsistent zusammenführen
- `@sva/plugin-news` kann ohne Importe aus `scope:app`, `scope:auth` oder `scope:routing` gebaut werden

### Negative Konsequenzen

- Der Host braucht weiterhin statische Registrierungslogik im App-Bundle
- Plugin-Routen werden zwar über Metadaten beschrieben, aber noch nicht lazy oder extern geladen
- Guard-Mapping ist in v1 auf den bestehenden Content-Rechtekanon begrenzt
- Der Übersetzungsschlüsselraum bleibt nur konventionell (`<pluginId>.*`) organisiert und nicht vollständig typisiert

## Verworfenene Alternativen

### 1. Weiterhin nur lose Plugin-Route-Arrays exportieren

Verworfen, weil Navigation, i18n und Content-Typen dann weiterhin außerhalb eines öffentlichen Vertrags lägen und jedes neue Plugin implizites Host-Wissen bräuchte.

### 2. Voll dynamisches Runtime-Plugin-System

Verworfen, weil der aktuelle Scope kein externes Laden, keine Signierung, keine Versionierung und keine Sicherheitsisolation verlangt. Das hätte den Change unverhältnismäßig vergrößert.

### 3. Plugin-Registrierung direkt im App-Code ohne SDK-Vertrag

Verworfen, weil dies die App zum faktischen Plugin-API-Owner gemacht hätte. Damit wäre `@sva/sdk` als Boundary unterlaufen worden.

## Konsequenzen für Umsetzung und Betrieb

- Neue Studio-Plugins müssen ihr Integrationsverhalten über `PluginDefinition` beschreiben.
- Die Shell darf Plugin-Metadaten konsumieren, aber keine plugin-spezifischen Sonderpfade für Navigation oder Routing erzwingen.
- Content-Typ-spezifische Server-Validierung bleibt unabhängig vom UI-Plugin und wird über eine serverseitige Registry an den generischen Content-Write-Pfad angebunden.
- Die statische Plugin-Liste im Host ist in v1 der bewusst akzeptierte Trade-off zwischen Erweiterbarkeit und operativer Einfachheit.

## Verwandte ADRs

- [ADR-002](../architecture/decisions/ADR-002-plugin-architecture-pattern.md)
- [ADR-017](ADR-017-modulare-iam-server-bausteine.md)
- [ADR-018](ADR-018-auth-routing-error-contract-und-korrelation.md)
