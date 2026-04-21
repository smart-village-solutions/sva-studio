## Context

Das Repo besitzt heute bereits:

- plugin-basierte Routen über `RouteFactory`
- ein generisches Content-Modell mit `contentType`, `payload`, `status` und Historie
- IAM-basierte Zugriffsauswertung für generische Content-Aktionen
- ein minimales SDK für Routen und Content-Type-Definitionen

Für ein erstes fachliches Plugin reicht das bestehende Modell noch nicht aus, weil Navigation, Plugin-Metadaten und spezialisierte Content-UI nicht als stabiler SDK-Vertrag beschrieben sind.

## Goals

- Ein erstes produktives Plugin-Muster für Studio definieren
- Plugin-Kopplung ausschließlich über `@sva/sdk`
- News als fachlichen Content-Type auf bestehender Mainserver-Infrastruktur bereitstellen
- CRUD (Create, Read, Update, Delete) in v1 ermöglichen
- Studio-Kern und Plugin sauber trennen

## Non-Goals

- Kein dynamisches Plugin-Loading in v1
- Kein separater News-Backend-Service
- Kein eigener Review-/Freigabe-/Publish-Workflow in v1 (kommt in einer späteren Ausbaustufe)
- Keine plugin-spezifischen IAM-Rechte in v1
- Kein Medien-Upload-Workflow in v1
- Kein serverseitiger `contentType`-Filter in v1 (kommt in einer späteren Ausbaustufe)
- Keine mehrsprachigen News-Inhalte in v1 (Content-Ebene bleibt einsprachig)
- Keine Plugin-Ladereihenfolge oder Routenkonflikt-Auflösung in v1 (nur ein Plugin aktiv)

## Decisions

- Decision: `news` wird als `contentType` innerhalb des bestehenden IAM-Content-Modells umgesetzt.
  - Rationale: schnellster belastbarer Pfad mit maximaler Wiederverwendung.
- Decision: News werden direkt auf dem Mainserver gespeichert. Das Studio speichert nur Audit-Log und Berechtigungen.
  - Rationale: Die bestehende Mainserver-API ist die kanonische Datenquelle für Content; das Studio orchestriert lediglich.
- Decision: Plugins kommunizieren ausschließlich über `@sva/sdk`.
  - Rationale: App- und Backend-Interna bleiben austauschbar.
- Decision: Das Plugin exportiert ein Plugin-Objekt statt nur lose Routen.
  - Rationale: Navigation, Content-Typen, Translations und spätere Erweiterungspunkte werden zentral beschreibbar.
- Decision: V1 verwendet weiterhin `content.read`, `content.create`, `content.write` ohne Content-Type-Qualifier.
  - Rationale: keine neue IAM-Matrix im ersten Schritt. Content-Type-scoped Permissions (z. B. `news.write`) sind als v2-Folgearbeit geplant. Die bewusste Abweichung von ADR-013 (ABAC-Attribut `contentType` fehlt) wird als Risiko in arc42 §11 dokumentiert.
- Decision: News bekommt eigene Studio-Routen unter `/plugins/news`.
  - Rationale: klare Plugin-Abgrenzung bei gleichzeitiger Wiederverwendung der Content-API. `/plugins/<pluginId>/*` ist die kanonische Plugin-Route-Konvention.
- Decision: `body` wird als HTML gespeichert und mit serverseitiger Sanitisierung (Allowlist-basiert, z. B. `sanitize-html`) vor Persistenz bereinigt.
  - Rationale: Redakteure benötigen Rich-Text; XSS-Schutz muss serverseitig erzwungen werden. Client-seitige Ausgabe erfolgt über eine sanitisierte HTML-Render-Komponente, niemals über `dangerouslySetInnerHTML` ohne Sanitisierung.

## Abgrenzung zu ADR-002

ADR-002 beschreibt ein umfangreiches Plugin-System mit Runtime Loading/Unloading, Sandbox-Isolation, Hot Module Replacement, Plugin Permissions und Version Compatibility Checks. V1 klammert all das bewusst aus (siehe Non-Goals). Dieses Proposal ist die **erste Ausbaustufe** des ADR-002-Zielbilds. Die v1-Reduktion ist kein Widerspruch zur ADR, sondern ein inkrementeller Evolutionsschritt. Die Fortschreibung wird in arc42 §09 als v1-Scope-Einordnung dokumentiert.

## Plugin-Vertrag in v1

Das SDK stellt einen Plugin-Vertrag bereit, der mindestens folgende Bereiche kapselt:

- Plugin-ID und Anzeigename
- Route-Factories
- Navigationsdefinitionen
- registrierte Content-Type-Definitionen
- Plugin-eigene Translations (i18n-Ressourcen pro Locale)

**Minimales TypeScript-Interface (Skizze):**

```typescript
type PluginDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly routes: readonly RouteFactory[];
  readonly navigation?: readonly NavigationItem[];
  readonly contentTypes?: readonly ContentTypeDefinition[];
  readonly translations?: Record<SupportedLocale, Record<string, unknown>>;
};
```

Das Plugin darf keine direkten Importe aus `apps/sva-studio-react`, `packages/auth` oder anderen Studio-Interna benötigen. Der Studio-Kern wendet Guards auf Plugin-Routen an; das Plugin deklariert im SDK-Vertrag den benötigten Schutzlevel, implementiert aber keine eigene Zugriffskontrolle.

## i18n-Konzept für Plugins

