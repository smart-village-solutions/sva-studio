## Context

Heute schützen die drei produktiven Fachplugins ihre Listen-, Create-, Edit- und Delete-Flows über gemeinsame `content.*`-Rechte. Das ist für den ersten Rollout ausreichend gewesen, skaliert aber fachlich nicht: Rollen, Gruppen und Nutzerrechte lassen sich nicht pro Plugin differenzieren.

Gleichzeitig existieren bereits drei relevante Bausteine:

- voll qualifizierte Plugin-Action-IDs wie `news.create`
- strukturierte IAM-Permissions mit `action`, `resourceType`, `resourceId`, `effect`, `scope`
- ein Plugin-SDK mit Build-Time-Registry

Die Folgearbeit soll diese Bausteine zu einem plugin-spezifischen Rechtemodell zusammenführen, ohne die bestehende Nachvollziehbarkeit von Rollen, Gruppen und effektiven Berechtigungen zu verlieren.

## Goals

- Rechte für `news`, `events` und `poi` separat pflegbar machen
- Gruppen und Rollen weiterhin als primären Zuweisungsweg beibehalten
- Plugin-spezifische Autorisierung für Navigation, Listen, Detailseiten und Schreibaktionen erzwingen
- Einen generischen SDK-Vertrag schaffen, über den künftige Plugins ihre Rechte selbst deklarieren können
- Plugins von Core-internen Rechtestrukturen entkoppeln

## Non-Goals

- Keine vollständige Neudefinition aller IAM-Rechte außerhalb des Plugin-Bereichs
- Keine Plugin-eigene Autorisierungslogik oder Plugin-seitige Persistenzpfade
- Keine Beibehaltung von `content.*` als normaler Redaktionsvertrag für produktive Fachplugins

## Decision

Für Plugins wird im SDK ein generischer Permission-Vertrag eingeführt. Produktive Plugins deklarieren darüber eigene fachliche Rechtefamilien.

Für die drei Fachplugins werden als erste produktive Rechtefamilien eingeführt. Jedes Plugin deklariert seine eigenen fachlichen Rechte über den SDK-Vertrag. Art und Anzahl der Rechte bestimmt das Plugin selbst — es gibt keine feste Vorgabe aus dem Core.

Die bestehende `content.*`-Granularität (z. B. `read`, `create`, `updateMetadata`, `updatePayload`, `changeStatus`, `publish`, `delete` usw.) dient als Orientierung. Ob ein Plugin alle oder nur einen Teil davon als eigene Rechte deklariert, entscheidet das Plugin.

Beispiel für `news`:

- `news.read`, `news.create`, `news.updatePayload`, `news.publish`, `news.delete`

Beispiel für `poi` (falls weniger Granularität nötig):

- `poi.read`, `poi.create`, `poi.update`, `poi.delete`

Diese Rechte sind in Rollen und damit indirekt auch in Gruppen bearbeitbar. Plugin-Routen, Plugin-Navigation und Plugin-Schreibaktionen prüfen diese plugin-spezifischen Rechte direkt.

Plugins deklarieren nur Metadaten. Das Studio bleibt autoritativ für Validierung, Persistenz, Registry-Aufbau, Rollenzuordnung, Gruppenvererbung und Autorisierung.

### Plugin-Actions und IAM-Permissions

Der Change nutzt die vorhandene fully-qualified Plugin-Action-Konvention bewusst weiter. Für die produktiven CRUD-Flows dürfen Plugin-Action-ID und Plugin-Permission-ID identisch sein, zum Beispiel `news.create`.

Diese Gleichheit ist eine **v1-Konvention**, kein Architekturprinzip. Die bestehende `requiredAction`-Indirektion in `PluginActionDefinition` bleibt als kanonischer Mapping-Pfad erhalten, damit Action und Permission später divergieren können (z. B. `news.preview` als UI-Aktion ohne IAM-Relevanz oder `news.manage` als Permission für mehrere Actions).

Die v1-Konvention bedeutet konkret:

