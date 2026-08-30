## Context

Der Change wurde gegen den Stand `c2bebfab2` neu inventarisiert. Sein
ursprünglicher Fokus auf neue Section- und Repeater-Primitives ist teilweise
überholt:

- `StudioDetailCard` und `StudioPagination` liegen bereits in
  `packages/studio-ui-react/src/studio-content-editor-primitives.tsx`.
- `StudioDetailTabs`, `StudioFormSummaryErrors`, `useStudioSaveFeedback` und
  `StudioMediaPickerOverlay` sind ebenfalls gemeinsame, produktiv genutzte
  Verträge.
- `saveContentWithHostMediaReferences` und die hostseitigen
  Media-Content-Save-Kommandos liegen bereits in `@sva/plugin-sdk`.

Die Restschuld liegt zwischen diesen Bausteinen. Fallow und die direkte
Codeinventur zeigen vier konkrete Clone-Familien:

| Familie                    | Heutige Consumer                                               | Heutiger Zustand                                                                   |
| -------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| List-Search-Normalisierung | Events, Generic Items, POI, Projects; ungenutzte Kopie in News | fünf identische Dateien mit denselben Limits und Defaults                          |
| Map-/Geocoding-Lifecycle   | Events, Generic Items, POI                                     | identische Client-Cache-, Coordinate-, Map-, Marker- und Cleanup-Abläufe           |
| Media-Picker-Konfiguration | Events, Generic Items, News, POI                               | nahezu identische Label- und technische Feedback-Funktionen                        |
| Media-Save/Reference-Retry | Events, Generic Items, News, POI, Projects, Cockpit Cards      | wiederholte Zustände, Statusabbildung und Inline-Retry-UI um denselben SDK-Vertrag |

Zu den aktuellen Fallow-Baseline-Fingerprints gehören insbesondere
`dup:e8ff6dcc`, `dup:2a61a9ec`, `dup:1e2236db`, `dup:7a93eca0`,
`dup:0d62f1bd`, `dup:ec8131b5`, `dup:378bd117`, `dup:6c623e91` und
`dup:4a4d3882`. Fingerprints sind Analyse-IDs und können sich bei
Zwischenänderungen verschieben; führend bleiben deshalb zusätzlich die
benannten Dateien und Verantwortungen.

## Goals / Non-Goals

### Goals

- technische Content-Editor-Abläufe genau einmal besitzen
- große Editor-Komponenten von wiederholter technischer Orchestrierung
  entlasten
- alle benannten Altimplementierungen nach erfolgreicher Migration löschen
- unveränderte Fach-, Save-, Fehler-, i18n- und Accessibility-Verträge durch
  Characterization-Tests sichern
- über den gesamten produktiven Zielscope mindestens eine neutrale, möglichst
  negative Netto-LOC-Bilanz erreichen

### Non-Goals

- keine gemeinsame fachliche Editor-Datenstruktur
- keine Vereinheitlichung von Zod-Schemas, RHF-Feldpfaden oder Mainserver-
  Payloads
- keine neue Plugin-Laufzeit oder dynamische Editor-Registry
- keine Änderung am serverseitigen Medienlebenszyklus
- keine künstliche Konfiguration, um noch nicht existierende Consumer
  vorwegzunehmen
- kein reines Verschieben großer Funktionen ohne reduzierte Caller- und
  Ownership-Fläche

## Ownership Decisions

### 1. `@sva/plugin-sdk` besitzt frameworkfreie Plugin-Clientverträge

Frameworkfreie Normalisierung und bestehende hostkontrollierte Clientaufrufe
gehören in `@sva/plugin-sdk`. Dazu zählen:

- der kanonische List-Search-Vertrag mit erlaubten Seitengrößen, Default und
  maximalem Offset
- der einmalige, fehlerbereinigte Cache für die bestehende hostseitige
  Map-/Geocoding-Konfiguration
- bestehende Media-Persistence- und Content-Save-Verträge

`plugin-sdk` erhält dadurch keine React-Abhängigkeit. Providerdetails, Secrets
und Hostkonfiguration bleiben hinter den vorhandenen HTTP-Verträgen verborgen.

