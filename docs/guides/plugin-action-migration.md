# Migration auf namespaced Plugin-Action-IDs

Dieser Leitfaden beschreibt den verbindlichen Migrationspfad von Legacy-Kurzformen wie `create`, `edit`, `save` oder `delete` auf kanonische fully-qualified Plugin-Action-IDs im Format `<namespace>.<actionName>`.

Er ergänzt den Plugin-SDK-Vertrag, die IAM-/Audit-Regeln und den OpenSpec-Change `add-plugin-actions-namespace-isolation`.

## Zielzustand

- Jede autorisierbare Plugin-Action verwendet eine kanonische Action-ID im Format `<namespace>.<actionName>`.
- Der Namespace gehört dem Plugin selbst, zum Beispiel `news.create` oder `events.publish`.
- Legacy-Kurzformen bleiben nur als explizit deklarierte Alias-Einträge zulässig.
- Aus Kurzformen darf nie implizit ein Namespace abgeleitet werden.
- Neue Plugins und neue Actions führen keine unqualifizierten Kurzformen mehr ein.

## Wann ein Legacy-Alias noch zulässig ist

Ein Legacy-Alias ist nur zulässig, wenn alle folgenden Bedingungen erfüllt sind:

- Es gibt bereits bestehende Aufrufer oder persistierte Referenzen, die noch die Kurzform verwenden.
- Der Alias ist im Plugin-Vertrag explizit über `legacyAliases` deklariert.
- Die kanonische Action-ID bleibt die fachlich führende Identität.
- Die Host-Runtime kann die Alias-Nutzung als deprecated kennzeichnen und warnen.
- Für den Alias existiert ein dokumentierter Sunset-Termin.

Nicht zulässig sind:

- neue Kurzformen ohne Migrationsgrund
- implizite Zuordnungen wie `create -> news.create`
- Alias-Nutzung über Namespace-Grenzen hinweg
- Alias-Namen, die mit einer anderen kanonischen Action-ID oder einem anderen Alias kollidieren

## Migrationsschritte pro Plugin

### 1. Bestehende Aufrufer inventarisieren

Vor der Umstellung müssen alle Stellen mit Action-Strings erfasst werden:

- Plugin-Definition (`actions`, `routes`, `navigation`)
- UI-Komponenten und Button-Labels
- Host-Bindings wie Sidebar, Routing oder Guard-Zuordnung
- IAM-Aufrufer und Tests
- Fixtures, Snapshots und Story-/Demo-Daten

Empfohlene Suchmuster:

```bash
rg -n "'(create|edit|save|update|delete|read|write)'" packages apps docs
rg -n 'actionId|requiredAction|guard|authorize' packages apps
```

### 2. Kanonische Action-IDs festlegen

Jede Plugin-Action erhält zuerst eine kanonische fully-qualified ID.

Beispiel:

```ts
const newsActions = definePluginActions('news', [
  {
    id: 'news.create',
    titleKey: 'actions.create',
  },
  {
    id: 'news.update',
    titleKey: 'actions.update',
  },
]);
```

Regeln:

- `namespace` entspricht der Plugin-ID
- `actionName` ist stabil, fachlich präzise und nicht UI-spezifisch
- Route-Aktionen und Persistenz-Aktionen werden getrennt modelliert, wenn sie fachlich verschieden sind

### 3. Legacy-Aliase nur explizit deklarieren

Wenn bestehende Kurzformen noch gebraucht werden, werden sie direkt an der kanonischen Action definiert:

```ts
const newsActions = definePluginActions('news', [
  {
    id: 'news.create',
    titleKey: 'actions.create',
    legacyAliases: ['create'],
  },
  {
    id: 'news.update',
    titleKey: 'actions.update',
    legacyAliases: ['save', 'update'],
  },
]);
```

Dabei gilt:

- Alias-Einträge sind reine Übergangshilfen
- die UI, das Routing und IAM sollen bereits die kanonische ID verwenden
- neue Aufrufer dürfen keinen Alias mehr als Primärwert einführen

### 4. Host- und Plugin-Bindings auf kanonische IDs umstellen

Nach der Deklaration müssen alle aktiven Laufzeitpfade die kanonische ID verwenden:

- Routen über `actionId`
- Navigation über deklarierte Action-Metadaten
- UI-Labels über `titleKey`
- Guards und IAM-Aufrufe über die fully-qualified Action-ID
- Audit-Pfade mit `actionId`, `actionNamespace` und `actionOwner`

