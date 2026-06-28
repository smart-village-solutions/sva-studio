## Abschlussvermerk

Der Delivery-Block für `update-poi-editor-full-redaction-flow` ist im aktuellen Repository-Zuschnitt abgeschlossen. Die weitergehende Extraktion von Abschnitts-, Repeater- und Formularprimitives nach `packages/studio-ui-react` wurde fachlich bewertet, für diesen Change aber nur punktuell umgesetzt und als gezielte Folgearbeit vorgemerkt.

## 1. Spezifikation und Dokumentation vorbereiten

- [x] 1.1 OpenSpec-Delta für `content-management` mit dem redaktionsorientierten POI-Editor ergänzen
- [x] 1.2 OpenSpec-Delta für `sva-mainserver-integration` mit vollständigem POI-Write-Vertrag ergänzen
- [x] 1.3 OpenSpec-Delta für die Editor-/Flow-UX in `ui-layout-shell` ergänzen
- [x] 1.4 Betroffene arc42-Abschnitte `04`, `05`, `06`, `07`, `08`, `09`, `10` und `11` identifizieren und für die spätere Aktualisierung vormerken
- [x] 1.5 Akzeptanzkriterien und interne Delivery-Slices im Change-Design reviewbar festhalten
- [x] 1.6 Komplexitäts- und Testabdeckungsleitplanken pro Slice explizit mitführen und nicht nur als Abschlusskontrolle behandeln

## 2. Shared Ownership und Wiederverwendung festziehen

Die Ownership-Entscheidungen dieses Abschnitts sind für den aktuellen Change getroffen und im Design dokumentiert. Eine breitere Wiederverwendung über `plugin-poi` hinaus bleibt als spätere Verbesserungsarbeit explizit offen.

- [x] 2.1 Bestehende Editorbausteine in `plugin-news`, `studio-ui-react` und `plugin-sdk` systematisch gegen den POI-Bedarf inventarisieren
- [x] 2.2 Festlegen, welche Verantwortungen dauerhaft im `plugin-poi` bleiben und welche in gemeinsame Pakete extrahiert werden
- [x] 2.3 `StudioDetailTabs` als Standard-Orchestrierung für den neuen POI-Editor vorsehen, statt lokale Tab-Orchestrierung fortzuführen
- [x] 2.4 Prüfen, ob eine generische Abschnittskarte aus `packages/plugin-news/src/news.detail-card.tsx` nach `studio-ui-react` extrahiert wird
- [x] 2.5 Prüfen, ob wiederverwendbare Listen-/Repeater-Primitives für strukturierte Mehrfacheinträge in `studio-ui-react` sinnvoll und stabil genug sind
- [x] 2.6 Tenant-owned Interface-Verantwortung für Karte, Geocoding, Kartenstil und Secret-Referenz gegenüber `plugin-poi` und `plugin-sdk` klar festziehen
- [x] 2.7 Für jede geplante Extraktion belegen, dass sie langfristige Ownership reduziert und nicht nur POI-spezifische Komplexität verschiebt

## 3. Infrastruktur- und Provider-Grundlage festziehen

- [x] 3.1 Karten-Dependency-Entscheidung `maplibre-gl` plus `react-map-gl/maplibre` final festziehen
- [x] 3.2 Tenant-owned Interface-Vertrag für Karte, Adresssuche, Geocodierung und Reverse-Geocoding definieren
- [x] 3.3 Geoapify als initialen Provider und den Kartenstil hinter diesem Interface anbinden
- [x] 3.4 Provider-Konfiguration, Style-URL, Secret-Referenz und Secret-Verantwortung tenant-owned im Interface-Modell festlegen
- [x] 3.5 Den Vertrag so schneiden, dass später ein eigener Nominatim-Dienst ohne editorseitigen Umbau denselben tenant-owned Interface-Typ bedienen kann
- [x] 3.6 Fehler-, Fallback- und Nicht-Treffer-Verhalten für Karten- und Geocoding-Interaktionen deterministisch absichern
- [x] 3.7 Observability-Grundschema für Suche, Geocoding, Reverse-Geocoding, Kartenfehler und Providerfehler festlegen
- [x] 3.8 Früh prüfen, dass Provider-, Vertrags- und Kartenlogik nicht in einer großen, schlecht testbaren Sammelschicht zusammenläuft

## 4. POI-Formmodell und Mapping vervollständigen

- [x] 4.1 `packages/plugin-poi` um fehlende fachliche Felder für Adresse, Geo-Koordinaten, Kontakt, Betreiber, Preise, Links, Dateien und Zusatzdaten erweitern
- [x] 4.2 Mapping von geladenem Mainserver-POI auf Formularwerte vervollständigen
- [x] 4.3 Mapping von Formularwerten auf den POI-Write-Input vervollständigen
- [x] 4.4 POI-Validierung für neue strukturierte Felder ergänzen
- [x] 4.5 Mapping-Matrix mit Read/Write-, Read/Passthrough- und expliziten Omission-Entscheidungen pro Feldgruppe dokumentieren
- [x] 4.6 Neue Mapping- und Validierungslogik klein schneiden und direkt mit Unit-Tests absichern

## 5. Hostseitigen POI-Write-Pfad vervollständigen

