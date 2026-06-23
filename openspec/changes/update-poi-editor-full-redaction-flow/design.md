## Context

Der POI-Editor ist fachlich ein spezieller Content-Editor, technisch aber ein Mainserver-gebundener Spezialfall. Das vorhandene Plugin `@sva/plugin-poi` nutzt bereits den typed Mainserver-CRUD-Pfad, bildet jedoch nur einen kleinen Ausschnitt des GraphQL-Vertrags in der Formular-UI ab.

Für Redakteure ist das aktuelle Verhalten zu datenarm und in der Reihenfolge nicht ausreichend aufgabenzentriert. Gleichzeitig ist der Mainserver-Vertrag breiter als der heutige Studio-Adapter: Adressen mit Geo-Koordinaten, Kontakt mit Fax und Kontakt-Weblinks, Betreiber, Preise, Öffnungszeiten, Medien, Zertifikate und Accessibility-Felder sind technisch vorhanden, werden aber im Studio nur teilweise oder gar nicht geführt.

Der Change wird bewusst als ein zusammenhängender, fachlich sichtbarer Redaktions-Change umgesetzt und nicht als Kette kleiner Einzelmaßnahmen.

Zusätzlich betrifft der Change nicht nur das reine POI-Datenmodell, sondern auch die Herkunft von Geo-Koordinaten. Redakteure sollen Koordinaten nicht primär als numerische Werte pflegen, sondern über Karteninteraktion und Adresssuche erzeugen. Dafür wird zunächst ein externer Geocoding-/Autocomplete-Provider genutzt, der tenant-owned über bestehende Host-Interfaces konfiguriert wird; später soll derselbe Interface-Typ auf einen eigenen Nominatim-Dienst umgestellt werden.

## Aktueller Implementierungszuschnitt

Der Arbeitsstand im Repository hat für diesen Change bereits mehrere Grundlage-Slices angebahnt oder teilweise ausgeliefert. Dieses Design dokumentiert daher nicht nur das Zielbild, sondern den reviewbaren Scope des bereits angelieferten Zuschnitts:

- erweitertes POI-Formmodell mit zusätzlichen strukturierten Feldgruppen
- hostseitiger POI-Write-Pfad mit deutlich breiterem typed Vertragszuschnitt
- Multi-Tab-Editor für den redaktionsorientierten Detailflow
- `mapGeocoding` als tenant-owned Interface-Typ im Host-/Studio-Zuschnitt
- providerneutrale Geocoding-Typen im `plugin-sdk`
- hostseitige Serverfunktionen für Suche, Geocoding und Reverse-Geocoding

Die Delivery wurde bewusst so abgeschlossen, dass der fachliche Voll-Flow und die Host-/Vertragsseite vollständig funktionsfähig sind. Eine weitergehende Extraktion generischer Abschnitts-, Repeater- und Formularprimitives nach `packages/studio-ui-react` bleibt als spätere Verbesserungsarbeit explizit offen und ist nicht stillschweigend Teil des abgeschlossenen Scope.

OpenSpec-Artefakte für Proposal, Design, Tasks und Delta-Specs müssen diesen Implementierungszuschnitt in derselben Delivery-Reihenfolge spiegeln, statt eine ältere Vorstufe des Changes zu beschreiben.

## Goals / Non-Goals

- Goals:
  - Ein vollständiger, redaktionsorientierter POI-Editor für Erstellen und Bearbeiten in einem durchgehenden Change
  - Deckung der relevanten POI-Felder des Mainserver-Vertrags im Studio-Editor
  - Konsistente, wiederholbare GUI-Muster für Links, Öffnungszeiten, Preise und Dateien
  - Kartenbasierte POI-Ortspflege mit Geo-Koordinaten und explizitem Kartenstil
  - Trennung von Kern-Redaktionsdaten und erweiterten Spezialdaten
  - Klarer Erstnutzer- und Wiederkehrer-Flow ohne JSON-zentrierte Bedienung
  - Frühe Begrenzung von Code-Komplexität und früh mitwachsende Testabdeckung in jedem Delivery-Slice
- Non-Goals:
  - Kein zweiter separater Schnell- oder Assistenten-Editor
  - Keine generische Überarbeitung aller Content-Plugins in demselben Change
  - Keine neue direkte Browser-zu-GraphQL-Kommunikation
  - Keine Entkopplung vom bestehenden typed Mainserver-Adaptermodell

## Decisions

- Decision: Der POI-Editor wird als aufgabenorientierter Mehrbereichs-Editor modelliert, nicht als reine Spiegelung des GraphQL-Datenmodells.
  - Rationale: Redakteure denken in Aufgabenfolgen wie „Was ist der POI?“, „Wo ist er?“, „Wie erreicht man ihn?“, „Wann ist er offen?“ statt in technischen Input-Objekten.

- Decision: `Create` und `Edit` nutzen denselben Editor, aber mit unterschiedlichem Fokus.
  - Rationale: Ein separater Erstellungsflow würde doppelten Pflege- und Testaufwand erzeugen. Stattdessen wird die gleiche Oberfläche im Erstellungsfall mit Minimaldatenfokus und im Bearbeitungsfall mit Nachpflegefokus genutzt.