Der Alias bleibt nur für Alt-Aufrufer als kompatibler Leseweg bestehen.

### 5. Deprecation-Warnungen prüfen

Alias-Aufrufe müssen zur Laufzeit erkennbar sein.

Erwartetes Verhalten:

- Alias wird auf die kanonische Action-ID aufgelöst
- der zurückgegebene Registry-Eintrag markiert den Alias als deprecated
- die Host-Runtime protokolliert pro Alias mindestens eine Warnung

Die Warnung dient als Migrationssignal für verbleibende Alt-Aufrufer und ist kein Ersatz für die eigentliche Bereinigung.

### 6. Tests nachziehen

Mindestens erforderlich:

- SDK-Tests für Alias-Validierung und Kollisionsverhalten
- Plugin-Tests für deklarierte Action-Definitionen
- Host-Tests für Alias-Auflösung und Deprecation-Warnung
- IAM-/Audit-Tests, wenn Action-Strings in Autorisierung oder Protokollierung eingehen

Verbindliche Mindestkommandos:

```bash
pnpm nx run plugin-sdk:test:unit
pnpm nx run plugin-sdk:lint
pnpm nx run <plugin>:test:unit
pnpm nx run sva-studio-react:test:unit
openspec validate add-plugin-actions-namespace-isolation --strict
```

## Sunset-Plan

Für die bestehende Legacy-Action-Migration gilt folgender verbindlicher Sunset-Plan:

### Phase 1: Sofortregel ab 19. April 2026

- Keine neuen unqualifizierten Action-Strings in Plugins, Host-UI, Routing oder IAM hinzufügen.
- Neue Plugin-Actions werden ausschließlich mit fully-qualified IDs eingeführt.
- Legacy-Kurzformen sind nur noch als explizite `legacyAliases` zulässig.

### Phase 2: Bereinigungsphase bis 30. Juni 2026

- Alle aktiven internen Aufrufer im Workspace müssen auf kanonische Action-IDs umgestellt werden.
- Test-Fixtures und Snapshots mit Legacy-Kurzformen werden entweder entfernt oder explizit als Legacy-Fall markiert.
- Für jeden verbleibenden Alias muss ein konkreter Restgrund dokumentiert sein.

### Phase 3: Freeze-Phase bis 30. September 2026

- Es dürfen keine neuen `legacyAliases` mehr hinzugefügt werden.
- Verbleibende Alias-Nutzung wird als technischer Restbestand behandelt und vor jedem Release aktiv geprüft.
- Der Migrationsfortschritt wird in PRs und Changes gegen diesen Leitfaden bewertet.

### Phase 4: Removal-Phase ab 1. Oktober 2026

Removal darf erst erfolgen, wenn alle folgenden Bedingungen erfüllt sind:

- keine produktiven internen Aufrufer verwenden noch Legacy-Kurzformen
- keine relevanten Tests, Fixtures oder Seed-Daten hängen noch an Kurzformen
- betroffene Plugins haben ihre `legacyAliases` entfernt
- der HTTP-/IAM-Vertrag kann das fully-qualified Format ohne Kompatibilitätsbruch hart erzwingen

Ab diesem Zeitpunkt gilt:

- `legacyAliases` werden aus betroffenen Plugins entfernt
- Alias-Lookups werden nicht mehr registriert
- ein hartes Format-Gate für autorisierbare Action-IDs wird zulässig

## Review-Checkliste vor dem Entfernen eines Alias

- Ist der Alias im Plugin-Vertrag noch notwendig oder nur bequem?
- Verwenden Host, Plugin-UI und IAM bereits ausschließlich die kanonische ID?
- Gibt es noch Tests oder Fixtures, die den Alias absichtlich benötigen?
- Ist der Sunset-Termin erreicht oder bewusst verlängert worden?
- Ist die Entfernung in Change, Doku und PR nachvollziehbar dokumentiert?

Wenn eine dieser Fragen mit Nein beantwortet wird, bleibt der Alias ein bewusster Übergangspfad und darf nicht stillschweigend entfernt werden.

## Referenzen

- [Plugin-Entwicklung](./plugin-development.md)
- [arc42 Querschnittliche Konzepte](../architecture/08-cross-cutting-concepts.md)
- [arc42 Architekturentscheidungen](../architecture/09-architecture-decisions.md)
- [ADR-034: Plugin-SDK-Vertrag v1](../adr/ADR-034-plugin-sdk-vertrag-v1.md)
