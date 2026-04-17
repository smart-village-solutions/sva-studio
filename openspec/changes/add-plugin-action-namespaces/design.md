## Context

Die aktuelle Plugin-Schnittstelle modelliert Routenrechte als geschlossene Union im SDK. Das Routing-Package übersetzt diese Werte zusätzlich über ein hart codiertes Mapping auf bestehende Account-Guards. Dadurch entsteht enge Kopplung zwischen Plugin-SDK, Router und den heute bekannten Content-Rechten.

Gleichzeitig braucht das System eine klare Eigentumsgrenze: Ein Plugin soll eigene Aktionen definieren können, aber nicht im Namespace anderer Plugins oder des Hosts operieren dürfen.

## Goals / Non-Goals

- Goals:
  - Plugin-Aktionen ohne Router-Codeänderung erweiterbar machen
  - Namensraum-Eigentum pro Plugin technisch erzwingen
  - Routen, Navigation und serverseitige Autorisierung auf dieselben Action-Referenzen ausrichten
  - Bestehende Core-Aktionen kompatibel in das neue Modell überführen
- Non-Goals:
  - Vollständiges neues ABAC-Modell
  - Freie Plugin-zu-Plugin-Rechtevergabe ohne Host-Kontrolle
  - Umsetzung aller UI- oder Backend-Endpunkte in diesem Change

## Decisions

- Actions werden als strukturierte Referenzen modelliert, nicht mehr als geschlossene Guard-Union.
- Es gibt **drei** Action-Bereiche:
  - `core` — host-kontrollierte, geschlossene Typed-Union (`CoreActionId`); neue Core-Actions erfordern einen SDK-Release
  - `plugin` — plugin-eigene Aktionen, immer an `pluginId` und `actionId` gebunden
  - `shared` — plugin-übergreifende Aktionen unter einem Host-registrierten Namespace (z.B. `export`, `publish`); kein Plugin kann `shared`-Namespaces eigenständig befüllen
- Plugins deklarieren ihre eigenen Action-Definitionen explizit im SDK-Vertrag.
- Eine zentrale Registry wird **einmalig beim App-Start** gebaut und danach eingefroren (`Object.freeze`). Kein dynamisches Nachladen von Plugins zur Laufzeit.
- Die Registry validiert beim Laden:
  - eindeutige Plugin-IDs
  - eindeutige Action-IDs innerhalb eines Plugins
  - Format-Konformität von `pluginId` und `actionId` (Regex: `/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/`)
  - Referenzen nur auf bekannte Actions
  - bei `scope: plugin` darf ein Plugin nur den eigenen Namespace referenzieren
  - bei `scope: shared` darf ein Plugin nur Host-registrierte Shared-Namespaces referenzieren
- Das `AuthorizationContext`-Interface wird in `@sva/sdk` definiert. `@sva/auth` liefert die Implementierung. `@sva/routing` erhält die Implementierung als Parameter beim App-Start (Dependency Inversion).
- `@sva/routing` kennt keine fachlichen Plugin-Guard-Sonderfälle mehr, sondern ruft `authorization.requireActions(refs)` auf.
- Die Autorisierung bleibt zentral host-gesteuert; Plugin-Deklaration allein gewährt keine Berechtigung.
- Das Feld `guard?: PluginRouteGuard` und `requiredAction?: PluginRouteGuard` werden **ohne Compat-Shim entfernt** (Hard Cut). Alle internen Plugins migrieren in Task 4.1 gleichzeitig.
- Navigation-Items verwenden `visibilityActions` (nicht `requiredActions`), um die semantische Trennung zwischen Sichtbarkeitssteuerung und Zugriffsschutz auf Typ-Ebene zu erzwingen.
- Der IAM-Authorize-Request wird auf ein **strukturiertes Action-Objekt** umgestellt (kein flacher String mehr). Nur `@sva/auth` führt die Serialisierung von `RouteActionReference` auf das IAM-Format durch. Bestehende IAM-Policies für `content.*` werden migriert.

### IAM-Serialisierungsformat

Die Funktion `serializeActionRef` in `@sva/auth` übersetzt wie folgt:

