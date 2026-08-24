## Context

Die Abholortseite lädt aktuell den vollständigen `locations`-Scope des Waste-Master-Data-Overview. Der Browser filtert diesen Bestand, schneidet danach die angeforderte Seite zu und sortiert erst innerhalb dieser Seite nach genau einer Spalte. Der Repository-Read für `waste_collection_locations` kennt nur einfache ID-/Statusfilter und ordnet nach Erstellungszeit und ID.

Der Tour-Zuordnungsdialog besitzt bereits eine fachliche Adresssortierung für einen vollständig im Browser vorhandenen Dialogbestand. Diese Sortierung ist eine fachliche Referenz, kann für die paginierte Stammdatentabelle aber nicht unverändert die Ownership übernehmen.

## Goals / Non-Goals

### Goals

- Global korrekte Reihenfolge `Ort → Straße → Hausnummer` beziehungsweise `Region → Ort → Straße → Hausnummer` vor der Pagination.
- Ein serverseitiger, typisierter und allowlist-basierter Listenvertrag für Filter, Sortierung, Gesamtzahl und Seiten.
- Identische Sortiersemantik für Desktop und schmale Ansichten.
- Fehlende Werte in beiden Richtungen zuletzt und stabile Gleichstandsauflösung über `ID asc`.
- Erhalt ID-basierter Auswahlen über Seiten-, Filter- und Sortierwechsel hinweg.
- Automatisierte Nachweise über Repository, Read Model, Handler, Search-Params und UI.

### Non-Goals

- Keine Änderung der gespeicherten Abholortdaten oder ihrer Hierarchiebeziehungen.
- Keine neue Gruppierungs- oder Baumansicht.
- Keine Änderung des Tour-Zuordnungsdialogs.
- Keine vollständige Ablösung des Master-Data-Overview für Formulare, Hierarchie oder Fraktionsabdeckungsprüfung.
- Keine frei konfigurierbare Liste von Sortierfeldern.

## Decisions

### 1. Eigener hostgeführter Listenvertrag

Die Abholorttabelle liest eine dedizierte Projektion über `GET /api/v1/waste-management/collection-locations`. Der bestehende Pfad wird damit neben seinen Mutationen um einen autorisierten Read ergänzt. Der Request enthält ausschließlich normalisierte Parameter:

- `q`
- `status=all|active|inactive`
- optional `regionId`, `cityId` und `tourId`
- `sortMode=address|addressWithRegion`
- `sortDirection=asc|desc`
- `page`
- `pageSize=10|25|50|100`

Die Response enthält die aufgelösten Adresswerte und verknüpften Touren der sichtbaren Abholorte sowie `page`, `pageSize`, `pageCount` und `total`. IDs und Stammdatenreferenzen bleiben enthalten, damit vorhandene Editier-, Kopier- und Auswahlaktionen keine Anzeigezeichenfolgen als Identität verwenden.

Der bestehende `scope=locations`-Overview bleibt für die übrigen Verbraucher erhalten. Die Tabelle darf ihre Reihenfolge, Gesamtzahl und Seiten jedoch ausschließlich aus der neuen Listenprojektion ableiten.

### 2. Feste fachliche Sortiermodi statt freier Spalten

`address` bildet genau diese Schlüssel ab:

1. Ort
2. Straße
3. Hausnummer
4. Abholort-ID aufsteigend

`addressWithRegion` stellt die Region vor dieselbe Folge. Die gewählte Richtung gilt für alle fachlichen Adresskriterien; die ID bleibt als technischer Tie-Breaker immer aufsteigend. Ein unbekannter Modus, eine unbekannte Richtung oder mehrfach übergebene widersprüchliche Kontrollparameter führen zu `400 invalid_request`.

Das Repository bildet die beiden Modi auf feste Query-Bausteine ab. Requestwerte dürfen niemals direkt in `ORDER BY` eingesetzt werden.

### 3. Vergleichs- und Nullsemantik