- Decision: Der Editor wird in folgende Hauptsektionen gegliedert:
  - `Basis`
  - `Ort`
  - `Beschreibung`
  - `Kontakt`
  - `Öffnungszeiten`
  - `Links`
  - `Betreiber`
  - `Preise`
  - `Medien & Dateien`
  - `Erweiterte Daten`
  - `Historie`
  - Rationale: Diese Gliederung folgt der Redaktionslogik statt der heutigen technisch geprägten Reduktion auf `Basis`, `Inhalt`, `Einstellungen`, `Historie`.

- Decision: Ortsdaten werden mit Karte und expliziten Geo-Koordinaten geführt.
  - Rationale: Für POI ist räumliche Korrektheit fachlich zentral. Ein reiner Textadresspfad ist für Redakteure fehleranfälliger als eine visuelle Kartenpflege.
  - Kartenstil: `https://tileserver-gl.smart-village.app/styles/osm-bright/`

- Decision: Die Karte ist die führende Eingabe für Geo-Koordinaten.
  - Rationale: Redakteure sollen keine Primäreingabe über rohe Zahlenwerte vornehmen müssen.
  - Konsequenz: `latitude`/`longitude` bleiben sichtbar und editierbar, aber die primären Interaktionen sind Marker setzen, Marker verschieben und Suchtreffer auf der Karte übernehmen.

- Decision: Die Adresssuche wird initial über Geoapify und später über einen eigenen Nominatim-Dienst angebunden.
  - Rationale: Geoapify bietet produktionsnahe Autocomplete-, Geocoding- und Reverse-Geocoding-Pfade für den ersten Rollout. Gleichzeitig soll kein UI- oder Formvertrag auf einen einzelnen Provider hart verdrahtet werden.
  - Geplantes Modell: Tenant-owned Interface-Vertrag mit austauschbarem Provider-Backend und tenant-spezifischer Konfigurationsverantwortung.
  - Quellen:
    - Geoapify Address Autocomplete und Geocoding sind explizit für adressbasierte Vorschläge und Koordinatenermittlung dokumentiert.
    - Nominatim unterstützt freie und strukturierte Suche sowie Reverse-Geocoding; die öffentliche OSMF-Instanz unterliegt aber einer separaten Usage Policy, die nicht für einen selbst betriebenen Dienst gilt.

- Decision: Karten- und Geocoding-Fähigkeiten werden tenant-owned über bestehende Host-Interfaces konfiguriert.
  - Rationale: Andere externe Schnittstellen werden bereits tenant-owned über Interfaces konfiguriert. Der POI-Editor soll diesem Muster folgen, damit Providerwahl, Kartenstil, Secret-Referenz, Laufzeitgrenzen und Kill-Switches nicht in Plugin- oder Browserlogik ausfransen.
  - Konsequenz:
    - Das POI-Plugin konsumiert nur normierte Fähigkeiten für Karte, Adresssuche, Geocoding und Reverse-Geocoding.
    - Provider-spezifische Konfiguration und Secret-Auflösung liegen im Tenant-Interface und dessen hostseitiger Implementierung.
    - Ein späterer Providerwechsel darf den Editor-Vertrag nicht verändern.

- Decision: Wiederholbare Felder werden durchgängig als Listen-Editoren modelliert.
  - Rationale: Öffnungszeiten, Links, Preise und Dateien sind redaktionell Mehrfacheinträge. Die heutige Beschränkung auf den ersten Eintrag führt zu Datenverlust oder Workarounds.

- Decision: Erweiterte Felder wie `payload`, Zertifikate und Accessibility werden aus dem Kernflow herausgezogen.
  - Rationale: Diese Daten sind wichtig, aber nicht die Standard-Reihenfolge für Erstpflege. Sie bleiben erreichbar, überladen aber nicht den Hauptflow.

- Decision: Der hostseitige POI-Route-Adapter wird auf vollständige Studio-relevante Feldweiterleitung erweitert.
  - Rationale: Ein UI-Ausbau ohne vollständige Adapter-Anbindung würde einen nur scheinbar vollständigen Editor erzeugen.

- Decision: Komplexitäts- und Testdisziplin gelten ab dem ersten Slice als Architekturregel dieses Changes.
  - Rationale: Ein großer fachlicher Change kippt sonst leicht in späte Stabilisierung, große Sammelkomponenten und nachgezogene Testschuld.
  - Konsequenz:
    - neue Logik wird entlang klarer Verantwortungen geschnitten
    - Mapping, Parsing, Geocoding und Listen-Editor-Verhalten werden separat testbar gehalten
    - Testabdeckung wächst pro Slice mit und wird nicht auf einen Abschlusssprint verschoben

## Shared vs. Plugin-Specific Ownership

### Im `plugin-poi` verbleibend

- POI-spezifisches Formmodell, Defaulting und Feld-Mapping zwischen UI und typed Mainserver-Input
- POI-spezifische Validierung und fachliche Pflichtregeln
- Sektionen und Teilobjekte, die fachlich klar POI-domänenspezifisch sind:
  - Betreiber
  - Preise
  - Öffnungszeiten
  - POI-Kontakt
  - POI-Ort inklusive Adresszuschnitt für POI
