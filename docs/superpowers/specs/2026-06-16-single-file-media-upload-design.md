# Single-File-Medienupload im Studio

## Kontext

Das Studio besitzt bereits einen serverseitigen Upload-Vertrag fuer Medien:

1. `initialize upload` erstellt ein `MediaAsset` im Status `pending` sowie eine `uploadSession`
2. der Client laedt die Datei per signierter URL nach S3 bzw. MinIO
3. `complete upload` validiert den echten Dateiinhalt, erzeugt Varianten und markiert das Asset als `processed` bzw. `ready`

Die aktuelle UI beendet den sichtbaren Flow jedoch nach Schritt 1 und zeigt nur technische Upload-Artefakte an. Ziel dieses Changes ist es, den vorhandenen Vertrag vollstaendig im Frontend zu orchestrieren, statt gegen ihn zu arbeiten.

## Ziele

- Einen echten Enduser-Upload fuer genau eine Datei direkt aus `/admin/media` bereitstellen
- Den bestehenden Backend-Vertrag `initialize -> PUT -> complete` unveraendert nutzen
- Logging, Error-Handling, Testabdeckung, Performance und Codequalitaet explizit als Leitplanken behandeln
- Den Erfolgspfad auf `Datei auswaehlen -> Upload -> Finalisierung -> Detailansicht` reduzieren

## Nicht-Ziele

- Kein Mehrfachupload
- Kein neuer Upload-Grundvertrag im Backend
- Keine Pflicht-Metadaten vor dem Upload
- Keine Inline-Metadatenpflege in der Bibliothek
- Keine neue media-spezifische Retry- oder Job-Plattform

## Ziel-Flow

1. Der Benutzer waehlt in `/admin/media` genau eine Datei aus.
2. Das Frontend prueft nur minimale Clientbedingungen:
   - genau eine Datei
   - Dateigroesse vorhanden
   - MIME-Typ grundsaetzlich unterstuetzt
3. Das Frontend ruft `initialize upload` auf.
4. Bei Erfolg startet unmittelbar ein Browser-`PUT` auf die signierte Upload-URL.
5. Nach erfolgreichem `PUT` ruft das Frontend `complete upload` auf.
6. Bei erfolgreichem Abschluss navigiert die UI direkt nach `/admin/media/<assetId>`.
7. Bei Fehlern bleibt der Benutzer im Bibliothekskontext und sieht einen klar getrennten Fehlerzustand.

## Fachlicher Zustand

Der bestehende Serververtrag bleibt unveraendert:

- `initialize upload` erzeugt bereits ein `MediaAsset` und eine `uploadSession` mit Status `pending`
- `complete upload` validiert den echten Dateityp, liest technische Metadaten, erzeugt Varianten und setzt das Asset auf `processed` bzw. `ready`

Damit akzeptiert das System fuer Phase 1 bewusst, dass ein `pending`-Asset existieren kann, auch wenn der eigentliche Datei-Upload spaeter scheitert. Dieser Zustand gilt nicht als Architekturfehler, sondern als Bestandteil des vorhandenen Modells und muss in UI und Logging sauber behandelt werden.

## Logging

Das Frontend protokolliert den Upload in getrennten Phasen:

- `media_upload_initialize_started`
- `media_upload_initialize_failed`
- `media_upload_put_started`
- `media_upload_put_failed`
- `media_upload_complete_started`
- `media_upload_complete_failed`
- `media_upload_succeeded`

Sobald verfuegbar, sollen `assetId` und `uploadSessionId` mitgefuehrt werden. Signierte URLs, Request-Header mit sensitiven Daten oder Datei-Inhalte duerfen nicht geloggt werden.

## Error-Handling

Es gibt drei getrennte Fehlerklassen:

1. Initialisierung fehlgeschlagen
2. Datei-Upload per Browser fehlgeschlagen
3. Finalisierung bzw. serverseitige Verarbeitung fehlgeschlagen

Jede Klasse bekommt:

- einen eigenen UI-Status
- einen eigenen Log-Eintrag
- einen redigierten, fachlich verstaendlichen Fehlertext

Der Flow darf bei Fehlern nicht stillschweigend in einen Erfolgszustand kippen. Automatische verdeckte Retries werden fuer Phase 1 nicht eingefuehrt.

## Teststrategie

- API-Client-Tests fuer den neuen Frontend-Client `complete upload`
- Hook-/Orchestrierungs-Tests fuer `initialize -> PUT -> complete`
- UI-Tests fuer die Zustaende `idle`, `initializing`, `uploading`, `finalizing`, `success`, `error`
- E2E-Happy-Path fuer Single-File-Upload bis zur Detailansicht
- E2E- oder Integrationstests fuer die drei Fehlerpfade

## Performance

- Kein globaler Voll-Refetch der Bibliothek waehrend des Uploads
- Direkte Navigation zur Detailansicht nach Erfolg statt Vollreload
- Upload-Fortschritt darf keine unnoetige Render-Schleife erzeugen
- Keine Queue- oder Mehrfachdatei-Logik in Phase 1

## Codequalitaet

- Der Upload-Flow wird als klarer Orchestrator bzw. eigene Hook modelliert und nicht inline in die Seitenkomponente gekippt
- API-Aufrufe fuer `initialize` und `complete` bleiben explizit getrennt
- UI-Zustaende und Netzlogik werden sauber voneinander getrennt
- Bestehende i18n-, Error- und Logging-Muster aus `use-media.ts` und `iam-api.ts` werden wiederverwendet
- Keine Hardcodes fuer nutzersichtbare Texte

## Betroffene Stellen

- `apps/sva-studio-react/src/lib/iam-api.ts`
- `apps/sva-studio-react/src/hooks/use-media.ts`
- `apps/sva-studio-react/src/routes/admin/media/-media-intake-shelf.tsx`
- `apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx`
- `apps/sva-studio-react/src/i18n/resources/de/media.resources.ts`
- `apps/sva-studio-react/src/i18n/resources/en/media.resources.ts`

## Offene technische Pruefung fuer die Implementierung

Die relevante offene Frage liegt nicht mehr im Flow selbst, sondern in der Umgebung:

- Ob der direkte Browser-`PUT` gegen die signierte URL in der Zielumgebung CORS-seitig ohne Zusatzarbeit funktioniert, muss in der Implementierung bzw. Laufzeitumgebung verifiziert werden.
