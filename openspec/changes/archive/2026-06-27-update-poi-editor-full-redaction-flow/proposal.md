# Change: Vollständigen POI-Editor auf redaktionsorientierten Voll-Flow erweitern

## Why

Der aktuelle POI-Editor in Studio deckt nur einen kleinen Teil des fachlichen und technischen POI-Vertrags ab. Redakteure können Basisdaten, einfache Beschreibungen, eine reduzierte Adresse, einen Minimal-Kontakt, einen einzelnen Link und ein einzelnes Teaserbild pflegen, aber zentrale POI-Daten wie Betreiber, Preise, Geo-Koordinaten, wiederholbare Öffnungszeiten, mehrere Links und strukturierte Dateiangaben fehlen oder sind nicht sinnvoll bedienbar.

Gleichzeitig zeigt der Mainserver-/GraphQL-Vertrag, dass diese Daten bereits fachlich vorgesehen sind. Ohne einen vollständigen, aufgabenorientierten Editor entsteht ein Bruch zwischen fachlichem Zielbild, technischem Datenvertrag und realer Redaktionsarbeit.

## What Changes

- Der POI-Editor wird von einem reduzierten Tab-Editor zu einem vollständigen redaktionsorientierten Bearbeitungsflow erweitert.
- Die POI-Bearbeitung wird auf eine aufgabenorientierte Reihenfolge für Redakteure ausgerichtet: `Basis`, `Ort`, `Beschreibung`, `Kontakt`, `Öffnungszeiten`, `Links`, `Betreiber`, `Preise`, `Medien & Dateien`, `Erweiterte Daten`, `Historie`.
- Der Editor deckt den relevanten Mainserver-Vertrag für POI explizit ab, statt Daten in technische Restfelder oder implizite Payload-Pfade auszuweichen.
- Der hostseitige POI-Route-Adapter wird so erweitert, dass die fehlenden fachlichen Felder aus Studio in den typed Mainserver-POI-Write-Pfad gelangen.
- Wiederverwendbare Editor-Bausteine werden vor neuer POI-Sonderlogik systematisch gegen bestehende Host-, SDK- und News-Komponenten geprüft und bei stabilem Mehrwert in gemeinsame Pakete extrahiert.
- Nicht direkt ausgelieferte, aber als sinnvoll bestätigte Wiederverwendbarkeitsverbesserungen werden explizit als Folgearbeit festgehalten statt als implizit erledigt behandelt.
- Die GUI für Ortsdaten erhält eine Kartenintegration; der initiale Kartenstil `https://tileserver-gl.smart-village.app/styles/osm-bright/` wird tenant-owned über das zugehörige Interface konfiguriert.
- Die Auswahl und Erzeugung von Geo-Koordinaten erfolgt führend über die Karte und ergänzend über eine Adresssuche beziehungsweise Adress-Geocodierung.
- Karten- und Geocoding-Fähigkeiten werden über tenant-owned Interfaces des Hosts modelliert, statt Provider- oder Konfigurationswissen im POI-Plugin zu verankern.
- Für die initiale Adresssuche und Geocodierung wird Geoapify hinter einem tenant-owned Interface genutzt; der Vertrag wird so geschnitten, dass später ein eigener Nominatim-Dienst denselben Interface-Typ ohne editorseitigen Umbau bedienen kann.
- Wiederholbare Redaktionsdaten wie Öffnungszeiten, Links, Preise und Dateien werden als konsistente Listen-Editoren modelliert.
- Der Standard-Redaktionsflow trennt klar zwischen Kernpflege und erweiterten/selteneren Zusatzdaten.
- Der Change wird als ein zusammenhängender Delivery-Block umgesetzt, intern aber in klaren Abhängigkeitsscheiben aufgebaut: Datenvertrag und Host-Adapter vor GUI, Karten-/Geocoding-Vertrag vor Orts-UI, Kernsektionen vor erweiterten Sektionen.
- Code-Komplexität und Testabdeckung werden von Beginn an als Delivery-Leitplanken behandelt; jeder Slice muss mit kleinstmöglicher zusätzlicher Ownership, reviewbarer Teststrategie und ohne ungedeckte Komplexitätserhöhung umgesetzt werden.
- Der bereits angelieferte Scope wird in OpenSpec explizit gespiegelt: erweitertes POI-Formmodell, vollständigerer Host-Write-Pfad, Multi-Tab-Editor, `mapGeocoding`-Tenant-Interface, providerneutrale Geocoding-Typen im `plugin-sdk` und hostseitige Geocoding-Serverfunktionen.

