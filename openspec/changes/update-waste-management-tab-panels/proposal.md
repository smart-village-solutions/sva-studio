# Change: Abfallmanagement-Tabpanels vereinheitlichen und Listenfunktionen vervollständigen

## Why

Im Abfallmanagement konkurrieren Listenfilter, Auswahlaktionen und fachliche Werkzeuge um denselben Platz. Die freigegebene Gestaltung gibt diesen Bedienelementen feste Positionen. Sie soll vollständig in allen neun Tabs umgesetzt werden, einschließlich der abgestimmten Filter und Sortierungen sowie der vorhandenen Aktionen und Sonderzustände.

## What Changes

- Alle neun Tabs nach dem [freigegebenen Figma-Entwurf](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=272-2) umsetzen. Die aktive Tab-Beschriftung dient der Orientierung. Darunter beginnen direkt die Bedienleiste, die Tabelle oder die fachlichen Abschnitte. Desktop und schmale Ansichten folgen denselben Bedienmustern.
- In allen sechs Listen-Tabs je nach fachlichem Umfang einen mittigen Filterdialog mit abgedunkeltem Hintergrund anbieten. Angewandte Kriterien bleiben in der Liste sichtbar und entfernbar. Die tabgenaue Filtermatrix in `design.md` bestimmt den Lieferumfang. Für **Tour-Einsätze** gilt die bestätigte Abweichung von Figma: Der Filterumfang umfasst die **Tour**. Der Datumsfilter ist zurückgestellt.
- Sämtliche Datenspalten aus der Sortiermatrix im [Spec-Delta](specs/waste-management/spec.md) bedienbar machen. Bei **Abholpunkten** stehen zusätzlich zu den zwei vorhandenen Adressreihenfolgen serverseitige Einzelspaltensortierungen zur Verfügung. Filter, Sortierung und Pagination wirken auf derselben vollständigen Treffermenge.
- Bestehende Aktionen im fachlich passenden Zustand zeigen. Die Hauptaktion und tabbezogene Werkzeuge stehen in der Bedienleiste, Aktionen für markierte Zeilen direkt am Tabellenkopf. Der Einstieg aus einer konkreten Tour behält seinen Rücksprung. Jahresübernahme und Fraktionsprüfung behalten ihre vollständigen Abläufe einschließlich Vorschau, Ergebnissen und Folgeaktionen. Die in `design.md` aufgeführten Abschnittsaktionen für Ausgabe, Datentools und Einstellungen gehören ebenfalls zur Lieferung.

## Impact

- Betroffene Spec: `waste-management`.
- Betroffener Code: `packages/plugin-waste-management` für Tabpanels, Aktionen und Router-Zustand, `packages/waste-management-contracts` und `packages/waste-management-runtime` für den erweiterten lesenden Abholpunkt-Listenvertrag, `apps/sva-studio-react` für gezielte Browser-Prüfungen. Gemeinsame Studio-Komponenten und bestehende Host-Fassade weiterverwenden.
- Betroffene arc42-Abschnitte: [06 Laufzeitsicht](../../../docs/architecture/06-runtime-view.md) für Filterung und Sortierung vor der Pagination, [08 Querschnittliche Konzepte](../../../docs/architecture/08-cross-cutting-concepts.md) für die Anwendung der bestehenden Regeln zu Tastatur, Fokus und Berechtigungen.
- Produktgrenze: Studio-Tabpanels und lesende Listenabfragen. Fachliche Schreibpfade einschließlich Berechtigungen, Zielrouten, Bestätigungen und Folgeeffekten behalten ihren Vertrag. Änderungen an Mainserver, nativer App, öffentlichem Kalender und Datenbankschema liegen außerhalb dieses Changes. Bestehende Listen- und Deep-Link-Parameter bleiben kompatibel.

## Lieferkriterium

Die Umsetzung kann in überprüfbaren Schritten erfolgen. Zur fachlichen Abnahme wird ein zusammenhängender Stand mit allen neun Tabs, der vollständigen Filter- und Sortiermatrix und den Nachweisen aus `tasks.md` vorgelegt. Die Umstellung ist erst mit diesem Gesamtumfang abgeschlossen.