- Geschäftsregeln für die Übernahme normierter Geocoding-Ergebnisse in POI-Felder
- POI-spezifische Übersetzungen, Labels und Fehlermeldungen

### In `studio-ui-react` zu bündeln oder dorthin zu extrahieren

- Gemeinsame Detail-Editor-Orchestrierung auf Basis von `studio-detail-tabs.tsx`, statt POI-seitig erneut `Tabs` direkt zu verdrahten
- Eine generische Abschnittskarte analog zu `packages/plugin-news/src/news.detail-card.tsx`, aber als gemeinsame Studio-Komponente
- Kleine wiederverwendbare Listen-/Repeater-Primitives für strukturierte Mehrfacheinträge, sofern sie mindestens für POI und einen zweiten Content-Typ tragfähig sind
- Gemeinsame Formular-Hilfen aufbauend auf `studio-form-bridge.tsx`, insbesondere für Fehlerzusammenfassungen und standardisierte Feldbindungen
- React-UI-Bausteine für adress- und kartenbezogene Eingaben, wenn deren Verantwortung nicht POI-spezifisch ist:
  - `StudioLocationMapField`
  - `StudioGeocodingSearchField`
  - `StudioAddressFields`
  - `StudioCoordinateFields`

### In tenant-owned Host-Interfaces zu verorten

- Provider-neutrale Fähigkeiten für Karte, Suggestions, Geocoding und Reverse-Geocoding
- Tenant-spezifische Konfiguration für aktiven Provider, Kartenstil, Secret-Referenz, Timeouts, Rate-Limits und Kill-Switches
- Hostseitige Adapter, die provider-spezifische Semantik in normierte Editor-Ergebnisse übersetzen
- Keine Verlagerung von Providerwahl, Secret-Verantwortung oder Infrastrukturkonfiguration in das POI-Plugin

### In `plugin-sdk` nur falls fachlich nötig

- Rein client-sichere, providerneutrale Typen für normierte Such- und Ortsresultate
- Keine Provider-Registrierung, keine Secret-Verwaltung und keine tenant-owned Laufzeitkonfiguration

### Bestehende Referenzen und Extraktionskandidaten

- `packages/plugin-news/src/news.detail-page.tsx` zeigt den reiferen Detail-Editor-Flow mit React Hook Form und klarerer Abschnittsstruktur
- `packages/plugin-news/src/news.detail-content-tab.tsx` ist Referenz für wiederholbare strukturierte Einträge per `useFieldArray`
- `packages/plugin-news/src/news.detail-settings-tab.tsx` ist Referenz für kontrollierte Spezialfelder
- `packages/plugin-news/src/news.detail-card.tsx` ist direkter Extraktionskandidat für eine generische Studio-Abschnittskarte
- `packages/studio-ui-react/src/studio-detail-tabs.tsx` ist bereits die passende gemeinsame Tab-Orchestrierung und soll bevorzugt genutzt statt POI-seitig repliziert werden
- `packages/studio-ui-react/src/studio-form-bridge.tsx` ist die Basis für gemeinsame Formular-Fehler- und Feldbindungslogik

### Architekturregel für diesen Change

- Vor neuer POI-spezifischer UI- oder Hilfslogik wird jeweils geprüft:
  - Kann bestehende Studio- oder News-Logik direkt wiederverwendet werden?
  - Ist eine Extraktion in `studio-ui-react` oder `plugin-sdk` fachlich stabil genug?
  - Würde eine lokale POI-Sonderlösung spätere Events-/News-/weitere Content-Editoren unnötig blockieren?
- Nur wenn diese Prüfung negativ ausfällt, wird neue Logik exklusiv im `plugin-poi` angelegt.

### Abschlussnotiz zur Wiederverwendbarkeit

- Für den aktuellen Delivery-Block wurde die Ownership-Prüfung abgeschlossen, aber nicht jede potenzielle Extraktion direkt umgesetzt.
- Insbesondere generische Abschnittskarten sowie breiter wiederverwendbare Repeater-/Listenprimitives sollen in einem Folgechange noch einmal gezielt gegen reale Mehrfachnutzung in weiteren Editoren bewertet werden.
- Der abgeschlossene Scope ist daher funktional vollständig, aber bei der UI-Wiederverwendbarkeit bewusst konservativ.

## Editor Information Architecture

### 1. Basis

- Felder:
  - Name
  - Hauptkategorie
  - Aktivstatus
- Zweck:
  - Minimal speicherbarer POI

### 2. Ort

- Felder:
  - Ortsbezeichnung oder adressbezogener Zusatz
  - Straße
  - PLZ
  - Ort
  - Geo-Koordinaten `latitude`, `longitude`
  - Kartenansicht mit Marker
- Interaktion:
  - Adresse links, Karte rechts
  - Markerbewegung synchronisiert Koordinaten
  - Koordinaten bleiben zusätzlich direkt editierbar
  - Adresssuche liefert Vorschläge und kann Adresse plus Kartenposition befüllen
  - Adressänderungen können auf Wunsch erneut geokodiert werden

### 3. Beschreibung

- Felder:
  - Beschreibung
  - Mobile Beschreibung
  - optional Tags

