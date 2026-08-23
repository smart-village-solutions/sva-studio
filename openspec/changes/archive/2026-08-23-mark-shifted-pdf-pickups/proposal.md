# Change: Ausweichtermine im PDF-Abfallkalender kennzeichnen

## Why

Verschobene Abholungstermine sind im PDF derzeit nicht von regulären Terminen zu unterscheiden. Dadurch fehlt Leserinnen und Lesern ein wichtiger Hinweis auf abweichende Abholtage.

## What Changes

- Abholungen, deren wirksames Datum vom regulären Ursprungsdatum abweicht, werden im PDF unmittelbar rechts neben der farbigen Fraktionsbox mit einem roten, fetten Asterisk gekennzeichnet.
- Die Kennzeichnung gilt für manuelle Tour- und globale Datumsverschiebungen sowie für automatisch angewendete Feiertagsregeln.
- Die PDF-Legende erhält eine eigene Zeile `* = Ausweichtermin`.
- Der Asterisk liegt außerhalb der farbigen Box; nachfolgende Fraktionsboxen halten ausreichend Abstand zum Marker.
- Reguläre Termine bleiben unverändert.

## Impact

- Betroffene Specs: `public-waste-calendar`
- Betroffener Code: Terminberechnung und öffentlicher Kalendervertrag unter `apps/public-waste-calendar-web`, PDF-Dokumentmodell und Rendering unter `packages/core`
- Betroffene arc42-Abschnitte: keine; die bestehende Systemstruktur und ihre Verantwortungsgrenzen bleiben unverändert
