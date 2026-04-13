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
- News als fachlichen Content-Type auf bestehender Infrastruktur bereitstellen
- CRUD plus Publish in v1 ermöglichen
- Studio-Kern und Plugin sauber trennen

## Non-Goals

- Kein dynamisches Plugin-Loading in v1
- Kein separater News-Backend-Service
- Kein eigener Review-/Freigabeprozess
- Keine plugin-spezifischen IAM-Rechte in v1
- Kein Medien-Upload-Workflow in v1

## Decisions

- Decision: `news` wird als `contentType` innerhalb des bestehenden IAM-Content-Modells umgesetzt.
  - Rationale: schnellster belastbarer Pfad mit maximaler Wiederverwendung.
- Decision: Plugins kommunizieren ausschließlich über `@sva/sdk`.
  - Rationale: App- und Backend-Interna bleiben austauschbar.
- Decision: Das Plugin exportiert ein Plugin-Objekt statt nur lose Routen.
  - Rationale: Navigation, Content-Typen und spätere Erweiterungspunkte werden zentral beschreibbar.
- Decision: V1 verwendet weiterhin `content.read`, `content.create`, `content.write`.
  - Rationale: keine neue IAM-Matrix im ersten Schritt.
- Decision: News bekommt eigene Studio-Routen unter `/plugins/news`.
  - Rationale: klare Plugin-Abgrenzung bei gleichzeitiger Wiederverwendung der Content-API.

## Plugin-Vertrag in v1

Das SDK stellt einen Plugin-Vertrag bereit, der mindestens folgende Bereiche kapselt:

- Plugin-ID und Anzeigename
- Route-Factories
- Navigationsdefinitionen
- registrierte Content-Type-Definitionen

Das Plugin darf keine direkten Importe aus `apps/sva-studio-react`, `packages/auth` oder anderen Studio-Interna benötigen.

## Content-Modell für News

V1-News nutzt die Core-Felder des Content-Modells und einen typisierten Payload mit:

- `teaser`
- `body`
- `imageUrl?`
- `externalUrl?`
- `category?`

Der Payload bleibt in `iam.contents.payload_json` gespeichert. Plugin-seitige Validierung und Rendering erfolgen über den SDK-Content-Type-Vertrag.

## Routing und UI

Der Studio-Kern bleibt Eigentümer des Route-Baums und der Guards.
Das News-Plugin registriert:

- `/plugins/news`
- `/plugins/news/new`
- `/plugins/news/$contentId`

Die Plugin-Seiten verwenden dieselben IAM-/Content-APIs wie die generische Content-Verwaltung, arbeiten aber nur auf `contentType = news`.

## Risks / Trade-offs

- Generische IAM-Rechte sind für v1 ausreichend, aber fachlich grob.
- `payload_json` ist flexibel, aber langfristig schwächer als ein stark typisiertes Backend-Modell.
- Plugin-Routen im Hauptbundle sind kein echtes Laufzeit-Plugin-System, aber ein guter erster Evolutionsschritt.

## Migration Plan

1. SDK-Vertrag für Plugins erweitern
2. Plugin-Registrierung im Studio-Kern einführen
3. `@sva/plugin-news` implementieren
4. bestehende Content-API optional um `contentType`-Filter ergänzen
5. Navigation und Guards für Plugin-Routen integrieren
6. Doku und arc42-Abschnitte aktualisieren

## Open Questions

- Keine für v1. Entscheidungen sind für die erste Ausbaustufe vollständig getroffen.