### 4. Kontakt

- Felder:
  - Vorname
  - Nachname
  - E-Mail
  - Telefon
  - Fax
  - kontaktbezogene URL
  - Linktext
- Hinweis:
  - Ein primärer Kontaktblock reicht im ersten Schritt; keine Mehrfachkontakt-UI im MVP dieses Changes

### 5. Öffnungszeiten

- Modell:
  - wiederholbare Zeilen
- Felder pro Zeile:
  - Wochentag
  - Datum von
  - Datum bis
  - Öffnet
  - Schließt
  - Beschreibung
  - geöffnet
  - optional Sortierung/Jahresbezug, sofern fachlich nötig

### 6. Links

- Modell:
  - wiederholbare Link-Zeilen
- Felder pro Zeile:
  - URL
  - Linktext/Beschreibung

### 7. Betreiber

- Felder:
  - Name der Institution/Firma
  - Betreiber-Ansprechpartner als Kontaktblock
  - Betreiber-Adresse
  - Betreiber-Geo-Koordinaten
  - optionale Betreiber-Karte oder kompakter Geoblock
- UX-Regel:
  - separater Bereich, weil Redakteure Betreiber und allgemeinen POI-Kontakt mental trennen

### 8. Preise

- Modell:
  - wiederholbare Preiszeilen
- Felder pro Zeile:
  - Bezeichnung
  - Betrag
  - Beschreibung
  - Kategorie
  - erweiterte Gruppen-/Alterslogik bleibt im selben Objekt anschlussfähig

### 9. Medien & Dateien

- Bestandteile:
  - Teaserbild
  - weitere Dateien/Medien
  - Rechteinhaber/Copyright
  - Dateityp bzw. Medienart
  - Upload oder referenzbasierte Medienauswahl
- UX-Regel:
  - Teaserbild prominent, weitere Dateien sekundär

### 10. Erweiterte Daten

- Felder:
  - `payload`
  - Zertifikate
  - Accessibility-Informationen
  - weitere seltene Felder aus dem GraphQL-Vertrag
- UX-Regel:
  - eingeklappt oder deutlich als fortgeschrittener Bereich markiert

### 11. Historie

- Bestehender Bereich bleibt erhalten

## Data Contract Mapping

Der Change soll den folgenden POI-Vertrag explizit im Editor oder Adapter abbilden:

- `categoryName`, `categories`
- `addresses`
- `contact`
- `priceInformations`
- `openingHours`
- `operatingCompany`
- `webUrls`
- `mediaContents`
- `location` soweit fachlich im Editor genutzt
- `certificates`
- `accessibilityInformation`
- `tags`
- `payload`

### Mapping- und Omission-Regeln

Für jede relevante Feldgruppe wird eine explizite Mapping-Entscheidung benötigt:

- **Read/Write:** Das Feld wird vollständig aus Mainserver-Daten geladen, im Editor gepflegt und typed zurückgeschrieben.
- **Read/Passthrough:** Das Feld oder Teilobjekt wird aus Mainserver-Daten geladen und beim Speichern verlustfrei erhalten, ohne in dieser Ausbaustufe vollständig editierbar zu sein.
- **Explizite Omission:** Das Feld wird bewusst nicht durch Studio gepflegt; Grund, Produktentscheidung und Testnachweis müssen dokumentiert sein.

Die Mapping-Matrix muss mindestens pro Feldgruppe festhalten:

- führendes Studio-Feld oder führende Studio-Sektion
- Zielstruktur im typed Mainserver-Input
- Kardinalität und Verlustfreiheitsregel
- Defaulting- und Normalisierungsregel
- Read/Write, Read/Passthrough oder explizite Omission
- Testverantwortung für Mapping und Roundtrip

Für diesen Change gelten zusätzlich folgende Leitplanken:

- `addresses` ist die führende Studio-Pflege für die primäre POI-Adresse.
- Wenn bestehende Mainserver-POIs mehrwertige `addresses` oder andere strukturierte Teilobjekte enthalten, dürfen nicht editorseitig gepflegte Einträge nicht stillschweigend verloren gehen.
- `location` bleibt ein Spezialfeld; es darf nicht unbegründet die führende Rolle von `addresses` und bestätigten Geo-Koordinaten unterlaufen.
- Provider-Metadaten aus Geocoding-Antworten sind standardmäßig flüchtiger UI- oder Diagnosezustand und keine implizite Persistenzfläche.
- `payload` bleibt ein Spezialbereich und kein Ausweichpfad für fehlende strukturierte Kernpflege.

## Geocoding and Map Interaction Contract

### Kartenbibliothek

- Empfohlene Kartenbasis:
  - `maplibre-gl`
  - React-Integration über `react-map-gl/maplibre`
- Begründung:
  - Der verwendete Kartenstil ist eine Style-URL, die direkt in ein MapLibre-basiertes Kartenmodell passt.
  - Die React-Integration soll möglichst wenig hosteigene Karten-Orchestrierung erzwingen.

### Führende Geo-Interaktionen

Der Editor soll drei primäre Geo-Interaktionen unterstützen:

