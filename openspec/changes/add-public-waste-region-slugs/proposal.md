# Change: Lesbare Regionslinks für den öffentlichen Abfallkalender

## Why

Regionsspezifische iFrame-Links dürfen keine Kenntnis interner UUIDs voraussetzen. Kommunen benötigen öffentliche URLs, die sie aus dem bekannten Regionsnamen ableiten, redaktionell prüfen und ohne technische IDs einbinden können.

## What Changes

- Die Weboberfläche akzeptiert eine Region als lesbaren Pfad-Slug, zum Beispiel `/amt-bad-wilsnack`.
- Ein öffentlicher Regionskatalog liefert die eindeutig auflösbaren Slugs und internen Regions-IDs.
- Unbekannte, ungültige oder doppeldeutige Slugs werden ohne ungefilterten Fallback abgelehnt.
- Bestehende `regionId`-Links bleiben als technischer Kompatibilitätspfad erhalten.

## Impact

- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web`
- Affected docs: `docs/reference/public-waste-api.md`
- Affected arc42 sections: keine; die bestehende App-, API- und Datenbankgrenze bleibt unverändert
