## Context

`EventsDetailContentTab` rendert acht fachlich unterscheidbare Karten, hält
aber deren Formular- und Interaktionslogik in einer einzigen React-Funktion.
Die Datei ist funktional getestet, dennoch überschreiten sowohl die
Wurzelkomponente als auch mehrere Listencallbacks die kanonischen
Komplexitätsschwellen.

Der vorangegangene Change `refactor-shared-editor-primitives` hat
Cross-Plugin-Duplikate für Pagination, Map-Lifecycle, Media-Picker und
Media-Reference-Retry entfernt. Dieser Change baut die verbleibende
plugininterne Komponentenkomplexität ab. Er darf diese gemeinsame Ownership
nicht wieder lokal duplizieren.

Parallel definiert `add-studio-data-form-and-test-foundations` allgemeine
Formular- und Teststandards, migriert Events aber nicht als
Referenzimplementierung. Der Events-Refactor verwendet deshalb ausschließlich
bereits produktive RHF-, Studio-UI- und Vitest-Verträge und führt keine zweite
Formularbasis ein.

`EventsDetailPage` besitzt bereits den äußeren RHF-Formularrahmen, verwendet
aber aktuell keinen `zodResolver`. Die Validierung läuft nach dem RHF-Submit
über `mapEventsDetailFormValuesToInput`, `validateEventForm`, manuelle
RHF-Fehler und den bestehenden Fokus-/Tab-Pfad. Dieser Change klassifiziert
sich deshalb bewusst als interne Section-Zerlegung: `useForm`-Owner,
Resolverstatus, Validierung, Submit, Persistenz und HTTP-nahe Tests bleiben
unverändert. Der vollständige Abschluss des Foundation-Changes ist keine
Voraussetzung; eine spätere Resolver-Migration ist ein separater Scope.

## Goals / Non-Goals

### Goals

- den kritischen Wurzel-Hotspot entlang bereits sichtbarer Fachgrenzen
  beseitigen
- Field-Array-, Watch- und Callback-Ownership pro Editorbereich lokalisieren
- unverändertes Formular-, DOM-, Medien-, Karten- und Save-Verhalten durch
  bestehende und gezielt ergänzte Tests sichern
- weniger produktiven oder gleich viel produktiven Code besitzen als zuvor
- einen belastbaren Referenzschnitt für eine spätere, separat zu entscheidende
  Generic-Items-Zerlegung schaffen

### Non-Goals

- kein neues Shared-Package und kein öffentlicher UI-Vertrag
- keine Vereinheitlichung fachlich verschiedener Sections
- keine Änderung an der äußeren Detailseite oder am Submit-Controller
- keine Einführung oder Änderung eines RHF-Resolvers und keine Verlagerung von
  `validateEventForm` in den Content-Tab
- keine Optimierung ausschließlich für LOC- oder Fallow-Werte auf Kosten von
  Lesbarkeit, Typklarheit, Accessibility oder Testabdeckung

## Decisions

### 1. Der Content-Tab bleibt der einzige öffentliche Einbindungspunkt

`EventsDetailContentTab` bleibt der von der Detailseite importierte und
getestete Einstieg. Er besitzt weiterhin die bestehenden Props und komponiert
die Sections in unveränderter Reihenfolge. Neu extrahierte Module bleiben
packageintern und werden nicht über den Package-Entry-Point exportiert.

Damit ändern sich weder Plugin-Vertrag noch Call-Site. Es gibt keinen zweiten
Content-Tab und keinen Umschaltpfad zwischen alter und neuer Darstellung.

### 2. Sections werden nach fachlicher Kohäsion statt pro JSX-Karte gruppiert

Die Zerlegung verwendet wenige zusammenhängende Module:

- Beschreibung und Medien
- Termine
- Adressen und Veranstalter
- Kontakte und Links
- Preise

Eine Gruppe darf weiter geteilt werden, wenn sie andernfalls selbst einen
kritischen Hotspot erzeugt. Sie darf nicht über eine generische Section-
Registry, Feldkonfiguration oder universelle Repeater-Komponente modelliert
werden. Kleine gemeinsame Kartenrahmen bleiben nur dann lokal gemeinsam, wenn
sie bereits mehr als eine Section ohne Optionsmatrix bedienen.

Diese Gruppierung begrenzt zusätzliche Imports und Props, hält eng verwandte
Felder beieinander und vermeidet acht künstlich kleine Dateien.

### 3. Formularzustand folgt der fachlichen Ownership

Jede Section liest ihren benötigten Zustand mit dem bestehenden typisierten
`useFormContext<EventsDetailFormValues>()`. Das zugehörige `useFieldArray` und
die bereichsspezifischen Defaults, Fehlerableitungen und Callbacks liegen im
selben Modul.

Über Section-Grenzen werden keine vollständigen RHF-Controllerobjekte und
keine frei typisierten Feldnamen gereicht. Props sind auf echte äußere
Capabilities begrenzt, etwa Übersetzer, Datumseingaben, Media-Aktionen oder
Map-Fähigkeiten.

### 4. Map-Capabilities werden einmal gelesen

Adress- und Veranstalterbereich benötigen dieselben Host-Capabilities für
Geocoding, Reverse-Geocoding, Karte und Style-URL. Ein kleiner pluginlokaler
Hook kapselt den bestehenden einmaligen Config-Read, Unmount-Schutz und
Fail-closed-Fallback. Der Root ruft ihn einmal auf und reicht ein
readonly-Objekt an beide Sections.

Der Hook ersetzt den heutigen Inline-Effekt. Er dupliziert weder den zentralen
SDK-Config-Client noch den gemeinsamen Location-Map-Lifecycle und wird nicht
öffentlich exportiert.