1. **Adresssuche**
   - Redakteur sucht nach einer Adresse oder einem Ort
   - System zeigt Vorschläge
   - Auswahl eines Vorschlags füllt Adressfelder und setzt Karte/Marker

2. **Adress-Geocodierung aus eingegebenen Feldern**
   - Redakteur füllt Straße, PLZ und Ort manuell
   - System kann daraus gezielt eine Geocoding-Anfrage erzeugen
   - Treffer aktualisiert Marker und Koordinaten

3. **Kartenbasierte Auswahl**
   - Redakteur setzt oder verschiebt den Marker direkt auf der Karte
   - System aktualisiert `latitude`/`longitude`
   - optionaler Reverse-Geocoding-Pfad kann daraus Adressfelder aktualisieren oder Vorschläge machen

### Tenant-owned Interface-Vertrag

Der UI-Flow darf nicht direkt auf Geoapify-spezifische Response-Objekte oder Query-Parameter aufbauen. Stattdessen wird ein tenant-owned Interface-Vertrag benötigt, der mindestens diese Operationen kapselt:

- `searchAddressSuggestions(query, context?)`
- `geocodeAddress(addressFields, context?)`
- `reverseGeocodeCoordinates(latitude, longitude, context?)`

Der Vertragsoutput soll für die UI normiert sein, z. B.:

- `label`
- `street`
- `postcode`
- `city`
- `country`
- `latitude`
- `longitude`
- optionale Provider-Metadaten in einem explizit sekundären Feld
- optional `confidence` oder ein vergleichbares Qualitätsfeld für Ranking und UI-Hinweise

Das Tenant-Interface verwaltet die providerbezogene Konfiguration für diese Fähigkeiten, insbesondere:

- aktiven Geocoding-Provider
- Kartenstil und Tile-Endpoint
- Secret-Referenz oder vergleichbare tenant-owned Secret-Konfiguration
- Laufzeitgrenzen wie Timeouts, Retry-Regeln, Rate-Limits und Kill-Switches

Der Browser darf dabei keinen provider-spezifischen Vertragszustand kennen:

- keine Geoapify-spezifischen Payload-Shapes in Plugin-Komponenten
- keine direkte Abhängigkeit des Plugins von Geoapify- oder Nominatim-Endpunkten
- keine Secret- oder API-Key-Weitergabe an Plugin-spezifische Fachlogik ohne Tenant-Interface-Kontrolle

### Initialer Provider: Geoapify

- Geoapify Address Autocomplete liefert adressbezogene Vorschläge für Teilstrings.
- Geoapify Geocoding liefert Koordinaten aus Adresseingaben.
- Geoapify Reverse Geocoding liefert strukturierte Adressbestandteile aus Koordinaten.
- Der erste Rollout darf Geoapify als externen Provider nutzen, aber nur hinter dem normierten tenant-owned Interface-Vertrag.

### Zielprovider: eigener Nominatim-Dienst

- Nominatim unterstützt freie und strukturierte Suche sowie Reverse-Geocoding.
- Der spätere Wechsel soll keinen editorseitigen Umbau der Formular- oder Karteninteraktion erfordern.
- Die öffentliche OSMF-Nominatim-Instanz hat eine eigene Usage Policy; der Zielzustand dieses Changes ist deshalb nicht die harte Kopplung an `nominatim.openstreetmap.org`, sondern die Anschlussfähigkeit an einen selbst betriebenen Nominatim-Dienst.

### Fallback- und Fehlerverhalten

- Wenn die Adresssuche fehlschlägt, bleibt die manuelle Kartenplatzierung verfügbar.
- Wenn Geocoding aus Adressfeldern keinen Treffer liefert, bleiben Adresswerte erhalten und das System zeigt einen klaren fachlichen Hinweis.
- Wenn Reverse-Geocoding ungenau oder leer ist, bleiben manuelle Adressfelder führend.
- Ein Providerfehler darf die restliche POI-Bearbeitung nicht blockieren.
- Bei mehreren Treffern bleibt der vom Redakteur explizit gewählte Suchtreffer führend; automatische Umpositionierungen ohne Nutzeraktion sind zu vermeiden.

## Observability and Failure Diagnostics

Die neuen tenant-owned Karten-, Geocoding- und Host-Write-Pfade müssen diagnosefähig eingeführt werden, ohne PII oder Provider-Secrets in Standardpfade auslaufen zu lassen.

### Strukturierte Server-Signale

Für hostseitige Operationen werden mindestens unterscheidbare Outcomes benötigt für:

- `success`
- `no_result`
- `invalid_input`
- `provider_error`
- `rate_limited`
- `timeout`
- `fallback_used`

Diese Signale müssen mindestens den betroffenen Pfad und die Operation erkennbar machen, etwa:

- Adresssuche
- Geocoding aus Adressfeldern
- Reverse-Geocoding
- Karten-/Style-Ladefehler auf Host- oder Konfigurationsseite
- Host-Route-Validierungsfehler
- Mainserver-Write-Normalisierung

### PII- und Secret-Regeln

