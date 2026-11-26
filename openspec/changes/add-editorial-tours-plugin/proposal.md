# Change: Redaktionelle Touren als eigenes Studio-Modul

## Ziel

Berechtigte Redakteure können Freizeit- und Tourismustouren aus dem Mainserver in einem eigenständigen Studio-Modul auflisten, öffnen, anlegen und pflegen. Der fachliche Auftrag steht in [#1428](https://github.com/smart-village-solutions/sva-studio/issues/1428).

## Lieferabschnitte

1. **Bestand lesen.** `@sva/plugin-tours` mit Plugin-ID `tours` erhält zwei tenantgeschützte Ansichten unter `/plugins/tours` und `/plugins/tours/$id`. Mit `tours.read` können Berechtigte im aktiven persönlichen oder Organisationskontext durch die Tourenliste blättern und Route und Stationen strukturiert ansehen. Die Liste umfasst Touren, die im selben Kontext auch geöffnet werden dürfen. Gemeinsame Tabellen- und Detailbausteine folgen dem POI-Muster. Die Streckenkarte und die vollständige Suche und Filterung folgen im Ausbau.
2. **Entwürfe anlegen.** Nach Nachweis der atomar unveröffentlichten Erstellung einer neuen Tour den POI-nahen Standard-Content-Pfad für `tours.tour` anbinden. Beim Wechsel auf `/admin/tours` bleiben die bisherigen Links über Weiterleitungen nutzbar. Beschreibung, Kategorien, Ort, Kontakt, Betreiber, Medien und Historie verwenden vorhandene Bausteine. Neue Touren erhalten einen typisierten Schreibpfad für Länge, Route und geordnete Stationen.
3. **Bestand bearbeiten.** Tour- und Stationsänderungen erst nach einem belastbaren Mainserver-Nachweis für den Erhalt von IDs, Reihenfolge und unbeteiligten Bestandsdaten freigeben. Sichtbarkeit, Entfernen und Inhabertransfer jeweils anhand ihrer eigenen Mainserver-Semantik freigeben. Die zentrale Projektion bildet Gültigkeit und Veröffentlichung unabhängig ab.

Das Modul nutzt die gemeinsamen SDK- und UI-Bausteine hinter POI und den bestehenden Mainserver-Hostpfad. Fachlicher Zustand liegt im Mainserver. Der Host behält Verantwortung für Session, Berechtigungen, Principal, Credentials, Idempotenz, Historie und Projektion.

## Umfang

- Betroffen sind das neue Touren-Plugin, seine Registrierung, der typisierte Mainserver-Adapter, die vorhandenen Host-Routen und Content-Beiträge sowie die zugehörige Redaktionsdokumentation und Tests.
- MP3-Upload und Audiowiedergabe stehen in [#2253](https://github.com/smart-village-solutions/sva-studio/issues/2253), AR-Pflege in [#1429](https://github.com/smart-village-solutions/sva-studio/issues/1429) und externer Tourenimport in [#1526](https://github.com/smart-village-solutions/sva-studio/issues/1526). Abfalltouren und neue Routing- oder Navigationsdienste liegen außerhalb von #1428.
- Der Lieferabschnitt zur Entwurfsanlage stellt zugleich den bestehenden Ortseditor auf direkt unveröffentlichte Entwürfe um. Beide Entwurfspfade verwenden das optionale Mainserver-Attribut `visible`.
- Betroffene Spezifikationen sind `content-management` und `sva-mainserver-integration`. Bei Umsetzung die arc42-Baustein- und Laufzeitsicht sowie die betroffenen Querschnittsregeln in Abschnitten 05, 06 und 08 aktualisieren.