- Die Plugin-Action beschreibt, welche fachliche UI- oder Serveraktion ausgelöst wird.
- Die Plugin-Permission beschreibt, welches IAM-Recht der Host dafür auswertet.
- Das Plugin darf keine Allow-/Deny-Entscheidung liefern und keine Permission aus fremden Namespaces referenzieren.
- Der Host validiert beim Build-Time-Snapshot, dass jede autorisierbare Plugin-Action genau auf eine registrierte Plugin-Permission im eigenen Namespace verweist.
- Fehlt diese Permission oder verweist eine Action auf `content.*`, einen fremden Plugin-Namespace oder einen nicht registrierten technischen Schlüssel, muss die Registry fail-fast abbrechen.

Damit bleibt die Action-Registry für UI-Bindings und Audit nutzbar, während die fachliche Autorisierung weiterhin ausschließlich über IAM-Authorizer, Rollen, Gruppen, direkte Nutzerrechte und Permission-Snapshots läuft.

## SDK Contract

Das Plugin-SDK erhält einen deklarativen Vertrag, etwa in der Form:

- `definePluginPermissions(<namespace>, permissions)`

Jede deklarierte Plugin-Permission enthält mindestens:

- `id`
- `titleKey`

Optional können zusätzliche host-owned Metadaten folgen, solange sie nicht zu Plugin-seitiger Autorisierungslogik führen.

Wesentliche Regeln:

- Plugins dürfen nur Rechte im eigenen Namespace deklarieren.
- Plugins deklarieren keine Rollen, keine Gruppen und keine effektiven Allow/Deny-Entscheidungen.
- Plugins kennen keine IAM-Tabellen, keine Core-Seed-Mechanik und keine Core-internen Berechtigungsfamilien.
- Plugin-Actions dürfen nur auf registrierte Plugin-Permissions im eigenen Namespace verweisen.
- `content.*` darf in produktiven Fachplugins nicht mehr als fachlicher Guard-Vertrag in Plugin-Definitionen auftauchen.

## Namespace-Validierung

Der Host validiert Plugin-Namespaces bei Build-Time nach folgenden Regeln:

- Zulässiges Format: `^[a-z][a-z0-9-]{1,30}$`
- Reserved-Namespaces (dürfen nicht von Plugins beansprucht werden): `content`, `iam`, `admin`, `system`, `platform`
- Duplikat-Prüfung: Zwei Plugins dürfen nicht denselben Namespace registrieren. Bei Duplikaten bricht die Registry fail-fast ab.
- Die Reserved-Liste ist im Host konfigurierbar und kann bei Bedarf erweitert werden.

## Authorization Model

Das Zielmodell trennt zwischen:

- fachlicher Plugin-Berechtigung, die Admins pflegen
- gemeinsamer Host-Infrastruktur, die diese Rechte auswertet

Für produktive Fachplugins sind plugin-spezifische Rechte die kanonischen IAM-Rechte. `content.*` bleibt kein bearbeitbarer Redaktionsvertrag für diese Plugins.

Referenziert eine Guard-Prüfung zur Laufzeit eine Permission-ID, die nicht in der aktiven Plugin-Permission-Registry registriert ist, wird der Zugriff deny-by-default verweigert (fail-closed).

Unabhängig von internen Shared-Implementierungen gelten diese Regeln:

- `news.*` berechtigt nie implizit zu `events.*` oder `poi.*`
- `events.*` berechtigt nie implizit zu `news.*` oder `poi.*`
- `poi.*` berechtigt nie implizit zu `news.*` oder `events.*`
- Plugin-Definitionen referenzieren keine Core-internen `content.*`-Rechte mehr als fachlichen Guard-Vertrag
- die Admin-UI zeigt plugin-spezifische Rechte nicht als rohe technische Detailwerte, sondern als fachliche Rechte pro Plugin

## IAM Persistence

Plugin-Rechte werden als reguläre, strukturierte IAM-Permissions persistiert. Die Quelle dieser Rechte ist die Plugin-Permission-Registry, nicht eine manuell hardcodierte Liste im Core.

