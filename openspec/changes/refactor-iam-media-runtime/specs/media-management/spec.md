## ADDED Requirements

### Requirement: Cursorbasierte Medienbibliothek

Das System SHALL registrierte Medienassets und nicht registrierte Objekte des tenantgebundenen Buckets über einen gemeinsamen, versionierten Cursor in stabiler Storage-Key-Reihenfolge auflisten, ohne für jede Seite den gesamten Bucket oder eine exakte Gesamtzahl zu laden.

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

#### Scenario: Bucket-Suche bleibt begrenzt

- **WHEN** ein Benutzer nach nicht registrierten Bucket-Objekten sucht
- **THEN** verwendet das System die normalisierte Suche als Storage-Key- oder Ordnerpräfix
- **AND** scannt die Anfrage nicht verpflichtend den gesamten Bucket für beliebige Teilstringtreffer
- **AND** registrierte Assets bleiben weiterhin über ihre Metadaten suchbar

### Requirement: Synchroner Upload besitzt einen atomaren Verarbeitungs-Claim

Das System SHALL genau einen synchronen Abschluss einer Upload-Session zur Verarbeitung zulassen und wiederholte oder konkurrierende Abschlüsse deterministisch behandeln.

#### Scenario: Zwei Requests schließen dieselbe Session ab

- **WHEN** zwei autorisierte Requests gleichzeitig eine `pending` Upload-Session abschließen
- **THEN** darf genau ein Request die Session atomar nach `uploaded` überführen und verarbeiten
- **AND** der andere Request erhält einen eindeutigen In-Verarbeitung-Konflikt
- **AND** Speichernutzung und Asset-Anzahl werden nicht doppelt verbucht

#### Scenario: Validierter Abschluss wird wiederholt

- **WHEN** ein Client den Abschluss einer bereits validierten und bereiten Session wiederholt
- **THEN** antwortet das System idempotent mit dem erfolgreichen Ergebnis
- **AND** erzeugt keine weiteren Varianten oder Nutzungsbuchungen

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