### 2. `@sva/studio-ui-react` besitzt React- und Darstellungsorchestrierung

React-spezifische, fachneutrale Zustände und Darstellung gehören nach
`@sva/studio-ui-react`:

- ein strukturell typisierter Location-Map-Lifecycle für Container, Map,
  Marker, Viewport, Click, Drag, Fehler und Cleanup
- gemeinsame Media-Picker-Labels und technische Feedback-Abbildung für den
  bereits gemeinsamen Overlay-Vertrag
- ein kleiner Media-Save-/Reference-Retry-Controller einschließlich
  technischem Retry-Status und wiederverwendbarer Retry-Aktion

Der Map-Vertrag arbeitet gegen die kleinste von den drei realen Consumern
benötigte Runtime-Schnittstelle. Er zieht keine zweite Map-Bibliothek und keine
Providerlogik in `studio-ui-react`.

Der Media-Save-Controller nimmt fachliche Callbacks und das vorhandene
SDK-Ergebnis entgegen. Er entscheidet nicht über Content-Payload,
`targetType`, Navigation, Permissions oder pluginlokale Texte.

`studio-ui-react` darf dafür einseitig vom schmalen öffentlichen Subpath
`@sva/plugin-sdk/content-media` abhängen. Dieser Subpath exponiert nur die für
Content-Media-Save und Reference-Sync benötigten öffentlichen Typen und
frameworkfreien Verträge. Der React-Controller darf diese kanonischen SDK-Typen
direkt verwenden, damit kein strukturell nachgebauter Parallelvertrag driftet.
Persistenzoperationen werden ihm jedoch als Callbacks injiziert; er importiert
oder startet keine Host-I/O-Kommandos selbst.

Die Abhängigkeitsrichtung bleibt strikt einseitig:
`studio-ui-react` → `plugin-sdk`. `plugin-sdk` erhält weder eine React- noch eine
`studio-ui-react`-Abhängigkeit. Die bestehende Nx-`depConstraint` für
`scope:studio-ui-react` wird ausschließlich um `scope:plugin-sdk` erweitert;
weitere SDK-, Runtime- oder Host-Packages bleiben unzulässig. Ein gezielter
Import-Guard begrenzt diese auf Scope-Ebene notwendige Freigabe innerhalb von
`studio-ui-react` auf `@sva/plugin-sdk/content-media` und verbietet Importe aus
dem SDK-Root oder anderen SDK-Subpaths.

### 3. Plugins behalten die fachliche Verantwortung

In den Plugins verbleiben:

- Feldmodelle, RHF-Namenspfade, Defaultwerte und Zod-Schemas
- Mainserver-Mapping, Deviation-Handling und Mutationserzeugung
- Permission- und Principal-Entscheidungen
- pluginlokale Labels und fachliche Fehlermeldungen
- Create-/Edit-Navigation und Sonderfälle wie der News-Retry nach bereits
  angelegtem Inhalt
- Layout, das nur in einem Plugin vorkommt

## Debt-Reduction Rules

### Same-block deletion

Jeder Migrationsblock besteht aus vier untrennbaren Schritten:

1. bestehendes Verhalten charakterisieren,
2. gemeinsamen Vertrag implementieren,
3. alle für diesen Block benannten Consumer umstellen,
4. lokale Dateien, Exporte, Hooks, Zustände und Tests des Altpfads löschen.

Ein Block darf nicht als abgeschlossen markiert werden, solange alte und neue
Implementierung parallel existieren. Temporäre Wrapper sind nur innerhalb
eines unvollständigen lokalen Commitblocks zulässig und müssen vor Push des
Blocks entfernt sein.

### Net reduction

Für jeden Block und für den Gesamtchange wird eine Löschbilanz geführt:

- produktive hinzugefügte und entfernte TypeScript-/TSX-Zeilen
- hinzugefügte und entfernte Dateien
- entfernte lokale Exporte und Consumer
- Fallow-Clone-Familien vor und nach dem Block

