# Design: Einheitlicher Einstiegspunkt für Inhalte

## Kontext

Heute existieren mit `News`, `Events` und `POI` mehrere getrennte redaktionelle Einstiege mit jeweils eigener Listenansicht. Das erzeugt vermeidbare Navigationskosten, unterschiedliche Listenmuster und keine kanonische Sicht auf alle redaktionellen Inhalte.

Ziel ist ein einheitlicher Einstiegspunkt unter `/admin/content`, der als einzige Übersicht für redaktionelle Inhalte dient. Die bisherigen Listenrouten `/admin/news`, `/admin/events` und `/admin/poi` entfallen vollständig. Erstellungs- und Bearbeitungsseiten bleiben zunächst typspezifisch, werden aber aus dem gemeinsamen Host-Einstieg heraus angesteuert.

## Ziele

- `/admin/content` ist die einzige redaktionelle Übersichtsseite für Inhalte.
- Die gemeinsame Tabelle zeigt nur einen belastbaren gemeinsamen Spaltensatz:
  - `Typ`
  - `Titel/Name`
  - `Status`
  - `Zuletzt geändert`
- `Neuer Inhalt` führt auf eine generische Typauswahlseite mit Kacheln.
- Die Typauswahl zeigt ausschließlich Inhaltstypen, die der aktuelle Nutzer tatsächlich anlegen darf.
- Erstellen und Bearbeiten bleiben typspezifisch, starten aber aus dem gemeinsamen Host-Flow.
- Rechte, Sortierung, Filterung und Pagination werden zentral und sauber gelöst.
- Neue Inhaltstypen sollen künftig über einen SDK-Vertrag registrierbar sein.

## Nicht-Ziele

- Keine Vereinheitlichung der eigentlichen Formulare für `News`, `Events` und `POI` in diesem Schritt.
- Keine deaktivierten Typ-Kacheln mit Begründung im Typ-Picker.
- Keine clientseitige Aggregation mehrerer Listen-Endpoints.
- Keine Legacy-Listenrouten als Redirects oder Schattennavigation.

## Zielbild UX

### 1. Übersicht

`/admin/content` ist die kanonische Inhaltsübersicht.

Die Seite besteht aus:

1. Breadcrumbs
2. `H1` `Inhalte`
3. kurzer Beschreibung
4. Primäraktion `Neuer Inhalt`
5. gemeinsamer Tabelle
6. serverseitig gesteuerter Pagination

Die Tabelle verwendet einen kleinen, typübergreifend belastbaren Spaltensatz:

- `Typ`
- `Titel/Name`
- `Status`
- `Zuletzt geändert`
- `Aktionen`

### 2. Neuer Inhalt

`Neuer Inhalt` führt auf eine eigenständige Host-Seite, zum Beispiel `/admin/content/new`.

Diese Seite zeigt Inhaltstypen als Kacheln. Jede Kachel enthält mindestens:

- Anzeigename
- kurze Beschreibung
- visuelle Kennung oder Icon

Nur Typen mit effektivem Create-Zugriff werden gerendert.

### 3. Erstellen

Nach Auswahl eines Typs navigiert der Host in die typspezifische Erstellungsseite, zum Beispiel:

- `News`
- `Events`
- `POI`

Die Erstellungsseite folgt dem bereits definierten Standardmuster der fokussierten Erstellungs-/Bearbeitungsseite.

### 4. Bearbeiten

Die gemeinsame Inhaltsliste öffnet für jeden Datensatz die typspezifische Bearbeitungsseite. Die Bearbeitung bleibt fachlich getrennt, aber der Einstieg ist vereinheitlicht.

## Routing

### Kanonische Host-Routen

- `/admin/content`
- `/admin/content/new`

### Typspezifische Routen bleiben bestehen für Create/Edit

- Create-Routen bleiben typbezogen
- Edit-Routen bleiben typbezogen

### Entfallende Listenrouten

Die bisherigen Übersichtslisten entfallen vollständig:

- `/admin/news`
- `/admin/events`
- `/admin/poi`

Diese Routen werden nicht als alternative UI-Einstiege beibehalten.

## Rechte- und Sichtbarkeitsmodell

### Übersicht

Die gemeinsame Liste zeigt nur Datensätze, für die der aktuelle Nutzer effektiven Read-Zugriff auf den jeweiligen Typ besitzt.

Beispiele:

- `news.read`
- `events.read`
- `poi.read`

Die Rechteprüfung erfolgt zentral im Host-konformen Aggregationspfad, nicht durch nachgelagerte clientseitige Ausblendung.

### Typ-Picker

Die Typauswahl zeigt nur Typen, für die der Nutzer effektiv Erstellungszugriff besitzt.

Beispiele:

- `news.create`
- `events.create`
- `poi.create`

Wenn kein Inhaltstyp anlegbar ist, zeigt `/admin/content/new` einen expliziten leeren Zustand statt deaktivierter Kacheln.

## Sortierung, Filterung und Pagination

### Grundsatz

Sortierung, Filterung und Pagination werden serverseitig auf einem gemeinsamen Listenmodell ausgeführt. Clientseitiges Mergen getrennter Listenquellen ist ausgeschlossen.

### Mindestfilter

Für den ersten Schritt werden mindestens vorgesehen:

- freie Suche
- Typfilter
- Statusfilter

Zusätzliche Filter werden erst ergänzt, wenn sie typübergreifend semantisch stabil formulierbar sind.

### Sortierung

Die erste Version unterstützt nur Sortierung auf gemeinsamen, verlässlichen Feldern:

- `Typ`
- `Titel/Name`
- `Status`
- `Zuletzt geändert`

Die Sortiersemantik wird zentral definiert und gilt für alle Inhaltstypen gleich.