Textwerte werden deutschsprachig, ohne relevante Groß-/Kleinschreibungsunterschiede und mit numerischer Semantik verglichen. Dadurch steht beispielsweise Hausnummer `2` vor `10`. Whitespace-only-Werte gelten wie fehlende Werte.

Für jedes fachliche Kriterium wird zuerst zwischen vorhanden und fehlend unterschieden. Fehlende Werte stehen deshalb sowohl bei `asc` als auch bei `desc` zuletzt. Erst vorhandene Werte folgen der gewählten Richtung. Der abschließende Vergleich der ID ist richtungsunabhängig aufsteigend.

Eine versionierte Waste-Tenant-Migration legt dafür die benannte Collation `sva_de_numeric` mit `provider = icu`, `locale = 'de-u-kn-true-ks-level2'` und `deterministic = false` an. Die sekundäre ICU-Stärke unterscheidet Akzente, behandelt Groß- und Kleinschreibung aber als gleichwertig; die nichtdeterministische Collation lässt solche fachlich gleichen Werte tatsächlich bis zum expliziten ID-Tie-Breaker gleich bleiben. Repositoryausdrücke verwenden diese Collation ausschließlich für vorhandene Textwerte; die explizite Nullsortierung und der ID-Tie-Breaker bleiben getrennte feste SQL-Bestandteile. Die Query darf nicht auf die umgebungsabhängige Datenbank-Default-Collation zurückfallen.

Die technische Voraussetzung wurde gegen die im Workspace und in den Deployment-Definitionen festgelegte Laufzeit `postgres:16-alpine` geprüft. PostgreSQL normalisiert das Locale zu `de-u-kn-ks-level2`; der transaktionale Probevergleich ergab für `2`, `10`, `A`, `a` und `ä` die Reihenfolge `2,10,A,a,ä`, und `A = a` wurde unter der Probe-Collation bestätigt. Anschließend wurde die Probe-Collation per Rollback vollständig verworfen. Eine Repository-Integration muss denselben Vertrag einschließlich Hausnummernsuffixen und fehlenden Werten absichern.

### 4. Filterung, Zählung und Pagination besitzen eine Ownership

Die Runtime bestimmt zuerst Instanz und Berechtigung. Das Repository wendet danach alle gesetzten Filter auf dieselbe Query-Grundlage an. Auf dieser gefilterten Menge werden `total`, fachliche Sortierung und erst anschließend `LIMIT`/`OFFSET` berechnet.

Tourfilterung verwendet eine parametrisierte Existenzprüfung gegen die Orts–Tour-Zuordnung. Die Anzeige verknüpfter Touren darf die Zeilenmenge nicht vervielfachen; sie wird aggregiert oder getrennt für die sichtbaren IDs geladen. Gesamtzahl und Seiteninhalt müssen denselben Filtervertrag verwenden.

### 5. Kontrollierter URL- und UI-Zustand

Die Search-Params erhalten typisierte Abholort-Sortierwerte mit `address` und `asc` als Defaults. Änderungen an Suche, Status, Region, Ort, Tour, Sortiermodus, Sortierrichtung oder Seitengröße navigieren atomar auf Seite eins. Ein reiner Seitenwechsel erhält alle übrigen Werte.

Die bisherige Einzelspalten-Sortierung der Stammdatentabelle entfällt. Die UI bietet stattdessen:

- die fachliche Standardsortierung als zusammenhängende Kriterienanzeige,
- die zugängliche Option „Region berücksichtigen“,
- einen Richtungsschalter mit den Zuständen aufsteigend und absteigend.

Desktop und schmale Ansicht erhalten dieselben Werte und Callbacks. Die Server-Response wird in beiden Darstellungen unverändert gerendert. Beschriftung, aktiver Modus und Richtung sind für Maus, Tastatur und Screenreader verständlich; Symbole sind nur ergänzend.

### 6. Auswahl bleibt ID-basiert

