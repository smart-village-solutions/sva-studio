# Change: Generische Tour-Einsätze mit mehreren Abholorten

## Why

Explizite Tourtermine sind bisher an genau einen Abholort gebunden. Schadstoffmobil-Einsätze benötigen jedoch einen gemeinsamen Termin mit mehreren, auch übergeordneten Abholorten und einem optionalen gemeinsamen Hinweis. Der Kalender muss diese Einsätze weiterhin über die normalen Abfallfraktionen filtern.

## What Changes

- Neue Einsatzentität für Tour, Datum und optionalen Hinweis sowie eine Zuordnungstabelle für mehrere Abholorte.
- Additive, idempotente Migration der bisherigen ortsbezogenen Einzeltermine.
- Generische Einsatzpflege in der bestehenden Tour-/Scheduling-Oberfläche und über die bestehende Scheduling-Aktion.
- Importgruppierung über eine Einsatzkennung.
- Öffentliche Ortsauflösung einschließlich übergeordneter Abholorte und fraktionsbasierte Kalenderausgabe.

## Impact

- Affected specs: `waste-management`, `public-waste-calendar`
- Affected code: Waste-Schema, Core- und Repository-Verträge, Auth-Runtime, Studio-Plugin, Mainserver-Sync, Public-Waste-App
- Affected arc42 sections: 05 Bausteinsicht, 06 Laufzeitsicht, 08 Querschnittliche Konzepte
