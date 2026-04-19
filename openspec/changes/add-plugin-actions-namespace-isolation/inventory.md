# Inventar und Architekturhinweise

## 1. Bestehende Action-Definitionen und Aufrufstellen

### 1.1 Definitionen

- `packages/plugin-news/src/plugin.tsx`
  - einziges produktives Plugin mit expliziten Plugin-Aktionen
  - registriert `news.create`, `news.edit`, `news.update`, `news.delete` via `definePluginActions('news', ...)`
  - referenziert Plugin-Aktionen inzwischen auch deklarativ aus den Route-Definitionen (`actionId`)
- `packages/sdk/src/plugins.ts`
  - zentrale SDK-Verträge für `PluginActionDefinition`, `definePluginActions()` und `createPluginActionRegistry()`
  - validiert Format `<namespace>.<actionName>`, reservierte Prefixe, Owner-Mismatch und explizit deklarierte Legacy-Aliase
- `packages/sdk/tests/plugins.test.ts`
  - deckt Namespace-Validierung, Kollisionen, Registry-Aufbau und Alias-Kollisionen bereits mit Unit-/Type-Tests ab

### 1.2 Aktuelle UI-/Routing-Aufrufstellen

- `packages/plugin-news/src/news.pages.tsx`
  - Create/Edit/Delete-UI bindet Labels inzwischen systematisch an deklarierte Plugin-Action-Definitionen
  - trennt Route-Aktion `news.edit` und Persistenz-Aktion `news.update` explizit, statt Submit-Labels als Sonderfall lokal zu halten
- `apps/sva-studio-react/src/lib/plugins.ts`
  - baut Plugin-, Route-, Navigation-, Content-Type- und Action-Registry auf
  - exportiert `studioPluginActionRegistry` und `getStudioPluginAction()`
  - löst deklarierte Legacy-Aliase auf kanonische Action-IDs auf und emittiert pro Alias genau eine Browser-Warnung zur Deprecation
- `apps/sva-studio-react/src/components/Sidebar.tsx`
  - löst Plugin-Navigation optional gegen die zentrale Action-Registry auf
  - verwendet bei gesetzter `actionId` Titel- und Guard-Metadaten aus der registrierten Plugin-Action
- `packages/routing/src/app.routes.shared.ts`
  - übernimmt Plugin-Routen in den Router
  - verwendet Route-Guards; Plugin-Routen können deklarativ eine `actionId` tragen, die hostseitig validiert wird

### 1.3 IAM- und Audit-Anknüpfungspunkte

- `packages/auth/src/shared/schemas.ts`
  - `authorizeRequestSchema.action` akzeptiert bereits generische, nicht auf Core-Aktionen limitierte Strings
- `packages/auth/src/iam-authorization/authorize.ts`
  - Autorisierung arbeitet bereits gegen den vollständigen `payload.action`-String
  - Namespace-Sicherheit ist für Plugin-Actions jetzt explizit über Tests abgesichert: IAM wertet vollständig qualifizierte Action-IDs ohne implizites Prefix-Mapping oder Namespace-Kollaps aus
- `packages/auth/src/iam-account-management/shared-activity.ts`
  - generischer Audit-Writer vorhanden
  - ergänzt um einen erweiterten Auth-Audit-Pfad, der Plugin-Action-Metadaten mit `actionId`, `actionNamespace`, `actionOwner`, `result`, `requestId`, `traceId` in die Audit-Datensätze schreibt

## 2. Festgestellter Gap zum Change

- SDK/Core-Grundlagen aus Task 2.x sind vorhanden.
- Die Runtime nutzt diese Contracts inzwischen über die Kernpfade:
  - UI-Labels und UI-Aktionen referenzieren die definierten Action-IDs für Referenz-Plugin und hostseitige Navigation systematisch.
  - Die Host-App exportiert eine Plugin-Action-Registry inklusive expliziter Legacy-Alias-Auflösung mit Deprecation-Warnung.
  - Routing ist für deklarative `actionId`-Bindings produktiv angebunden.
  - IAM autorisiert Plugin-Actions namespace-sicher gegen die exakt angeforderte fully-qualified Action-ID.
  - Audit protokolliert Plugin-Action-Autorisierungen mit Namespace- und Ownership-Feldern über die bestehende Auth-Audit-Pipeline.

## 2.3 Verbindliches Zielverhalten für Action-IDs