Die Host-Runtime baut daraus die kanonischen Permission-Einträge und stellt sicher:

- deterministische IDs/Keys pro Plugin-Recht
- klare Namespace-Isolation
- generische Renderbarkeit in Rollen- und Transparenz-UI

## Migration

Da es noch keine produktive Nutzung mit Echtdaten gibt, ist kein Datenmigrationspfad erforderlich. Die Umstellung erfolgt als direkter Schnitt:

- Seed-Plan und Seed-Tests werden direkt auf plugin-spezifische Rechte umgestellt.
- Die bisherigen `content.*`-Permissions werden aus den Seeds entfernt, soweit sie durch plugin-spezifische Rechte ersetzt sind.
- Persona-Zuordnungen werden entsprechend angepasst: Jede Persona erhält die plugin-spezifischen Rechte, die ihrer fachlichen Rolle entsprechen.
- Nach der Umstellung darf kein Seed und kein Guard mehr auf `content.*` für produktive Fachplugin-Flows verweisen.

## UI Consequences

- Rollenverwaltung: Plugin-Rechte generisch aus der Registry gruppiert nach Plugin
- Gruppenverwaltung: gebündelte Rollen bleiben der Hauptmechanismus; Gruppen selbst verwalten keine direkten Plugin-Rechte

Permission-Trace (welches Recht kam über welche Gruppe/Rolle) ist ein eigenständiges Feature und nicht Teil dieses Changes.

## Deployment-Reihenfolge

Da die Build-Time-Registry erst mit dem neuen App-Image existiert, Seeds aber vor dem App-Deploy laufen, muss die Rollout-Sequenz die zirkuläre Abhängigkeit auflösen:

1. **Migration/Seeds ausführen:** Neue plugin-spezifische Permissions in der DB anlegen (Seeds kennen die IDs statisch, unabhängig von der Plugin-Registry)
2. **App-Deploy mit neuem Image:** Build-Time-Registry validiert, dass die in den Plugins deklarierten Permissions in der DB existieren
3. **Smoke-Test:** Verify, dass Plugin-Routen mit den neuen Guards erreichbar sind

Die Seeds verwenden deterministische UUIDs und sind idempotent (`ON CONFLICT DO NOTHING`). Dadurch können sie unabhängig vom App-Image ausgeführt werden. Die Build-Time-Registry validiert lediglich die Konsistenz zwischen Plugin-Deklaration und persistiertem Permission-Bestand.

## Risks

- Wenn das SDK nur für `news/events/poi` statt generisch erweitert wird, entsteht sofort neue Sonderfall-Logik.
- Wenn Plugins mehr als deklarative Metadaten liefern dürfen, droht eine schleichende Verlagerung von Sicherheitslogik aus dem Host in Plugins.
- Wenn ADR-034 und der Plugin-Guide nicht fortgeschrieben werden, bleibt ein dokumentierter Widerspruch zum bisherigen `content.*`-Guard-Vertrag bestehen.
- Ohne Namespace-Validierung könnten fehlerhafte Plugins fremde Namespaces beanspruchen oder Reserved-Namespaces wie `iam.*` verwenden.

## Documentation Decision

Der Change ist eine fachliche Fortschreibung des Plugin-SDK- und IAM-Rechtemodells. Die Umsetzung muss deshalb mindestens eine der folgenden Entscheidungen treffen und dokumentieren:

- ADR-034 wird explizit fortgeschrieben und beschreibt Plugin-Permissions als neuen Bestandteil des statischen SDK-Vertrags.
- Oder es wird eine neue ADR für plugin-spezifische IAM-Rechte angelegt, die ADR-034, ADR-012/013 und ADR-025 referenziert.

Unabhängig von der ADR-Form müssen `docs/guides/plugin-development.md` und die betroffenen arc42-Abschnitte aktualisiert werden. Der bisherige Satz, dass spezialisierte Plugin-Content-Typen Rechte weiterhin über bestehende Core-Aktionen anwenden, darf danach für produktive Fachplugins nicht mehr gelten.