### Pagination

Pagination erfolgt auf dem aggregierten Gesamtergebnis, nicht auf typweise vorgeladenen Teilmengen. Dadurch bleiben Seitenzahl, Trefferzahl und Sortierung konsistent.

## Host-owned Aggregationsmodell

Die gemeinsame Inhaltsübersicht wird als host-owned Aggregationsseite modelliert. Der Host bleibt verantwortlich für:

- Seitenroute `/admin/content`
- Typauswahlroute `/admin/content/new`
- Sammelabfrage für die Inhaltsliste
- globale Rechteprüfung
- globale Sortierung
- globale Filterung
- globale Pagination
- finale Tabellenkomposition

Plugins liefern keinen eigenen alternativen Übersichtseinstieg mehr aus.

## Gemeinsames Listenmodell

Der Host arbeitet intern mit einem typübergreifenden Listenmodell für Inhalte. Dieses Modell enthält mindestens:

- `typeId`
- `itemId`
- `displayTitle`
- `status`
- `updatedAt`
- `readRoute`
- optional weitere technische Felder für Sortierung und Diagnose

Das Listenmodell ist ein Host-Vertrag. Plugins liefern die Daten dafür nicht als UI, sondern über definierte Metadaten und Adapter.

## SDK-Exposition und Plugin-Registrierung

### Grundsatz

Inhaltstypen werden nicht hart im Host codiert, sondern über einen öffentlichen SDK-Vertrag registriert. Der Host materialisiert daraus Picker, Routing-Ziele und Aggregationsmetadaten.

### Plugin-Vertrag

Jedes Content-Plugin kann einen oder mehrere Inhaltstypen über einen Descriptor registrieren.

Ein Descriptor enthält mindestens:

- `typeId`
- Anzeigename
- Kurzbeschreibung
- Icon oder visuelle Kennung
- `requiredReadAction`
- `requiredCreateAction`
- Create-Route
- Edit-Route
- Adapter in das gemeinsame Listenmodell

### Verantwortungsgrenzen

Plugins registrieren:

- Metadaten für den Typ
- Rechtekennungen
- typspezifische Zielrouten
- engen Listen-Adapter-Vertrag

Der Host bleibt Eigentümer von:

- `/admin/content`
- `/admin/content/new`
- Darstellung des Typ-Pickers
- Darstellung der gemeinsamen Tabelle
- globalen Query-Parametern
- Rechteauswertung im UI
- globaler Filterung, Sortierung und Pagination

### Empfohlene SDK-Form

Der SDK-Vertrag soll explizit und eng sein, zum Beispiel über:

- `ContentTypeDefinition`
- `defineContentTypes(...)`
- `contentListAdapter`

Der Vertrag ist additiv erweiterbar, ohne dass Plugins direkte App-Imports oder Host-Komponenten kennen müssen.

## Empfohlene technische Variante

Es gibt zwei mögliche Host/Plugin-Schnitte:

1. Plugins liefern nur Metadaten, Host kennt alle Aggregationsqueries selbst.
2. Plugins liefern zusätzlich einen kleinen Listen-Adapter-Vertrag.

Empfohlen wird Variante 2 mit engem Vertrag.

Begründung:

- Der Host bleibt generisch.
- Neue Typen können additiv registriert werden.
- Typwissen wird nicht unnötig zentral im Host dupliziert.
- Der Vertrag bleibt schmal genug, um UX- und Query-Hoheit beim Host zu halten.

## Migration

### Phase 1

- gemeinsame Inhaltsübersicht unter `/admin/content`
- Typ-Picker unter `/admin/content/new`
- News, Events und POI registrieren ihre Inhaltstypen im neuen SDK-Vertrag
- Listenseiten `/admin/news`, `/admin/events`, `/admin/poi` entfallen
- bestehende Create-/Edit-Seiten bleiben erhalten

### Phase 2

- weitere Inhaltstypen können denselben Vertrag nutzen
- gemeinsame Host-Muster für Create-/Edit-Einstiege können schrittweise weiter vereinheitlicht werden

## Risiken

### Rechte

Wenn die Rechteprüfung nicht zentral und typgenau modelliert wird, entsteht leicht eine inkonsistente Sichtbarkeit zwischen Picker, Liste und Edit-Routen.

### Sortierung und Pagination

Eine unklare Aggregationsquelle oder spätes clientseitiges Merging würde globale Sortierung und Pagination unzuverlässig machen.

### SDK-Vertrag

Ein zu breiter Plugin-Vertrag würde Host-Verantwortung verwässern. Ein zu enger Vertrag würde neue Inhaltstypen unnötig hostseitig verdrahten.

## Testfolgen

Es werden mindestens benötigt:

- Unit-Tests für Typ-Registry und Adapter-Vertrag
- Unit-Tests für Rechtefilterung pro Inhaltstyp
- Unit-Tests für Sortierung, Filterung und Pagination des gemeinsamen Listenmodells
- Routing-Tests für `/admin/content` und `/admin/content/new`
- UI-Tests für Typ-Picker-Sichtbarkeit je nach Rechten
- UI-Tests für Navigation in die typspezifischen Create-/Edit-Seiten
- Regressionstests dafür, dass die alten Listenrouten nicht mehr als aktive Einstiege verwendet werden

## Umsetzungsentscheidung

Die gemeinsame Inhaltsverwaltung wird als host-owned Aggregationslösung umgesetzt. Die Inhaltsübersicht wird zentralisiert, die Typauswahl wird generisch über registrierte Inhaltstypen aufgebaut, und Create/Edit bleiben zunächst typspezifische Fachseiten hinter einem gemeinsamen Einstieg.