| Scope | Eingabe | IAM-`action` |
|---|---|---|
| `core` | `{ scope: 'core', actionId: 'content.read' }` | `"content.read"` |
| `plugin` | `{ scope: 'plugin', pluginId: 'news', actionId: 'publish' }` | `"plugin.news.publish"` |
| `shared` | `{ scope: 'shared', namespace: 'export', actionId: 'pdf' }` | `"shared.export.pdf"` |

Dieses Format ist das kanonische, intern dokumentierte Kontraktformat zwischen SDK-Modell und IAM-API.

## Proposed Model

Beispielhafte SDK-Form:

```ts
// Kanonische Core-Action-IDs — geschlossene Typed-Union
export type CoreActionId =
  | 'content.read'
  | 'content.create'
  | 'content.write'
  | 'content.delete';

export type RouteActionReference =
  | { readonly scope: 'core'; readonly actionId: CoreActionId }
  | { readonly scope: 'plugin'; readonly pluginId: string; readonly actionId: string }
  | { readonly scope: 'shared'; readonly namespace: string; readonly actionId: string };

// Interface in @sva/sdk — Implementierung in @sva/auth
export interface AuthorizationContext {
  requireActions(refs: readonly RouteActionReference[]): Promise<boolean>;
}

export type PluginActionDefinition = {
  readonly id: string;
  readonly titleKey: string;
  readonly descriptionKey?: string;
};

export type PluginRouteDefinition = {
  readonly id: string;
  readonly path: string;
  readonly requiredActions?: readonly RouteActionReference[];
  readonly component: (...args: never[]) => unknown;
};

export type PluginNavigationItem = {
  // Steuert nur Sichtbarkeit — kein Ersatz für Route-Guard
  readonly visibilityActions?: readonly RouteActionReference[];
  // ... weitere Felder
};
```

## Risks / Trade-offs

- Das Drei-Scope-Modell erhöht die Komplexität im SDK und in der Initialvalidierung.
- Der Hard Cut an `guard`/`requiredAction` ist ein Breaking Change am Plugin-SDK-Vertrag (Plugin-SDK v2). Alle internen Plugins müssen gleichzeitig migriert werden.
- Die Umstellung der IAM-API auf strukturierte Action-Objekte erfordert Migration bestehender IAM-Policies.
- Die Ownership-Regel reduziert absichtlich die Freiheit von Plugins, schützt aber die Systemintegrität.
- `shared`-Namespaces erfordern Host-seitige Registrierung — das ist ein neues Verwaltungsartefakt.

## Migration Plan

1. `CoreActionId`-Typed-Union und `RouteActionReference` (Drei-Scope) im SDK definieren.
2. `AuthorizationContext`-Interface in `@sva/sdk` anlegen; Implementierung in `@sva/auth` verdrahten.
3. `guard` und `requiredAction` (alter Typ) aus SDK entfernen (Hard Cut); `visibilityActions` auf Navigation-Items einführen.
4. `@sva/routing` von `mapPluginGuardToAccountGuard` auf `authorization.requireActions(refs)` umstellen; Funktion aus Exports entfernen.
5. IAM-Authorize-Request auf strukturiertes Action-Objekt umstellen; `serializeActionRef` in `@sva/auth` implementieren; bestehende IAM-Policies migrieren.
6. Plugin-Registry-Validierung für Format, Namespace-Eigentum und Shared-Namespace-Prüfung einführen; Registry beim App-Start einfrieren.
7. `plugin-example` und `plugin-news` vollständig auf das neue Modell migrieren (Hard Cut).
8. ADR-034 als `Superseded by ADR-035` markieren; ADR-035 unter `docs/adr/` anlegen.
9. arc42-Abschnitte, Plugin-Entwicklerhandbuch und Migrationsleitfaden aktualisieren.

### Migrationstabelle für bestehende Guards

| Alter Guard-String | Neuer `RouteActionReference`-Wert |
|---|---|
| `'content.read'` | `{ scope: 'core', actionId: 'content.read' }` |
| `'content.create'` | `{ scope: 'core', actionId: 'content.create' }` |
| `'content.write'` | `{ scope: 'core', actionId: 'content.write' }` |
