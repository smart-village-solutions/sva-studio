# Unregistrierte Bucket-Dateien in der Medienverwaltung

## Kontext

Die bestehende Medienverwaltung zeigt ausschließlich Assets an, die als
Datensätze in `iam.media_assets` registriert sind. Dateien, die bereits im
konfigurierten S3-/Minio-Bucket liegen, aber keinen DB-Eintrag besitzen,
bleiben im Studio unsichtbar.

Für den schnellen ersten Ausbauschritt soll diese Lücke geschlossen werden,
ohne das bestehende Medienmodell, die Metadatenpflege oder die
Referenzverwaltung grundlegend umzubauen.

Der Fokus liegt ausdrücklich auf einer schnellen, risikoarmen Phase 1:

- dieselbe Medienliste statt separater Ansicht
- read-only für unregistrierte Dateien
- serverseitige Paginierung mit Default `25`
- flache Darstellung auch bei Bucket-Ordnern

## Ziele

- Die Medienbibliothek unter `/admin/media` zeigt registrierte Assets und
  unregistrierte Bucket-Dateien in derselben Liste.
- Unregistrierte Bucket-Dateien werden serverseitig aus dem Instanz-Prefix des
  konfigurierten Buckets gelesen.
- Die kombinierte Liste bleibt serverseitig paginiert; Default ist
  `pageSize = 25`.
- Die Darstellung bleibt flach, auch wenn Bucket-Objekte in Unterordnern
  liegen.
- Der aus `storageKey` ableitbare Ordner wird als Information in der UI
  angezeigt.
- Unregistrierte Einträge sind klar als nicht registriert markiert und in
  Phase 1 strikt read-only.

## Nicht-Ziele

- Keine automatische Registrierung von Bucket-Dateien in der Datenbank.
- Kein separater Bucket-Browser mit Ordnernavigation.
- Keine Bearbeitung, Löschung, Referenzierung oder Metadatenpflege für
  unregistrierte Einträge.
- Kein neuer persistenter Index oder Snapshot-Cache für Bucket-Inhalte in
  Phase 1.
- Keine Änderung des bestehenden Upload-Flows oder der S3-Schreibpfade.

## Bewertete Ansätze

### Ansatz A: Overlay in derselben Liste

Die bestehende API liefert weiterhin DB-Assets und ergänzt zusätzlich
unregistrierte Bucket-Objekte als synthetische Read-only-Einträge.

Vorteile:

- schnellster Umsetzungsweg
- minimale Eingriffe in bestehende Medienlogik
- keine neue Route und kein neues Bedienmodell

Nachteile:

- serverseitiges Merging und Paging ist aufwändiger als die heutige reine
  DB-Liste
- späte Seiten können bei großen Buckets teurer werden

### Ansatz B: separater Tab oder Filtermodus

Bucket-Funde würden nur in einem separaten UI-Modus angezeigt.

Vorteile:

- einfachere Trennung in der UI
- geringerer Druck auf bestehende Komponenten

Nachteile:

- widerspricht dem gewünschten Ergebnis „in derselben Liste“
- schlechtere Vergleichbarkeit zwischen registrierten und unregistrierten
  Einträgen

### Ansatz C: Hintergrund-Synchronisierung vor Anzeige

Ein Job oder Importpfad würde Bucket-Dateien zuerst registrieren oder
zwischenspeichern, bevor die UI sie anzeigt.

Vorteile:

- langfristig bessere Grundlage für Skalierung und exakte Paging-Modelle

Nachteile:

- deutlich höherer Initialaufwand
- unnötig schwergewichtig für den schnellen Phase-1-Bedarf

## Entscheidung

Es wird Ansatz A umgesetzt.

Die bestehende Medienliste bleibt die führende Oberfläche. Das Backend ergänzt
unregistrierte Bucket-Dateien als synthetische Read-only-Einträge und liefert
eine gemeinsam sortierte, serverseitig paginierte Ergebnisliste zurück.

## Datenmodell Phase 1

Die API für die Medienbibliothek wird um ein zweites Ergebnisprofil ergänzt:

### Registriertes Asset

Bestehendes Modell aus `iam.media_assets` inklusive vorhandener Metadaten,
Statusfelder und Aktionen.

### Unregistrierter Bucket-Eintrag

Ein synthetischer Read-only-Eintrag mit mindestens:

- `source = 'bucket'`
- `registrationStatus = 'unregistered'`
- `storageKey`
- `fileName`
- `folderPath`
- `byteSize`
- `lastModified`
- optional `previewUrl` oder `deliveryUrl`

Der Eintrag wird nicht als vollwertiges `iam.media_assets`-Objekt behandelt.
Er dient in Phase 1 ausschließlich der Sichtbarkeit und Orientierung.

## Backend-Design

### API-Verhalten

`GET /api/v1/iam/media` wird so erweitert, dass zusätzlich unregistrierte
Bucket-Dateien in die Antwort aufgenommen werden können.

Die Route bleibt der einzige Einstiegspunkt für die Medienlistenansicht.
Frontend und Rechteprüfung bleiben damit an der bestehenden Medien-API
angebunden.

### Bucket-Leseverhalten

Das Backend liest Bucket-Objekte nur innerhalb des Instanz-Prefixes, also
typisch unter:

- `<instanceId>/`

Es wird kein bucket-weites Root-Browsing eingeführt.

