## ADDED Requirements

### Requirement: Cursorbasierte Medienbibliothek

Das System SHALL registrierte Medienassets und nicht registrierte Objekte des tenantgebundenen Buckets über einen gemeinsamen, versionierten Cursor in stabiler binärer S3-Storage-Key-Reihenfolge auflisten, ohne für jede Seite den gesamten Bucket oder eine exakte Gesamtzahl zu laden. Der Cursor SHALL nur Schlüssel überspringen, deren Bereich in beiden Quellen vollständig gelesen wurde. Das Listenlimit SHALL ganzzahlig zwischen 1 und 144 liegen, passend zu den angebotenen Seitengrößen der Oberfläche.

#### Scenario: Benutzer navigiert vorwärts und zurück

- **WHEN** ein berechtigter Benutzer die Medienbibliothek öffnet oder zur nächsten Ergebnismenge navigiert
- **THEN** liefert die API höchstens das angeforderte Limit sowie `nextCursor` und `hasNextPage`
- **AND** verwaltet der Client bereits besuchte Cursor für die Rückwärtsnavigation
- **AND** Änderungen an Suche, Sichtbarkeit oder Limit beginnen wieder beim ersten Cursor

#### Scenario: Registrierte und nicht registrierte Objekte werden zusammengeführt

- **WHEN** DB und Bucket denselben Storage-Key liefern
- **THEN** erscheint genau ein Eintrag in der Medienbibliothek
- **AND** die registrierten Asset-Metadaten sind führend
- **AND** die Reihenfolge ist über wiederholte Cursor-Aufrufe stabil

#### Scenario: Ausgefilterte Objekte am Ende einer begrenzten Bucket-Seite

- **WHEN** eine begrenzte Bucket-Seite überwiegend interne Varianten enthält und ein Datenbank-Asset hinter dem letzten gescannten Bucket-Key liegt
- **THEN** gibt das System das Datenbank-Asset erst aus, nachdem der Bucket bis zu dessen Storage-Key gelesen wurde
- **AND** setzt den Cursor auf einen von beiden Quellen vollständig gelesenen Storage-Key, sodass kein Bucket-Objekt übersprungen wird

#### Scenario: Bucket-Suche bleibt begrenzt

- **WHEN** ein Benutzer nach nicht registrierten Bucket-Objekten sucht
- **THEN** verwendet das System die normalisierte Suche als Storage-Key- oder Ordnerpräfix
- **AND** scannt die Anfrage nicht verpflichtend den gesamten Bucket für beliebige Teilstringtreffer
- **AND** registrierte Assets bleiben weiterhin über ihre Metadaten suchbar

### Requirement: Synchroner Upload besitzt einen atomaren Verarbeitungs-Claim

Das System SHALL genau einen synchronen Abschluss einer Upload-Session zur Verarbeitung zulassen und wiederholte oder konkurrierende Abschlüsse deterministisch behandeln. Jeder Claim SHALL ein eindeutiges Fencing-Token erhalten; die Finalisierung SHALL die Session sperren und dieses Token vor Quotenbuchung und Persistenz prüfen.

#### Scenario: Zwei Requests schließen dieselbe Session ab

- **WHEN** zwei autorisierte Requests gleichzeitig eine `pending` Upload-Session abschließen
- **THEN** darf genau ein Request die Session atomar nach `uploaded` überführen und verarbeiten
- **AND** der andere Request erhält einen eindeutigen In-Verarbeitung-Konflikt
- **AND** Speichernutzung und Asset-Anzahl werden nicht doppelt verbucht

#### Scenario: Validierter Abschluss wird wiederholt

- **WHEN** ein Client den Abschluss einer bereits validierten und bereiten Session wiederholt
- **THEN** antwortet das System idempotent mit dem erfolgreichen Ergebnis
- **AND** erzeugt keine weiteren Varianten oder Nutzungsbuchungen

#### Scenario: Unterbrochener Verarbeitungs-Claim wird erneut übernommen

- **GIVEN** eine Upload-Session befindet sich seit mindestens zehn Minuten unverändert im Status `uploaded`
- **AND** die ursprüngliche Upload-Session darf inzwischen abgelaufen sein
- **WHEN** ein autorisierter Client den Abschluss erneut aufruft
- **THEN** übernimmt das System den abgelaufenen Claim atomar und versucht die Verarbeitung erneut
- **AND** ein jüngerer `uploaded`-Claim bleibt exklusiv und liefert weiterhin einen In-Verarbeitung-Konflikt
- **AND** ein vom neuen Token abgelöster Verarbeiter darf weder Quotenbuchung und Datenbankfinalisierung noch Storage-Cleanup ausführen

### Requirement: Kurze und atomare Upload-Finalisierung

Das System SHALL externe Storage- und Bildverarbeitung außerhalb einer Datenbanktransaktion ausführen und den abschließenden Datenbankzustand anhand der tatsächlichen Objektgrößen atomar persistieren.

#### Scenario: Verarbeitung wird erfolgreich finalisiert

- **WHEN** Original und Varianten vollständig validiert und im Storage geschrieben wurden
- **THEN** prüft eine kurze Datenbanktransaktion das verbleibende Speicherkontingent anhand der tatsächlichen Bytes
- **AND** persistiert Speichernutzung, Varianten, bereites Asset und validierte Session gemeinsam
- **AND** ist kein externer Storage- oder Bildverarbeitungsaufruf innerhalb dieser Transaktion aktiv

#### Scenario: Tatsächliche Größe überschreitet das Kontingent

- **WHEN** die tatsächliche Original- und Variantengröße das verbleibende Kontingent überschreitet
- **THEN** wird keine teilweise erfolgreiche Datenbankfinalisierung sichtbar
- **AND** antwortet das System mit `storage_quota_exceeded`
- **AND** entfernt es Original und erzeugte Varianten bestmöglich aus dem Storage

### Requirement: Extern isolierter Tenant-Bucket

Das System SHALL den operativ garantierten Vertrag verwenden, dass jeder Tenant genau einen isolierten Bucket besitzt und ein Medienrequest keinen anderen Bucket auswählen kann.

#### Scenario: Storage-Key enthält ein tenantähnliches Präfix

- **WHEN** ein Storage-Key innerhalb des tenantgebundenen Buckets ein Präfix enthält, das wie eine andere Instanzkennung aussieht
- **THEN** wird er nicht allein anhand dieses Präfixes als fremdmandantig abgelehnt
- **AND** bleiben echte Domänenverbote wie interne Variantenpfade weiterhin wirksam
- **AND** wird Mandantentrennung durch Bucket-Auflösung und IAM-Scope erzwungen