- Keine Rohwerte von API-Keys, Secret-Referenzen, vollständigen Provider-URLs oder provider-spezifischen Tokens in Standard-Logs.
- Keine unredigierten Freitext-Suchanfragen, vollständigen Kontaktfelder oder vollständigen Adressqueries in allgemeinen Diagnosemeldungen.
- Provider-Metadaten dürfen nur in erlaubten, explizit sekundären Diagnosefeldern verarbeitet werden.

### Diagnoseziel für diesen Change

Der Change muss es ermöglichen, produktiv zu unterscheiden zwischen:

- ungültiger Benutzereingabe
- bewusstem Nicht-Treffer
- temporärem Providerfehler
- Konfigurationsproblem im tenant-owned Interface
- Fehler im Host-Write-Pfad oder Mainserver-Mapping

## Delivery Slices

Der Change bleibt fachlich ein zusammenhängender Change, wird aber implementierungsseitig in verbindlicher Reihenfolge geschnitten:

### Slice A: Vertrags- und Infrastrukturgrundlage

- Wiederverwendbare Kandidaten in `plugin-news`, `studio-ui-react` und `plugin-sdk` inventarisieren, bevor neue POI-spezifische Editorstruktur gebaut wird
- Karten- und Geocoding-Bibliotheken entscheiden und anbinden
- tenant-owned Interface-Vertrag für Karte, Adresssuche, Geocoding und Reverse-Geocoding definieren
- providerneutralen Response-Shape festziehen
- Mapping-Matrix und Omission-Regeln pro Feldgruppe festziehen
- Provider-Konfiguration, Kartenstil und Secret-/Key-Verantwortung tenant-owned im Interface-Modell klären
- Observability-Grundschema für Provider-, Karten- und Host-Write-Pfade festziehen
- Review-Anker im aktuellen Scope:
  - `mapGeocoding`-Interface-Zuschnitt
  - providerneutrale Geocoding-Typen
  - hostseitige Geocoding-Serverfunktionen
- Komplexitätsgrenze:
  - noch keine fachliche Karten- oder Formularlogik in große UI-Komponenten ziehen
- Testpflicht:
  - Vertrags- und Providerlogik erhält früh isolierte Unit-Tests

### Slice B: Datenvertrag und Host-Write-Pfad

- Gemeinsame Ownership für tenant-owned Interface-Vertrag, Adapter und wiederverwendbare Editorprimitives festziehen
- POI-Formmodell und Mainserver-Inputmodell angleichen
- `poi-route.ts` und zugehörige Parser für fehlende strukturierte Bereiche erweitern
- Mapping-, Passthrough- und Omission-Entscheidungen pro Feldgruppe dokumentieren und testbar machen
- Tests für Mapping und Route grün ziehen, bevor neue GUI-Bereiche produktiv verdrahtet werden
- Review-Anker im aktuellen Scope:
  - erweiterter POI-Write-Vertrag
  - Host-Adapter für strukturierte POI-Felder
  - dokumentierte Mapping-Matrix pro Feldgruppe
- Komplexitätsgrenze:
  - Parser, Mapper und Input-Normalisierung nicht in einer Sammelfunktion bündeln
- Testpflicht:
  - Mapping- und Parser-Tests vor GUI-Anbindung ergänzen

### Slice C: Kern-Redaktionsflow

- `Basis`, `Ort`, `Beschreibung`, `Kontakt`
- Karteninteraktion, Adresssuche und Geocodierung
- `Create`- und `Edit`-Fokus konsolidieren
- vorhandene gemeinsame Editorbausteine nutzen oder vor POI-spezifischer Verdrahtung extrahieren
- Review-Anker im aktuellen Scope:
  - Multi-Tab-Editor und gemeinsame Bereichsstruktur
  - Karten-/Adresssuche-/Geocoding-Flow im Ortsbereich
- Komplexitätsgrenze:
  - Kartenlogik, Suchlogik und Formularlogik in getrennten Bausteinen halten
- Testpflicht:
  - Kernflow-UI-Tests und Geocoding-Interaktionstests mit diesem Slice einführen
  - Nicht-Treffer-, Providerfehler- und Fallback-Signale in UI und Host-Pfad sichtbar und testbar machen

### Slice D: Erweiterte Redaktionsbereiche

- `Öffnungszeiten`, `Links`, `Betreiber`, `Preise`
- wiederholbare Listen-Editoren vereinheitlichen
- Review-Anker im aktuellen Scope:
  - wiederholbare strukturierte Bereichs-Editoren
  - getrennte Pflege für Kontakt und Betreiber
- Komplexitätsgrenze:
  - wiederholbare Bereiche auf gemeinsame, kleine Editor-Bausteine stützen statt pro Bereich eigene Sonderlogik aufzubauen
- Testpflicht:
  - jede neue Listenlogik mit passenden Unit- oder UI-Tests absichern

### Slice E: Medien, Zusatzdaten und Abschluss

- `Medien & Dateien`
- `Erweiterte Daten`
- Historie, Doku, Governance und Abschlussverifikation
- Review-Anker im aktuellen Scope:
  - explizite Trennung von Kernpflege und Zusatzdaten
  - Dokumentations- und Architektur-Nachzug für den gesamten Flow
- Komplexitätsgrenze:
  - Zusatzdaten dürfen den Kernflow nicht mit Sonderfällen überladen
