# Change: Direkten Single-File-Medienupload im Studio ergänzen

## Why
Der aktuelle Medien-Flow im Studio materialisiert vor allem die technische Upload-Initialisierung und zeigt die signierte Upload-URL an, führt den eigentlichen Datei-Upload aus der Bibliothek heraus aber nicht für Redakteure aus. Für den ersten produktiven Enduser-Pfad ist wichtiger, dass eine einzelne Datei direkt aus dem Studio erfolgreich nach S3 hochgeladen und anschließend als nutzbares Medienobjekt mit Minimalmetadaten im Host persistiert wird.

## What Changes
- Ergänzt im hostseitigen Einstieg `/admin/media` einen direkten Single-File-Upload-Flow für genau eine Datei
- Verknüpft Upload-Initialisierung, Browser-Upload an den signierten S3-/MinIO-Pfad und anschließende Finalisierung als ein zusammenhängender Enduser-Flow
- Persistiert nach erfolgreichem Upload ein `MediaAsset` mit Minimaldaten wie `storageKey`, `fileName`, `mimeType`, `byteSize`, Default-`visibility` und optional aus dem Dateinamen abgeleitetem Titel
- Leitet den Benutzer nach erfolgreicher Finalisierung direkt in die Mediendetailansicht weiter, statt technische Upload-Artefakte als primären UI-Ausgang zu zeigen
- Trennt sichtbare Fehlerpfade für Initialisierung, Binär-Upload und Finalisierung/Persistierung

## Impact
- Affected specs: `media-management`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/media/*`
  - `apps/sva-studio-react/src/hooks/use-media.ts`
  - `packages/sva-mainserver/src/**/media*` bzw. bestehende Media-Upload- und Persistenzpfade
  - zugehörige API-Verträge in `apps/sva-studio-react/src/lib/iam-api.*`
- Affected arc42 sections:
  - `05-building-block-view`
  - `08-cross-cutting-concepts`
  - `09-architecture-decisions`
