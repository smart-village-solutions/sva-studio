# `fast-check`-Hotspots

## Startmenge

Der erste Batch konzentriert sich bewusst auf kleine, aber risikoreiche Normalisierungs- und Parserpfade ohne Host-/Plugin-Migration:

- `packages/routing/src/route-search.ts`
- `packages/routing/src/admin-resource-search-params.ts`
- `packages/core/src/waste-management-location-tour-pickup-date-import.ts`
- `packages/core/src/input-readers.ts`

## Erste Properties

### `packages/core/src/waste-management-location-tour-pickup-date-import.ts`

- Property: kanonische vierstellige UTC-Kalenderdaten im Format `YYYY-MM-DD` bleiben unter `normalizeWasteImportPickupDate` stabil.
- Begründung: Die Importpipeline hängt an einem strikten Datumsformat; Property-Tests sichern ab, dass gültige Tageswerte nicht versehentlich zurückgewiesen oder umformatiert werden.

### `packages/routing/src/admin-resource-search-params.ts`

- Property: deklarierte gültige Skalarwerte für `status`, `sort`, `page` und `pageSize` bleiben unter der Normalisierung erhalten; unsupported rohe Formen wie Arrays oder objektartige Werte kollabieren dagegen in den erlaubten Zustand und bleiben über die kanonische Query-Codierung stabil rekonstruierbar.
- Begründung: Die Search-Param-Normalisierung ist ein zentraler Adapter zwischen URL, UI-State und Backend-Abfragen; die Property sichert sowohl Nicht-Verlust gültiger URL-Zustände als auch robustes Abweisen nicht unterstützter Query-Formen ab.

## Nächste Hotspots

- `packages/routing/src/route-search.ts`: Idempotenz und Whitelisting für Tab-/Route-Normalisierung (`normalizeIamTab`, `normalizeRoleDetailTab`).
- `packages/core/src/input-readers.ts`: Reader-Invarianten für Trimming, Objektfilterung und erlaubte numerische Koerzierung.