## Impact

- Affected specs: `content-management`, `sva-mainserver-integration`, `ui-layout-shell`
- Affected code: `packages/plugin-poi`, `packages/sva-mainserver`, `apps/sva-studio-react`, `packages/studio-ui-react`, `packages/plugin-sdk`, Referenz-/Extraktionskandidaten in `packages/plugin-news`
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `07-deployment-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`
- Required documentation updates:
  - `docs/development/studio-form-migrationsinventur.md`
  - relevante POI-/Content-Dokumentation unter `docs/`
- Required architecture decisions:
  - tenant-owned Interface-Typ oder Erweiterung eines bestehenden Interface-Typs für Karten- und Geocoding-Fähigkeiten
  - tenant-owned Konfigurationsverantwortung für Providerwahl, Kartenstil, Secret-Referenz, Laufzeitgrenzen und Degradationsmodus
- Required dependency decisions:
  - Kartenbasis `maplibre-gl`
  - React-Integration `react-map-gl/maplibre`
  - initialer Geocoding-Provider Geoapify hinter einem tenant-owned Interface-Vertrag
- Required tests:
  - POI-Plugin-Unit-Tests für Mapping, Validierung und neue Formularsektionen
  - Mainserver-Route-/Adapter-Tests für die erweiterten POI-Felder
  - UI-/Flow-Tests für den redaktionsorientierten Editor
  - Geocoding-/Provider-Tests für Suchtreffer, Nicht-Treffer, Reverse-Geocoding und Providerfehler
- Required operational rules:
  - tenant-owned Verwaltung von Provider-Konfiguration, Style-URL und Secret-Referenz
  - Laufzeitgrenzen, Fallbacks und Kill-Switches für Karten- und Geocoding-Fähigkeiten pro Tenant
  - strukturierte Observability für Geocoding-, Karten- und Host-Write-Pfade mit PII-armer Fehlerdiagnose
- Required quality discipline:
  - Komplexitätsanstiege in Formular-, Mapping-, Adapter- und Kartenlogik müssen pro Slice aktiv begrenzt oder durch Zerlegung begründet werden
  - Testabdeckung muss pro Slice mitwachsen; neue Kernlogik, Parser, Mapper und UI-Flows dürfen nicht erst am Ende gesammelt abgesichert werden
  - wiederverwendbare Logik und UI darf nicht POI-lokal dupliziert werden, wenn dieselbe Verantwortung später auch für News, Events oder weitere Content-Typen benötigt wird
  - Mapping, Passthrough und explizite Omissionen für Mainserver-Felder müssen pro Feldgruppe reviewbar dokumentiert und testbar gehalten werden

## Delivery-Reihenfolge des implementierten Scopes

Die Change-Artefakte spiegeln dieselbe Reihenfolge wider, die auch im bereits laufenden Implementierungszuschnitt verwendet wird:

1. Slice A: Vertrags- und Infrastrukturgrundlage
   - `mapGeocoding`-Tenant-Interface, providerneutraler Geocoding-Vertrag, Kartenstil, Observability-Grundregeln
2. Slice B: Datenvertrag und Host-Write-Pfad
   - POI-Formmodell, Mapping-Matrix, Host-Write-Adapter, typed Mainserver-Vertrag
3. Slice C: Kern-Redaktionsflow
   - `Basis`, `Ort`, `Beschreibung`, `Kontakt`, Karten- und Geocoding-Interaktion, gemeinsamer Create/Edit-Editor
4. Slice D: Erweiterte strukturierte Redaktionsbereiche
   - `Öffnungszeiten`, `Links`, `Betreiber`, `Preise`
5. Slice E: Medien, Zusatzdaten, Historie und Abschluss
   - `Medien & Dateien`, `Erweiterte Daten`, Abschlussverifikation, Doku und Governance

Diese Reihenfolge ist für Proposal, Design, Tasks und spätere Review-Kommentare bindend. Falls der implementierte Scope davon abweicht, muss die Abweichung im Change-Ordner nachgeführt werden, bevor der Change als reviewbar gilt.

## Vormerkung Architektur-Doku

Für die spätere Architekturpflege sind folgende arc42-Abschnitte als betroffen vorgemerkt:

- `04-solution-strategy`
- `05-building-block-view`
- `06-runtime-view`
- `07-deployment-view`
- `08-cross-cutting-concepts`
- `09-architecture-decisions`
- `10-quality-requirements`
- `11-risks-and-technical-debt`