Tests und Dokumentation werden separat ausgewiesen. Der produktive Zielscope
darf insgesamt netto nicht wachsen. Wenn ein Block mehr gemeinsamen
Produktivcode erzeugt als lokalen Code entfernt, wird er verkleinert oder
verworfen; zusätzliche Optionen oder Abstraktionsschichten sind kein
akzeptabler Ausgleich.

### No metric-only refactoring

Eine gesunkene Komplexitäts- oder Duplikationszahl genügt nicht. Reviews
prüfen zusätzlich, dass:

- Caller weniger technische Zustände selbst koordinieren,
- dieselbe Änderung künftig weniger Dateien berührt,
- Fehler- und Retry-Semantik erhalten bleibt,
- keine indirekte generische API die lokale Fachlogik schwerer lesbar macht.

## Migration Slices

### Slice 0: Iststand reconciliieren

- bereits vorhandene gemeinsame Primitives als Baseline dokumentieren
- alte Aufgaben zum erneuten Erstellen von `StudioDetailCard`, Pagination,
  Formular-Bridge oder Media-Picker entfernen
- Clone-Inventur und produktive LOC-Baseline erfassen

### Slice 1: Frameworkfreie Kleinduplikate

- List-Search-Normalisierung nach `plugin-sdk` verschieben
- vier reale Consumer umstellen und alle fünf lokalen Implementierungen samt
  redundanter Tests löschen; die News-Datei ist ungenutzter Bestand und wird
  ohne künstlichen Consumer entfernt
- Map-/Geocoding-Konfigurationscache in den bestehenden SDK-Client verlagern
- drei pluginlokale Client-Wrapper löschen; pluginlokale Alias-Funktionen nur
  behalten, wenn sie echte fachliche Semantik ergänzen

### Slice 2: Gemeinsamer Location-Map-Lifecycle

- Events und Generic Items als erste zwei Consumer charakterisieren und auf
  den gemeinsamen Hook umstellen
- POI im selben Slice migrieren, sobald die Zweitnutzung den Vertrag bestätigt
- ersetzte `*.location-map.hook.ts`, `*.location-map.effects.ts` und
  `*.location-map.shared.ts` löschen
- Runtime-Loader nur konsolidieren, wenn alle drei Varianten tatsächlich
  denselben Browser- und Bundling-Vertrag besitzen

### Slice 3: Media-Picker-Konfiguration

- identische Labelstruktur und technisches Fehler-/Phasenfeedback gemeinsam
  abbilden
- Events und Generic Items als Referenzconsumer, anschließend News und POI
  migrieren
- lokale `create*MediaPickerLabels`- und
  `resolve*MediaPickerFeedback`-Funktionen entfernen

### Slice 4: Media-Save und Reference-Retry

- bestehende Zustandsübergänge in Events und Generic Items charakterisieren
- gemeinsamen technischen Controller gegen den bestehenden
  `saveContentWithHostMediaReferences`-Vertrag einführen
- danach News, POI, Projects und Cockpit Cards vollständig migrieren
- lokale `retryReferenceSync`-Orchestrierung, wiederholte
  `referenceStatus`-Abbildung und Inline-Retry-Aktionen entfernen
- pluginlokale Create-Navigation und fachliche Statusmeldungen über explizite
  Callbacks erhalten

## State and Error Contracts

### Map/Geocoding

- Ein fehlgeschlagener Config-Read wird nicht dauerhaft gecacht; ein späterer
  Read darf erneut versuchen.
- Fehlende oder ungültige Koordinaten entfernen den Marker und verwenden den
  bestehenden Default-Viewport.
- Map- und Marker-Ressourcen werden beim Unmount genau einmal entfernt.
- Providerdetails, vollständige Suchanfragen und Secrets bleiben außerhalb
  der UI- und Pluginzustände.

### Media save and reference retry

- Ein normaler Submit läuft weiterhin über den bestehenden RHF-/Zod-
  `handleSubmit`-Pfad des Plugins.