Plugins bringen eigene Translation-Ressourcen mit, die beim Plugin-Load vom Studio-Kern in den i18n-Resource-Baum gemergt werden. Der SDK stellt dafür einen `usePluginTranslation(pluginId)`-Hook bereit, der den Plugin-Namespace kapselt. Plugins importieren `t()` nicht direkt aus der App, sondern über diesen SDK-Zugang.

**Key-Konvention:** `<pluginId>.<area>.<key>` (z. B. `news.list.title`, `news.editor.teaser`, `news.actions.delete`).

Alle UI-Labels, Aktionen, Status- und Fehlertexte müssen als Translation-Keys in `de` und `en` vorliegen. Harte Strings in Plugin-UI sind nicht erlaubt.

## Content-Modell für News

News werden direkt auf dem Mainserver gespeichert. Das Studio speichert nur Audit-Log und Berechtigungen. Das News-Plugin nutzt die Mainserver-Content-API und arbeitet nur mit Feldern, die die API kennt.

V1-News nutzt die Core-Felder des Content-Modells und einen typisierten Payload mit:

- `teaser` (Pflicht, Plain Text, max. 500 Zeichen)
- `body` (Pflicht, HTML, max. 50.000 Zeichen, serverseitig sanitisiert)
- `imageUrl?` (optional, HTTPS-URL, Protokoll-Allowlist)
- `externalUrl?` (optional, HTTPS-URL, Protokoll-Allowlist — `javascript:`, `data:`, `blob:` werden abgelehnt)
- `category?` (optional, max. 128 Zeichen)

### Serverseitige Validierung

Für den News-Payload wird ein Zod-Schema registriert, das bei Create/Update serverseitig angewendet wird:

```typescript
const newsPayloadSchema = z.object({
  teaser: z.string().min(1).max(500),
  body: z.string().min(1).max(50_000),
  imageUrl: z.string().url().refine(u => u.startsWith('https://')).optional(),
  externalUrl: z.string().url().refine(u => u.startsWith('https://')).optional(),
  category: z.string().max(128).optional(),
});
```

### HTML-Sanitisierung

`body` wird vor Persistenz serverseitig mit einer Allowlist-basierten Sanitisierung (`sanitize-html`) bereinigt. Erlaubt sind Basis-HTML-Tags (p, h1-h6, ul, ol, li, a, strong, em, br, img) und sichere Attribute. Script-Tags, Event-Handler und unsichere URIs werden entfernt. `teaser` wird als Plain Text behandelt — HTML-Tags werden serverseitig gestripped.

Der Payload bleibt in `iam.contents.payload_json` gespeichert. Plugin-seitige Validierung und Rendering erfolgen über den SDK-Content-Type-Vertrag.

## Routing und UI

Der Studio-Kern bleibt Eigentümer des Route-Baums und der Guards.
Das News-Plugin registriert:

- `/plugins/news`
- `/plugins/news/new`
- `/plugins/news/$contentId`

Die Plugin-Seiten verwenden dieselben IAM-/Content-APIs wie die generische Content-Verwaltung, arbeiten aber nur auf `contentType = news`.

## Risks / Trade-offs

- Generische IAM-Rechte (`content.*`) sind für v1 ausreichend, aber fachlich grob. Bei einem zweiten Plugin (z. B. Events) fehlt Content-Type-Isolation: ein News-Redakteur könnte Events anlegen. Content-Type-scoped Permissions (z. B. `news.write`) sind als v2-Folgearbeit geplant. Diese bewusste Abweichung wird als Risiko in arc42 §11 und als ADR dokumentiert.
- `payload_json` ist flexibel, aber langfristig schwächer als ein stark typisiertes Backend-Modell. Dieses Risiko wird in arc42 §11 als technische Schuld aufgenommen.
- Plugin-Routen im Hauptbundle sind kein echtes Laufzeit-Plugin-System, aber ein guter erster Evolutionsschritt. Plugin-Bundle-Beitrag sollte < 30 KB gzipped bleiben; ab dieser Schwelle greift dynamisches Loading als v2-Maßnahme.
- HTML in `body` erfordert konsequente Sanitisierung. Ohne serverseitige Bereinigung besteht Stored-XSS-Risiko im Admin-Kontext (Session-Hijacking).

## DSGVO und Löschkonzept

Das bestehende 2-stufige Löschverfahren (Soft-Delete → Anonymisierung) gilt auch für `iam.contents` und damit für News. `author_display_name` wird im Anonymisierungslauf maskiert. Die Inhaltshistorie (`iam.content_history`) wird in den Art.-15-Auskunftsexport einbezogen.

## Migration Plan

1. SDK-Vertrag für Plugins erweitern (inkl. `PluginDefinition`-Interface und i18n-Erweiterungspunkt)
2. Plugin-Registrierung im Studio-Kern einführen (inkl. Translation-Merge)
3. `@sva/plugin-news` implementieren (CRUD, Validierung, Sanitisierung)
4. Navigation und Guards für Plugin-Routen integrieren (Guards vom Studio-Kern, nicht vom Plugin)
5. i18n-Keys für News-Plugin anlegen (de + en)
6. Doku und arc42-Abschnitte aktualisieren (§04, §05, §06, §08, §09, §11, §12)
7. ADR für Plugin-SDK-Vertrag v1 anlegen

## Open Questions

- Keine für v1. Entscheidungen sind für die erste Ausbaustufe vollständig getroffen.