- Testpflicht:
  - Abschlussverifikation prüft explizit auch, dass neue Hilfslogik und UI-Pfade nicht ohne Tests eingeführt wurden

Kein späterer Slice darf beginnen, wenn der relevante kleinere Gate-Pfad des vorherigen Slice rot ist.

## Acceptance Criteria

Der Change gilt erst dann als fachlich abgeschlossen, wenn mindestens folgende Zustände erreicht sind:

- Ein Redakteur kann einen neuen POI mit `Basis` und `Ort` anlegen, ohne JSON-Pflege zu benötigen.
- Ein Redakteur kann die Geo-Position eines POI über Karte, Adresssuche oder Geocodierung aus Adressfeldern setzen.
- Ein bestehender POI kann strukturiert um Kontakt, Öffnungszeiten, Links, Betreiber und Preise ergänzt werden.
- Die Studio-UI verliert beim Speichern keine editorseitig gepflegten strukturierten POI-Daten mehr auf dem Host-Write-Pfad.
- Nicht editorseitig gepflegte, aber vom Mainserver geladene strukturierte Teilobjekte werden nicht stillschweigend verworfen, wenn sie für diesen Change als Read/Passthrough festgelegt sind.
- Geoapify ist austauschbar, ohne dass die Editor-UI oder das Plugin auf provider-spezifische Response-Shapes angewiesen ist; Providerwechsel und Secret-Konfiguration bleiben tenant-owned am Interface.
- Der Editor bleibt bei Providerfehlern, Nicht-Treffern und ungenauem Reverse-Geocoding nutzbar.
- Host-Write-, Karten- und Geocoding-Pfade liefern strukturierte, PII-arme Diagnose-Signale für Erfolg, Nicht-Treffer, Validierungsfehler und Providerprobleme.

Zusätzlich gilt der Change erst dann als reviewbar, wenn folgende Review-Kriterien pro Slice sichtbar nachweisbar sind:

- Slice A dokumentiert den providerneutralen Vertrag, den Tenant-Ownership-Schnitt und die Qualitätsgrenzen für Secrets, Timeouts, Rate-Limits und Kill-Switches.
- Slice B dokumentiert pro relevanter Feldgruppe Read/Write, Read/Passthrough oder explizite Omission inklusive Roundtrip- oder Adapter-Testverantwortung.
- Slice C dokumentiert, wie Create und Edit dieselbe Bereichsstruktur nutzen und wie Kartenfehler oder Nicht-Treffer den restlichen Flow nicht blockieren.
- Slice D dokumentiert, wie wiederholbare Listen-Editoren gemeinsame Primitives nutzen und keine bereichsspezifische Sonderlogik vervielfachen.
- Slice E dokumentiert, welche Doku-, Governance- und Abschluss-Gates zusätzlich zu den Codepfaden grün sein müssen.

Für die Redaktionslogik gilt:

- `addresses` ist die führende Pflege für die primäre POI-Adresse
- `location` bleibt ein Spezialfeld und wird nur dann prominent, wenn es fachlich nicht aus Adresse/Geo-Position abgeleitet werden kann
- `payload` ist kein Ersatz für fehlende strukturierte GUI-Felder

## Architecture Impact

### Plugin Layer

`packages/plugin-poi` muss:

- das Formularmodell erweitern
- neue Sektionen und wiederholbare Editoren bereitstellen
- die Karten- und Geocoding-Interaktionen im Ortsbereich anbinden
- Mapping von Mainserver-POI <-> Formularwerten vervollständigen
- Validierung für neue strukturierte Felder ergänzen
- nur die fachlich POI-spezifischen Teile lokal behalten und gemeinsame UI-/Vertragslogik gezielt auslagern

### Host Mainserver Route Layer

`packages/sva-mainserver/src/server/poi-route.ts` muss zusätzlich zu heute mindestens folgende Write-Felder verarbeiten:

- `priceInformations`
- `openingHours`
- `operatingCompany`
- `location`
- `mediaContents`
- `certificates`
- `accessibilityInformation`

### Shared UI Layer

In `packages/studio-ui-react` sollen bevorzugt gemeinsame Admin-/Form-Primitives gebündelt werden, z. B.:

- Listen-Editor-Grundmuster
- Kartenfeld-Integration
- strukturierte Summary-/Section-Fehleranzeige
- generische Abschnittskarten und Detail-Tab-Orchestrierung für Content-Editoren

Dabei gilt weiterhin: keine parallelen Basis-Komponenten ohne belegten Bedarf.

### Host Geocoding Layer

Zusätzlich wird ein tenant-owned Geocoding- und Karten-Interface benötigt, damit:

- Providerwahl, Kartenstil und Secret-Referenz im bestehenden Tenant-Interface-Muster bleiben
- API-Keys oder Provider-spezifische Konfiguration nicht in Plugin- oder Browserlogik ausufern
- Geoapify zunächst produktiv genutzt werden kann
- ein späterer Wechsel auf einen eigenen Nominatim-Dienst ohne POI-UI-Neuschnitt möglich bleibt

Der providerneutrale Vertragskern soll dabei nicht im POI-Plugin, sondern tenant-owned im Host-Interface-Zuschnitt liegen; client-sichere Typen können ergänzend in einem gemeinsamen SDK-nahen Zuschnitt gespiegelt werden.

