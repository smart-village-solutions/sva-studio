# Change: Öffentlichen Abholortkatalog ergänzen

## Why

Ein externer Abgleich kann Termine bereits über den öffentlichen Kalenderendpunkt laden, muss dafür aber zuerst alle vollständigen Abholort-Auswahlen kennen. Der bestehende schrittweise Auswahlfluss liefert diese Gesamtliste nicht als eigenständigen Vertrag. Gleichzeitig dürfen fehlende geografische Ebenen nicht durch erfundene Werte ergänzt oder vorhandene Waste-Daten für den Abgleich verändert werden.

## What Changes

- ergänzt `GET /api/public-waste/locations` als öffentlichen, ausschließlich lesenden Endpunkt der bestehenden Public-Waste-Runtime
- liefert pro eindeutiger vorhandener Abholortkombination die technischen IDs, Originalbezeichnungen und direkt nutzbaren Parameter für `GET /api/public-waste/calendar`
- projiziert eine vorhandene Region als `municipality` und einen vorhandenen Ort als `district`
- gibt `municipality: null`, `mappingComplete: false` und `missingFields: ["municipality"]` aus, wenn keine Region vorhanden ist
- verwendet keine Fallback-Gemeinde, keine doppelte Belegung von Gemeinde und Ortsteil und keine sonstige künstliche Ergänzung
- bildet vorhandene orts-, straßen- oder hausnummerweite Abholorte mit der bereits etablierten öffentlichen `all`-Semantik ab
- lässt den bestehenden Kalenderendpunkt und seine Terminberechnung unverändert; Verbraucher verbinden Ortskatalog und Kalenderantwort anhand der gelieferten `calendarQuery`
- verändert weder Waste-Fachdaten noch Datenbankschema, Importverträge oder redaktionelle Pflege

## Impact

- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web`
- Affected docs: öffentliche Waste-API-Dokumentation und Changelog
- Affected arc42 sections:
  - `docs/architecture/03-context-and-scope.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
- Keine Änderung an `docs/development/studio-db-schema-final.sql` oder `docs/development/studio-db-schema.md`, weil der Change ausschließlich bestehende Daten liest und projiziert.
- Der geschützte Waste-Datenaustausch für Testumgebungen bleibt eine getrennte Capability; der Ortskatalog ist weder Import-/Exportprofil noch Tenant-Klon.