Zum Lesen wird `ListObjectsV2` verwendet. Objekte werden anhand ihres
`storageKey` mit den registrierten DB-Assets abgeglichen. Existiert kein
passender DB-Eintrag, wird ein synthetischer Eintrag erzeugt.

### Paginierung

Die kombinierte Liste wird serverseitig paginiert. Default ist:

- `page = 1`
- `pageSize = 25`

Die Paginierung darf nicht dadurch entstehen, dass das Frontend große
Ergebnislisten vollständig lädt und lokal beschneidet.

Für die schnelle Umsetzung wird ein pragmatisches Overfetching-Modell
verwendet:

- DB-Assets werden wie bisher seitenweise geladen
- Bucket-Objekte werden seitenweise nachgeladen
- das Backend traversiert so viele Bucket-Seiten, bis genug zusätzliche
  unregistrierte Kandidaten für die gewünschte kombinierte Seite vorhanden
  sind oder das Prefix erschöpft ist

Diese Lösung ist für Phase 1 akzeptabel, auch wenn sie bei sehr großen
Buckets auf späten Seiten teurer sein kann.

### Sortierung

Die kombinierte Liste wird flach und gemeinsam sortiert nach:

- `updatedAt DESC` für registrierte Assets
- `lastModified DESC` für unregistrierte Bucket-Dateien

Für das Merge-Verhalten wird beides auf einen gemeinsamen sortierbaren
Zeitwert normalisiert.

### Ordner und Pfadlogik

Bucket-Objekte können in Unterordnern liegen. Die UI bleibt trotzdem flach.

Aus dem `storageKey` werden daher zusätzlich folgende Anzeigeinformationen
abgeleitet:

- `fileName`: letzter Segmentname
- `folderPath`: relativer Ordnerpfad innerhalb des Instanz-Prefixes

Beispiel:

- `storageKey = de-musterhausen/uploads/2026/06/bild.jpg`
- `fileName = bild.jpg`
- `folderPath = uploads/2026/06`

Dasselbe Ableitungsschema wird auch für registrierte Assets verwendet, damit
die Karten konsistent aussehen.

### Sicherheits- und Rechteverhalten

Die bestehende Medienberechtigung `media.read` bleibt führend.

Unregistrierte Einträge dürfen in Phase 1 nicht:

- bearbeitet werden
- gelöscht werden
- referenziert werden
- in Metadaten- oder Detail-Workflows als vollwertige Assets eingehen

Falls Preview- oder Delivery-Links angeboten werden, müssen sie denselben
Storage- und Sichtbarkeitsregeln folgen wie bestehende Medienobjekte oder auf
einen klar read-only Downloadpfad begrenzt werden.

## Frontend-Design

### Medienliste

Die bestehende Medienbibliothek rendert registrierte Assets und
unregistrierte Bucket-Einträge in demselben Grid.

Unregistrierte Einträge werden sichtbar gekennzeichnet, zum Beispiel mit einem
Badge:

- `Nicht registriert`

### Karteninformationen

Für alle Einträge wird zusätzlich der aus `storageKey` abgeleitete Ordner
angezeigt.

Unregistrierte Einträge zeigen in Phase 1 nur eine reduzierte Read-only-Karte
mit:

- Dateiname
- Ordner
- vollständigem Pfad oder `storageKey`
- Dateigröße
- letztem Änderungsdatum
- optional Preview-Link

Registrierte Assets behalten ihre bestehenden Status- und
Metadateninformationen.

### Interaktionen

Unregistrierte Einträge haben in Phase 1 keine aktiven Bearbeitungs- oder
Mutationsaktionen.

Die UI muss klar verhindern, dass Nutzer sie mit voll registrierten Assets
verwechseln. Der reduzierte Informationsumfang und das Badge sind dafür die
primären Mittel.

## Risiken und Trade-offs

- Große Buckets können das serverseitige Merge-Paging auf späten Seiten
  verteuern.
- Die flache Darstellung ist bewusst schneller umsetzbar als ein echter
  Ordnerbrowser, opfert aber Navigationskomfort für tief verschachtelte
  Bucket-Strukturen.
- Unregistrierte Einträge haben weniger fachliche Informationen als
  DB-Assets; die UI muss diese Asymmetrie sichtbar machen.
- Exakte kombinierte Gesamtzahlen können teurer werden, wenn dafür ein großer
  Teil des Buckets traversiert werden muss.

## Teststrategie

- Unit-Tests für die Ableitung von `fileName` und `folderPath` aus
  `storageKey`
- Unit-Tests für das Merge- und Sortierverhalten zwischen DB-Assets und
  Bucket-Einträgen
- Unit-Tests für serverseitige Paging-Logik mit Default `25`
- API-Tests für die erweiterte Listenroute
- Frontend-Tests für Badge, Read-only-Darstellung und flache Anzeige der
  Ordnerinformation

## Umsetzungsnotizen

Wahrscheinlich betroffene Bereiche:

- `packages/auth-runtime/src/iam-media/`
- `packages/data-repositories/src/media/`
- `apps/sva-studio-react/src/lib/iam-api.ts`
- `apps/sva-studio-react/src/hooks/use-media.ts`
- `apps/sva-studio-react/src/routes/admin/media/`
- `apps/sva-studio-react/src/i18n/resources.ts`

Die Architektur bleibt in Phase 1 absichtlich inkrementell. Wenn sich das
Overlay bewährt, kann Phase 2 einen robusteren Bucket-Index, bessere
Skalierungsstrategie oder eine explizite Registrierungsaktion ergänzen.