## Usability Model

### Erstnutzer

- sollen mit `Basis` beginnen
- nach erstem Speichern direkt zum Abschnitt `Ort` geführt werden
- sehen klare Abschnittsnamen und keine technische Überfrachtung

### Wiederkehrer

- sollen gezielt einzelne Abschnitte anspringen können
- profitieren von stabiler Abschnittsstruktur und wiederkehrenden Listenmustern

### Friction Reduction

- keine Pflicht, seltene Daten vor dem ersten Speichern zu erfassen
- keine Beschränkung auf erste Einträge bei Mehrfachlisten
- keine JSON-Pflege für Standarddaten
- sichtbare Status- und Fehlerkommunikation pro Abschnitt

## Risks / Trade-offs

- Ein einzelner, größerer Change erhöht temporär das Integrationsrisiko.
  - Mitigation: klare interne Bau-Reihenfolge, stufenweiser Testlauf nach jedem Änderungsblock

- Der Umfang kann zu inkonsistenten halbfertigen Sektionen führen.
  - Mitigation: die Sektionen werden im selben Change nur dann aktiviert, wenn Mapping, Route und Tests jeweils mitgezogen sind

- Unklare Mapping- oder Omission-Entscheidungen können zu stillem Datenverlust bei bestehenden POIs führen.
  - Mitigation: explizite Mapping-Matrix, Roundtrip-Tests und dokumentierte Read/Passthrough-Regeln pro Feldgruppe

- Kartenintegration erhöht Abhängigkeit und UI-Komplexität.
  - Mitigation: nur ein klarer Standard-Kartenstil, keine zweite Kartenarchitektur

- Neue Provider- und Host-Pfade können ohne klare Diagnosefähigkeit schwer entstörbar werden.
  - Mitigation: strukturierte Observability, Outcome-Klassen und PII-arme Fehlerdiagnose von Beginn an

- Vollständige Mainserver-Felddeckung kann seltene Spezialfelder in die UI drücken.
  - Mitigation: Kernflow vs. `Erweiterte Daten` sauber trennen

- Hoher Funktionsumfang kann zu übergroßen Komponenten, zu vielen Zuständigkeiten pro Datei oder nachgelagerter Testschuld führen.
  - Mitigation: Complexity- und Coverage-Disziplin pro Slice, nicht nur als Abschlussprüfung

## Alternatives Considered

- Alternative: Nur die fehlenden Felder in die bestehende `Inhalt`-Sektion einfügen.
  - Rejected: Das würde die Redaktionsreihenfolge nicht verbessern und in einem überfüllten Sammel-Tab enden.

- Alternative: Separater Wizard nur für `Create`, reduzierter Editor für `Edit`.
  - Rejected: Doppelte Pflege und Testlast, divergierende Nutzererwartung.

- Alternative: Fehlende Spezialfelder weiter über `payload` lösen.
  - Rejected: Das unterläuft Struktur, Validierung und Redaktionsklarheit.

## Migration Plan

1. OpenSpec, Delivery-Slices und Akzeptanzkriterien festziehen
2. Karten-/Geocoding-Vertrag und Dependency-Entscheidung absichern
3. POI-Formtypen, Mappings und Host-Write-Pfad vervollständigen
4. Kernsektionen `Basis`, `Ort`, `Beschreibung`, `Kontakt` inklusive Karten-/Geocoding-Flow umsetzen
5. Wiederholbare Sektionen `Öffnungszeiten`, `Links`, `Betreiber`, `Preise` umsetzen
6. `Medien & Dateien` und `Erweiterte Daten` ergänzen
7. Historie, Edit-/Create-Feinschliff und Doku vereinheitlichen
8. Tests, Architekturreferenzen und Abschlussverifikation abschließen

## Vormerkung für spätere arc42-Aktualisierung

Die folgende Architekturpflege ist für diesen Change vorgemerkt und muss bei der nachgelagerten Doku-Aktualisierung geprüft werden:

- `04-solution-strategy`: redaktionsorientierter Voll-Editor statt Minimalformular
- `05-building-block-view`: neue Verantwortungsteilung zwischen `plugin-poi`, `studio-ui-react`, `plugin-sdk`, Host und Tenant-Interfaces
- `06-runtime-view`: Detailfluss Create/Edit, Host-Write-Pfad, Karten- und Geocoding-Interaktionen
- `07-deployment-view`: externer Kartenstil, Geocoding-Provider, tenant-owned Konfiguration und Secret-Auflösung
- `08-cross-cutting-concepts`: Typsicherheit, Mapping-Matrix, PII-arme Observability, Wiederverwendungsregeln
- `09-architecture-decisions`: tenant-owned Geocoding-Vertrag, Kartenbasis, Bereichsstruktur, Trennung Kernflow/Erweiterte Daten
- `10-quality-requirements`: Slice-scharfe Tests, Komplexitätsgrenzen, Degradationsverhalten bei Providerfehlern
- `11-risks-and-technical-debt`: Datenverlust-Risiken, UI-Komplexität, Providerabhängigkeiten, Restschuld bei seltenen Feldgruppen