- [x] 5.1 `packages/sva-mainserver/src/server/poi-route.ts` um fehlende POI-Felder erweitern
- [x] 5.2 Parsing und Validierung für `priceInformations`, `openingHours`, `operatingCompany`, `location`, `mediaContents`, `certificates` und `accessibilityInformation` ergänzen oder hostseitig anschlussfähig machen
- [x] 5.3 Sicherstellen, dass der typed Mainserver-POI-Write-Pfad alle im Editor gepflegten Daten deterministisch weiterleitet
- [x] 5.4 Neue Parser-/Normalisierungslogik so aufteilen, dass Complexity-Hotspots nicht unnötig in einer Route konzentriert werden
- [x] 5.5 Strukturierte Diagnose-Signale für Validierungsfehler, Nicht-Treffer, Providerfehler und Write-Normalisierung ergänzen
- [x] 5.6 Für Slice A/B den kleinsten relevanten Gate-Pfad ausführen:
  - `pnpm nx run plugin-poi:test:unit`
  - betroffene `packages/sva-mainserver`-Unit-Tests
  - bei serverseitigen Vertragsänderungen zusätzlich `pnpm check:server-runtime`

## 6. Kern-Redaktionsflow umsetzen

- [x] 6.1 Editorstruktur für `Basis`, `Ort`, `Beschreibung`, `Kontakt` auf den neuen Mehrbereichs-Flow umstellen
- [x] 6.2 Vor lokaler POI-Sonderlogik gemeinsame UI-Bausteine extrahieren oder bewusst wiederverwenden
- [x] 6.3 Kartenintegration für den Ortsbereich mit `https://tileserver-gl.smart-village.app/styles/osm-bright/` umsetzen
- [x] 6.4 Die Karte als führende Eingabe für Geo-Koordinaten modellieren, inklusive Marker setzen, Marker verschieben und Übernahme aus Suchtreffern
- [x] 6.5 Geocoding aus eingegebenen Adressfeldern sowie Reverse-Geocoding als unterstützende Sekundärpfade anbinden
- [x] 6.6 `Create`- und `Edit`-Flow auf denselben Editor vereinheitlichen, aber mit unterschiedlichem Fokus auf Erstpflege vs. Nachpflege
- [x] 6.7 Karten-, Such- und Formularzustand in getrennten, gezielt testbaren Bausteinen halten
- [x] 6.8 Für Slice C den kleinsten relevanten Gate-Pfad ausführen:
  - `pnpm nx run plugin-poi:test:unit`
  - gezielte App-UI-/Route-Tests für POI
  - bei Typänderungen zusätzlich `pnpm nx affected --target=test:types --base=origin/main`

## 7. Erweiterte Redaktionsbereiche umsetzen

- [x] 7.1 Wiederholbare Listen-Editoren für `Öffnungszeiten`, `Links`, `Betreiber` und `Preise` konsistent einführen
- [x] 7.2 `Medien & Dateien` mit Teaserbild und weiteren Dateien an den hostseitigen Medienpfad anschließen
- [x] 7.3 `Payload` und andere fortgeschrittene Felder aus dem Kernflow in `Erweiterte Daten` verlagern
- [x] 7.4 Historie in die neue Editorstruktur einpassen, ohne den bestehenden Verlaufspfad regressiv zu brechen
- [x] 7.5 Wiederholbare Bereichslogik auf gemeinsame kleine Primitives stützen und keine bereichsspezifischen Komplexitätsduplikate aufbauen
- [x] 7.6 Für Slice D/E den kleinsten relevanten Gate-Pfad ausführen:
  - `pnpm nx run plugin-poi:test:unit`
  - relevante Medien-/Host-UI-Tests
  - `pnpm nx affected --target=test:unit --base=origin/main`

## 8. Tests und Qualitätsnachweise ergänzen

- [x] 8.1 POI-Plugin-Unit-Tests für neue Formularsektionen, Mapping und Validierung ergänzen oder anpassen
- [x] 8.2 Mainserver-Route-/Adapter-Tests für den erweiterten POI-Vertrag ergänzen oder anpassen
- [x] 8.3 Tests für Geocoding-Vertrag, Geoapify-Adapter und Provider-Fallbacks ergänzen
- [x] 8.4 UI-/Flow-Tests für zentrale Redaktionspfade `Create` und `Edit` ergänzen oder anpassen
- [x] 8.5 Sicherstellen, dass rote Teilpfade keine weitere Implementierung freigeben
- [x] 8.6 Prüfen, dass neue fachliche Kernlogik und neue UI-Interaktionen nicht ohne passende Tests verbleiben
- [x] 8.7 Roundtrip- und Passthrough-Tests für Mapping- und Omission-Entscheidungen ergänzen
- [x] 8.8 Vor Abschluss mindestens folgenden Gate-Pfad grün ziehen:
  - `pnpm nx run plugin-poi:test:unit`
  - `pnpm nx affected --target=test:unit --base=origin/main`
  - bei Typ-/Vertragsänderungen `pnpm nx affected --target=test:types --base=origin/main`
  - bei serverseitigem Runtime-Pfad `pnpm check:server-runtime`

## 9. Abschluss und Dokumentation

- [x] 9.1 Relevante Doku unter `docs/` für den POI-Editor, Karten-/Geocoding-Flow und die Formularinventur aktualisieren
- [x] 9.2 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder die Abweichung begründet dokumentieren
- [x] 9.3 Prüfen, dass Proposal, Design, Tasks und implementierter Scope dieselbe Delivery-Reihenfolge widerspiegeln
- [x] 9.4 `openspec validate update-poi-editor-full-redaction-flow --strict` erfolgreich ausführen