Ein Seitenwechsel verändert `selectedLocationIds` nicht. Beim Rendern wird ausschließlich über die ID entschieden, ob eine sichtbare Zeile ausgewählt ist. Eine neu geladene Seite darf Auswahlzustände niemals über Index oder Reihenfolge übernehmen.

„Alle gefilterten auswählen“ verwendet einen serverseitigen Resolver für alle IDs, die exakt dem aktuellen Filtervertrag entsprechen. Dieser Resolver teilt Validierung, Autorisierung und Filterkonstruktion mit der Listenprojektion, ignoriert jedoch Pagination und Sortierung. Abwählen entfernt nur die IDs des aktuellen gefilterten Bestands; bereits gewählte IDs außerhalb des Filters bleiben erhalten.

## Alternatives Considered

### Vollständigen Overview nur serverseitig vorsortieren

Diese Variante würde den bestehenden Vollbestand weiterhin übertragen und Filterung sowie Pagination im Browser belassen. Sie könnte die sichtbare Reihenfolge korrigieren, schafft aber keinen eindeutigen serverseitigen Listenvertrag für Gesamtzahl, Filter und Pagination und wurde deshalb verworfen.

### Vollständigen Bestand im Browser vor der Pagination sortieren

Dies wäre die kleinste Änderung und aufgrund des heutigen Vollbestand-Reads funktional möglich. Sie erfüllt jedoch weder die gewünschte serverseitige Allowlist noch eine belastbare Listen-Ownership und skaliert schlecht. Sie wurde deshalb verworfen.

### Frei konfigurierbare Multi-Column-Sortierung

Eine Liste beliebiger Felder und Richtungen erzeugt mehr Validierungs-, UI- und Testzustände als fachlich benötigt. Issue #1126 verlangt genau zwei feste Adressfolgen; der Vertrag bleibt darauf begrenzt.

## Risks / Trade-offs

- Der Location-Tab lädt vorerst sowohl Hierarchiedaten aus dem Overview als auch die paginierte Liste. Das ist eine bewusste, rückbaubare Übergangsgrenze; Tabellenkorrektheit hängt nicht mehr vom Overview ab.
- Die ICU-Version kann sich bei einem PostgreSQL-Imagewechsel ändern. Migration und Betriebsprüfung müssen deshalb Collation-Version-Drift sichtbar machen; die ID stabilisiert Gleichstände, ersetzt aber keinen Drift-Nachweis.
- Listen- und Auswahl-ID-Resolver könnten bei getrennten Filterimplementierungen auseinanderlaufen. Beide müssen deshalb dieselbe normalisierte Filterstruktur und dieselben Repository-Prädikate verwenden.
- Änderungen zwischen Count und Page-Read können bei zwei Queries kurzzeitig abweichen. Beide Reads sollen innerhalb desselben kurzen Read-Snapshots erfolgen oder als eine Query mit Fensterzählung umgesetzt werden.
- Die neue Standardreihenfolge verändert die bisher sichtbare Erstellungsreihenfolge. Das ist beabsichtigt und wird in UI- und Integrationstests abgesichert.

## Migration Plan

1. Typisierte Filter-, Sortier- und Page-Verträge ergänzen.
2. Repositoryprojektion, Gesamtzahl und Auswahl-ID-Auflösung implementieren und gegen PostgreSQL testen.
3. Autorisierten GET-Handler und Browser-Client ergänzen.
4. Search-Params und Abholortansicht auf die externe Sortier- und Pagination-Ownership umstellen.
5. Alte lokale Einzelspalten-Sortierung entfernen.
6. Dokumentation und Architekturabschnitte aktualisieren.

Ein Rückbau kann die Tabelle auf den bisherigen Overview zurückschalten, ohne gespeicherte Fachdaten zu migrieren. Die Collation `sva_de_numeric` wird nicht automatisch entfernt, solange andere Queries sie verwenden könnten.

## Open Questions

Keine offenen fachlichen oder technischen Fragen.
