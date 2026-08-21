# Change: IAM-Medienruntime vereinfachen und stabilisieren

## Why

Die HTTP-Laufzeit des Medienmanagements bündelt Handler, Validierung, Storage-Zugriffe, Upload-Verarbeitung und Listenlogik in einer sehr großen Datei. Wiederholte Request-Abläufe, Offset-Paginierung über vollständig geladene Buckets und externe Storage-Arbeit innerhalb langer DB-Transaktionen erhöhen Komplexität und Fehlerrisiko.

## What Changes

- teilt die IAM-Medienhandler entlang der vorhandenen fachlichen Verantwortungen auf und belässt `core.ts` als stabile Kompositionsfassade
- zentralisiert nur tatsächlich wiederholte Request-, Schema-, Autorisierungs- und Fehlerlogik
- **BREAKING** ersetzt die Medienlistenparameter `page`/`pageSize` und die exakte Gesamtzahl durch einen opaken Storage-Key-Cursor
- verwendet für Bucket-Dateien eine effiziente Präfixsuche und eine stabile Storage-Key-Reihenfolge
- nutzt den bestehenden Upload-Status `uploaded` als atomaren synchronen Verarbeitungs-Claim mit zeitlich begrenzter, lazy erneuerbarer Lease
- verschiebt S3- und Bildverarbeitung aus der DB-Transaktion und finalisiert Asset, Varianten, Session und tatsächliche Speichernutzung atomar
- dokumentiert den extern garantierten Vertrag eines isolierten Buckets je Tenant und entfernt darauf basierende fremdmandantenbezogene Storage-Key-Heuristiken
- führt keine neue Dependency, Job-Plattform, Inventartabelle oder generisches Handler-Framework ein

## Impact

- Affected specs: `media-management`
- Affected code:
  - `packages/auth-runtime/src/iam-media/*`
  - `packages/data-repositories/src/media/*`
  - `apps/sva-studio-react/src/lib/iam-api.ts`, Medien-Hook und Medienbibliothek
- Affected arc42 sections: 05 Bausteinsicht, 06 Laufzeitsicht und 08 Querschnittliche Konzepte
- Related changes: `add-media-async-processing` und `extend-media-management-governance` bleiben unberührt; dieser Change implementiert ausschließlich den synchronen Medienpfad