- Autorisierbare Action-IDs folgen langfristig einheitlich dem Format `<namespace>.<actionName>`.
- Das gilt sowohl für Core-Actions als auch für Plugin-Actions; der Unterschied liegt in reservierten Core-Namespaces versus plugin-eigenen Namespaces.
- Unqualifizierte Kurzformen wie `read`, `write` oder `create` sind kein gewünschter Dauerzustand, sondern nur eine explizite Legacy-Übergangsphase.
- Aus Legacy-Kurzformen darf keine implizite Namespace-Zuordnung wie `read -> content.read` oder `create -> news.create` abgeleitet werden.
- Wo Legacy-Kurzformen noch unterstützt werden, müssen sie explizit pro Action deklariert sein, auf die kanonische fully-qualified Action-ID auflösen und als deprecated markiert werden.
- Ein späteres hartes Schema-Gate für `/iam/authorize.action` auf fully-qualified Action-IDs ist damit fachlich vorbereitet, sobald interne Legacy-Aufrufer und Fixtures bereinigt sind.

## 2.1 Revalidierung von Task 2.x nach nachgezogener Analyse

- `2.1 Typsichere Action-Verträge im SDK`
  - bleibt gültig
  - `PluginActionDefinition` erzwingt `id` und `titleKey`; `definePluginActions()` stellt die typsichere Deklaration für Plugins bereit
  - die nachgezogenen Deltas für `routing` und `monorepo-structure` widersprechen diesem Vertrag nicht
- `2.2 Namespace-Validator und reservierte Präfixe`
  - bleibt gültig
  - `definePluginActions()` validiert leeren Namespace, reservierte Prefixe und Namespace-Mismatch deterministisch
  - `createPluginActionRegistry()` prüft zusätzlich Owner-Mismatch und reservierte Plugin-Namespaces zur Registry-Zeit
- `2.3 Fail-fast Action-Registry`
  - bleibt gültig
  - `createPluginActionRegistry()` bricht bei doppelter Plugin-ID, reserviertem Namespace und doppelter Action-ID deterministisch ab
  - die nachgezogenen Requirements in `plugin-actions/spec.md` werden damit weiterhin erfüllt

## 2.2 Konsequenz für die Task-Reihenfolge

- `2.1` bis `2.3` müssen nach der nachgezogenen Analyse nicht wieder geöffnet werden.
- `3.1` ist abgeschlossen:
  - Host-Registry vorhanden und exportiert
  - Referenz-Plugin nutzt deklarierte Action-Definitionen in der UI
  - Plugin-Routen sind deklarativ an fully-qualified `actionId` gebunden
  - Host-UI löst Navigationspunkte über die Action-Registry auf

## 3. arc42-Abschnitte mit Update-Bedarf

- Abschnitt 05 `docs/architecture/05-building-block-view.md`
  - Action-Registry als eigener Host-/SDK-Baustein und Beziehung zu Plugins ergänzen
- Abschnitt 08 `docs/architecture/08-cross-cutting-concepts.md`
  - Namespace-Isolation, Validierung, Logging/Audit-Pflichtfelder und Security-by-Default ergänzen
- Abschnitt 09 `docs/architecture/09-architecture-decisions.md`
  - Entscheidung zur Namensstrategie `<namespace>.<actionName>` und Legacy-Alias-Phase referenzieren
- Abschnitt 12 `docs/architecture/12-glossary.md`
  - Begriffe `Action-ID`, `Action-Namespace`, `Action-Owner`, `Legacy-Alias` ergänzen

## 4. Reihenfolge für die Umsetzung

1. OpenSpec-Deltas und dieses Inventar als Referenz vervollständigen.
2. Host- und Plugin-UI an die fully-qualified Action-IDs binden.
3. Danach IAM- und Audit-Pfade um explizite Namespace-Felder bzw. Denials erweitern.
4. Anschließend Legacy-Aliase nur noch explizit, konfliktfrei und mit Deprecation-Warnungen unterstützen; verbleibende Kurzformen per Migrationsleitfaden abbauen.

## 5. Dokumentierter Migrationspfad

- Der Leitfaden für die operative Umstellung liegt unter `docs/guides/plugin-action-migration.md`.
- Er fixiert Zielzustand, deklarative Alias-Nutzung, Prüfkommandos und einen Sunset-Plan mit konkreten Phasen ab 19. April 2026, 30. Juni 2026, 30. September 2026 und 1. Oktober 2026.
- `docs/guides/plugin-development.md` referenziert diesen Leitfaden als verbindliche Ergänzung für Plugin-Actions.

## 6. Qualitätssicherungsstand

- Integrationsabdeckung für Cross-Namespace-Verhalten liegt jetzt zusätzlich im Auth-Runtime-Pfad:
  - `packages/auth/src/iam-authorization.integration.test.ts` prüft erlaubte fully-qualified Plugin-Action-Aufrufe im eigenen Namespace
  - dieselbe Testdatei prüft verbotene Aufrufe bei gleichem Action-Namen aus einem fremden Namespace (`events.publish` gegen angefordertes `news.publish`)
- Damit ist nicht nur die pure Entscheidungsfunktion, sondern auch der `/iam/authorize`-Handler mit Request-/Response-Vertrag gegen Namespace-Kollaps abgesichert.