### 5. Alte und neue Implementierung dürfen nie gemeinsam abgeschlossen sein

Die Migration erfolgt fachlicher Block für fachlichen Block. Nach grünen
gezielten Tests wird der zugehörige Inline-Block sofort gelöscht. Ein Block
darf nicht gepusht oder als abgeschlossen markiert werden, solange Wrapper,
kopierte Callbacks oder alternative Renderpfade verbleiben.

### 6. Die Löschbilanz ist ein hartes Gate

Vor der Implementierung wird die produktive Baseline für die Zieldatei mit
854 Dateizeilen und für die Wurzelfunktion mit den aktuellen Fallow-Werten
festgehalten. Nach jedem Block werden Additionen und Löschungen aller
produktiven Events-Dateien gegen `origin/main` bilanziert; Test- und
Dokumentationszeilen werden separat ausgewiesen.

Ist die produktive Bilanz positiv, wird zunächst Props-, Wrapper- oder
Datei-Overhead entfernt. Lässt sich ein Block ohne zusätzlichen
Produktionscode nicht kohärent zerlegen, wird er nicht als künstliche
Extraktion erzwungen.

## Data and Interaction Flow

1. Die bestehende Events-Detailseite stellt unverändert den RHF-Formularrahmen
   und die bisherigen Props bereit.
2. `EventsDetailContentTab` liest einmal gemeinsam benötigte Host-Capabilities
   und komponiert die fachlichen Sections.
3. Jede Section liest und mutiert ausschließlich ihre bestehenden
   `EventsDetailFormValues`-Pfade über RHF.
4. Medienaktionen bleiben an den bestehenden gemeinsamen
   `ContentMediaUsageBlock` und den äußeren Media-Controller delegiert.
5. Geo-Felder bleiben an `EventsGeoAddressFields` und den gemeinsamen
   Map-Lifecycle delegiert.
6. Submit, manuelle fachliche Validierung, Mainserver-Serialisierung und
   Navigation laufen unverändert außerhalb des Content-Tabs.

## Error, Accessibility and Security Contracts

- bestehende `errors.content.*`-Pfade und sichtbare Validierungszustände bleiben
  unverändert
- DOM-IDs, Label-Zuordnungen, Feldreihenfolge, Buttontexte, Disabled-Zustände
  und Fokusverhalten bleiben erhalten
- ein fehlgeschlagener Map-Config-Read bleibt fail-closed und erzeugt keine
  Provider- oder Secret-Ausgabe
- Medienberechtigungen und `mediaEditingDisabled` werden unverändert bis zum
  gemeinsamen Media-Block weitergegeben
- der Refactor ergänzt keine Logs, Netzwerkaufrufe oder neue Eingabegrenzen

## Testing Strategy

- Die bestehenden Tests des Content-Tabs bleiben die führende
  Characterization-Suite und testen weiterhin über den öffentlichen
  `EventsDetailContentTab`.
- Vor der jeweiligen Extraktion werden nur nachweisliche Lücken der kritischen
  Termin-, Adress-, Kontakt- und Preis-Callbacks ergänzt, insbesondere leere
  Defaults, Hinzufügen, Entfernen, Reihenfolge und bedingte Felder.
- Kleine reine Ableitungen dürfen direkt getestet werden; interne
  Section-Komponenten erhalten keine Snapshot-only-Tests.
- Nach jedem abgeschlossenen Block läuft der fokussierte Content-Tab-Test.
- Abschließend laufen `plugin-events:test:unit`, `plugin-events:test:types`,
  der betroffene Lint-Pfad sowie Fallow Health und der New-only-Audit.

## Risks / Trade-offs

- **Mehr Dateien ohne weniger Ownership:** Die fachliche Gruppierung und das
  Netto-LOC-Gate verhindern eine Datei-pro-Feld-Zerlegung.
- **Verändertes RHF-Mount-Verhalten:** Sections bleiben dauerhaft und in
  gleicher Reihenfolge gemountet; Characterization-Tests sichern Defaults und
  Field-Array-Operationen.
- **Prop-Drilling ersetzt den alten Hotspot:** Formularzustand wird über
  typisierten Form-Context gelesen; nur echte äußere Capabilities werden als
  Props gereicht.
- **Neue lokale Duplikation:** Gemeinsame SDK- und Studio-UI-Verträge bleiben
  führend; Fallow Duplication und `rg` prüfen neu kopierte Abläufe.
- **Konflikt mit der Formular-Grundlageninitiative:** Es werden keine neuen
  Formularstandards eingeführt und keine Resolver-Migration mitgezogen. Der
  reconciliierte Foundation-Plan bleibt für künftige grundlegende Änderungen
  am Events-Formular maßgeblich. Falls er vor Implementierung den äußeren
  Events-Formularvertrag übernimmt, müssen beide Pläne vor dem ersten
  Codeblock erneut reconciliiert werden.

## Migration and Rollback

Die Migration ist ein interner, verhaltensneutraler Refactor und benötigt
keine Datenmigration oder Runtime-Flag. Jeder fachliche Block ist testbar und
kann vor dem Merge einzeln zurückgenommen werden. Nach dem Merge existiert nur
der neue interne Aufbau; ein dauerhafter Legacy-Fallback ist ausdrücklich
unzulässig.

## Open Questions

Keine. Die konkrete Grenze zwischen zwei fachlich verwandten Sections darf
während der Implementierung nur angepasst werden, wenn Fallow oder die
Netto-LOC-Bilanz den geplanten Gruppenschnitt widerlegt; Scope und Verhalten
bleiben dabei unverändert.
