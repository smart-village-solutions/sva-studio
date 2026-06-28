# Umsetzungsplan: POI-Medien-Upload

## Ziel

Der Button `Medium hochladen` im POI-Editor lädt Bilddateien über den Host-Medienadapter hoch und übernimmt danach nur dauerhaft nutzbare öffentliche Medien-URLs in `mediaContents`.

## Architektur

`plugin-poi` bleibt vom App-spezifischen Medien-Hook entkoppelt. `PoiDetailPage` stellt den Adapter über `uploadHostMediaFile` bereit. `PoiDetailMediaTab` verwaltet UI-Zustand, Fehleranzeige und das Anhängen des zurückgegebenen Assets.

## Dateien

- `packages/plugin-poi/src/poi.detail-page.tsx`
- `packages/plugin-poi/src/poi.detail-media-tab.tsx`
- `packages/plugin-poi/src/poi.detail-media.helpers.ts`
- `packages/plugin-poi/src/poi.detail-media-library-dialog.tsx`
- `packages/plugin-poi/src/poi.detail-media-list.tsx`
- `packages/plugin-poi/src/poi.detail-media-preview.tsx`
- `packages/plugin-poi/src/plugin.translations.de.ts`
- `packages/plugin-poi/src/plugin.translations.en.ts`
- `packages/plugin-poi/tests/poi.detail-page.test.tsx`

## Aufgaben

- [x] Upload-Zustände und Validierung für JPG, PNG und WebP ergänzen.
- [x] Hochgeladene Assets nach dem Refresh als POI-`mediaContents` übernehmen.
- [x] Fehlerfälle ohne Änderung an bestehenden `mediaContents` anzeigen.
- [x] Medienbibliothek auf öffentliche Assets mit nutzbarer URL begrenzen.
- [x] Bereits ausgewählte Medien im Picker ausblenden.
- [x] Upload-Status bei Dialogöffnung, manueller Ergänzung, Auswahl und Entfernen zurücksetzen.
- [x] Tests für Upload-Erfolg, Upload-Fehler und Medienauswahl ergänzen.
- [x] Gezielte Unit-, Type- und Complexity-Gates nachziehen.