- Ist der Content bereits gespeichert und nur die Referenzsynchronisation
  fehlgeschlagen, wiederholt der Reference-Retry ausschließlich die
  Referenzoperation und niemals die Content-Mutation.
- Ein partieller Referenzfehler bleibt sichtbar und hält die betroffenen
  Verwendungen auf `referenceStatus: 'failed'`.
- Nach erfolgreichem Retry werden nur betroffene Referenzen auf `synced`
  gesetzt; Navigation und Success-Feedback bleiben beim Plugin.
- Erneute normale Saves bleiben idempotent an den bestehenden
  Content-Media-Save-Vertrag gebunden.

## Testing Strategy

- Characterization-Tests werden vor jeder Extraktion aus den vorhandenen
  Consumer-Tests abgeleitet.
- `plugin-sdk` testet List-Search-Grenzen, Cache-Deduplizierung, Cache-Reset
  nach Fehlern und unveränderte HTTP-Verträge.
- `studio-ui-react` testet Map-Aufbau/-Cleanup, Marker-Drag, Viewport-Updates,
  technische Media-Picker-Abbildung sowie alle Media-Save-/Retry-Übergänge.
- Plugin-Tests prüfen nur noch fachliche Adapter, Texte, Payloads, Navigation
  und Sonderfälle; sie mocken nicht den gemeinsamen Controller intern aus.
- Mindestens ein Integrationstest beweist pro Slice, dass zwei reale Consumer
  denselben öffentlichen Vertrag verwenden.

## Risks / Trade-offs

- Eine zu breite Controller-API könnte lediglich lokale Komplexität in eine
  generische Optionsstruktur verschieben.
  - Mitigation: nur Parameter aufnehmen, die von mindestens zwei aktuellen
    Consumern verschieden belegt werden.
- Die neue Package-Kante könnte `studio-ui-react` schleichend an weitere
  Host-Verträge koppeln.
  - Mitigation: ausschließlich den öffentlichen Content-Media-Subpath zulassen,
    die Einschränkung mit einem Import-Guard absichern, Host-I/O als Callback
    injizieren und die Nx-Boundary nicht für weitere Package-Scopes öffnen.
- Eine gemeinsame Map-Runtime kann Bundler- oder Browserunterschiede verdecken.
  - Mitigation: zuerst strukturellen Vertrag und bestehende Loader vergleichen;
    bei echtem Unterschied Loader pluginlokal lassen.
- Der News-Create-Retry besitzt zusätzliche Navigation nach bereits
  gespeichertem Inhalt.
  - Mitigation: technische Reference-Retry-Transition teilen, Navigation als
    expliziten News-Callback behalten.
- Parallele Migrationen könnten wieder Zwischenwrapper hinterlassen.
  - Mitigation: Slices sequenziell abschließen und Löschbilanz vor dem nächsten
    Slice prüfen.

## Rejected Alternatives

- Vollständig generisches, schema-basiertes Editor-Framework: zu viel neue
  Ownership und keine belegte Notwendigkeit.
- Nur Section-/Repeater-Komponenten ergänzen: erzeugt neuen Code, lässt aber
  die größeren duplizierten Lifecycles bestehen.
- Alle Editor-Seiten sofort auf einen gemeinsamen Controller umstellen: zu
  hoher Blast Radius ohne schrittweise Vertragsvalidierung.
- Bestehende Kopien als Wrapper um neue Helfer behalten: reduziert weder
  Callerfläche noch Ownership und ist deshalb nicht abnahmefähig.

## Completion Evidence

Der Change ist erst abnahmefähig, wenn:

1. alle vier Clone-Familien für sämtliche benannten Consumer migriert sind,
2. sämtliche ersetzten lokalen Implementierungen gelöscht sind,
3. die produktive Netto-LOC-Bilanz im Zielscope höchstens null beträgt,
4. die fokussierten Unit-, Type-, Lint- und Boundary-Gates grün sind,
5. Fallow keine der erfassten Clone-Familien oder gleichwertige neue Kopie im
   Zielscope meldet und
6. Dokumentation und OpenSpec den tatsächlichen Endzustand abbilden.
