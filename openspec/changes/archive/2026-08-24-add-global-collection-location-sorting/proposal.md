# Change: Abholorte serverseitig global nach Adresse sortieren

## Why

Die Abholort-Stammdatentabelle sortiert derzeit nur die bereits paginierte Seite nach einer einzelnen sichtbaren Spalte. Dadurch entsteht über mehrere Seiten keine fachlich verlässliche Reihenfolge nach Ort, Straße und Hausnummer. Issue #1126 verlangt stattdessen eine globale, deterministische Mehrfachsortierung des vollständigen gefilterten Bestands mit optional vorgeschalteter Region.

## What Changes

- Für die Abholortliste wird ein eigener hostgeführter Read-Model-Vertrag mit serverseitiger Filterung, Mehrfachsortierung, Gesamtzahl und Pagination eingeführt.
- Der Vertrag akzeptiert ausschließlich die Sortiermodi `address` und `addressWithRegion` sowie die Richtungen `asc` und `desc`; freie Feldnamen oder SQL-Ausdrücke werden abgewiesen.
- Die Standardsortierung lautet `Ort → Straße → Hausnummer → ID`; optional wird die Region als erstes Kriterium vorgeschaltet.
- Fehlende Adresswerte bleiben in beiden Richtungen hinter vorhandenen Werten. Die eindeutige Abholort-ID stabilisiert alle Gleichstände aufsteigend.
- Search-Params steuern Sortiermodus, Richtung, Filter, Seite und Seitengröße. Filter-, Sortier- und Seitengrößenwechsel setzen die Seite auf eins zurück.
- Desktop-Tabelle und schmale Darstellung verwenden denselben kontrollierten Sortierzustand. Die Tabelle sortiert die vom Server gelieferte Seite nicht erneut.
- Auswahlzustände bleiben an Abholort-IDs gebunden. Die Aktion „Alle gefilterten auswählen“ löst die IDs über denselben serverseitigen Filtervertrag auf und hängt nicht von der sichtbaren Seite ab.
- Der bestehende Master-Data-Overview bleibt vorerst für Adresshierarchie, Formulare und Fraktionsabdeckungsprüfung bestehen; er ist nicht mehr die führende Listenquelle der Abholorttabelle.
- Deutsche und englische Übersetzungen, Waste-Dokumentation sowie die betroffenen Architekturabschnitte werden aktualisiert.

## Impact

- Related issue: `#1126`
- Affected specs: `waste-management`
- Affected code: `packages/core`, `packages/plugin-sdk`, `packages/plugin-waste-management`, `packages/auth-runtime`, `packages/data-repositories`, `apps/sva-studio-react`
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`; `docs/architecture/08-cross-cutting-concepts.md` und `docs/architecture/10-quality-requirements.md` werden auf bereits vorhandene globale Listen- und Testverträge geprüft
- Database impact: keine neue Fachtabelle und keine gespeicherten Sortierschlüssel; eine versionierte Waste-Tenant-Migration legt die benannte ICU-Collation `sva_de_numeric` an, und Schema-Snapshot sowie Schemadokumentation werden im selben Implementierungsschritt aktualisiert
