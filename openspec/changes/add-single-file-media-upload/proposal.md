# Change: Direkten Single-File-Medienupload im Studio ergaenzen

## Why
Der aktuelle Medien-Flow im Studio materialisiert vor allem die technische Upload-Initialisierung und zeigt die signierte Upload-URL an, fuehrt den eigentlichen Datei-Upload aus der Bibliothek heraus aber nicht fuer Redakteure aus. Fuer den ersten produktiven Enduser-Pfad ist wichtiger, dass eine einzelne Datei direkt aus dem Studio erfolgreich nach S3 hochgeladen und anschliessend als nutzbares Medienobjekt mit Minimalmetadaten im Host persistiert wird.

## What Changes
- Ergaenzt im hostseitigen Einstieg `/admin/media` einen direkten Single-File-Upload-Flow fuer genau eine Datei
- Verknuepft Upload-Initialisierung, Browser-Upload an den signierten S3-/MinIO-Pfad und anschliessende Finalisierung als ein zusammenhaengender Enduser-Flow
- Persistiert nach erfolgreichem Upload ein `MediaAsset` mit Minimaldaten wie `storageKey`, `fileName`, `mimeType`, `byteSize`, Default-`visibility` und optional aus dem Dateinamen abgeleitetem Titel
- Leitet den Benutzer nach erfolgreicher Finalisierung direkt in die Mediendetailansicht weiter, statt technische Upload-Artefakte als primaeren UI-Ausgang zu zeigen
- Trennt sichtbare Fehlerpfade fuer Initialisierung, Binär-Upload und Finalisierung/Persistierung

## Impact
- Affected specs: `media-management`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/media/*`
  - `apps/sva-studio-react/src/hooks/use-media.ts`
  - `packages/sva-mainserver/src/**/media*` bzw. bestehende Media-Upload- und Persistenzpfade
  - zugehoerige API-Vertraege in `apps/sva-studio-react/src/lib/iam-api.*`
- Affected arc42 sections:
  - `05-building-block-view`
  - `08-cross-cutting-concepts`
  - `09-architecture-decisions`
