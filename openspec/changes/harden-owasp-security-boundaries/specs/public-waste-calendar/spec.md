## ADDED Requirements

### Requirement: Der öffentliche HTTP-Adapter begrenzt Request-Bodies beim Einlesen

Der bestehende HTTP-Adapter der öffentlichen Kalender-App MUST Request-Bodies unabhängig von Route, Content-Length und Übertragungsart auf 65.536 Bytes begrenzen. Er MUST die tatsächlich empfangenen Bytes während des Lesens prüfen und übergroße Anfragen mit HTTP 413 vor Aufruf des fachlichen Handlers ablehnen, ohne den beliebig großen Rest vollständig zu puffern oder zu drainen.

#### Scenario: Body an der Grenze bleibt zulässig

- **WHEN** ein Request höchstens 65.536 Body-Bytes übermittelt
- **THEN** kann der vorhandene Handler die Anfrage nach seinen bisherigen Validierungsregeln verarbeiten
- **AND** bleiben GET/HEAD und die bisherigen API-/Asset-CORS-Verträge erhalten

#### Scenario: Chunked-Request oder unbekannter Pfad umgeht das Limit nicht

- **WHEN** ein Request mehr als 65.536 Body-Bytes übermittelt oder eine größere gültige Content-Length deklariert
- **THEN** liefert der Adapter HTTP 413 ohne fachlichen Handleraufruf
- **AND** gilt dies auch ohne Content-Length, mit Chunked-Encoding oder für einen unbekannten Pfad
- **AND** wird der überschreitende Chunk nicht in den Body-Puffer übernommen
- **AND** bleibt die Ablehnung ohne vollständiges Einlesen des Restbodys zustellbar

## MODIFIED Requirements

### Requirement: Öffentliche Reminder-Actions prüfen Tokens vor jeder Mutation fail-closed

Das System SHALL konfigurierte Reminder-Statusseiten ohne Tokenverarbeitung ausliefern und DOI- sowie Abmeldeaktionen in getrennter, deterministischer Reihenfolge verarbeiten. Öffentliche DOI-Eingaben MUST als Roh-Token genau einmal gehasht werden; ein gespeicherter Token-Hash MUST nicht als alternativer öffentlicher Bestätigungstoken akzeptiert werden. Das Format regulär ausgestellter Roh-Tokens und gespeicherter Hashes, die Kryptografie der signierten Abmeldung, die Secretquelle und die Repository-Verträge SHALL erhalten bleiben.

#### Scenario: DOI-Aktion aktiviert nur nach vorhandenem Token

- **WHEN** ein Benutzer den DOI-Pfad ohne Token oder mit einem ungültigen beziehungsweise abgelaufenen Token aufruft
- **THEN** aktiviert das System kein Abo
- **AND** liefert es den konfigurierten Redirect oder die bestehende sichere Fallback-Seite

#### Scenario: Gespeicherter DOI-Digest ersetzt den Roh-Token nicht

- **GIVEN** zu einem gültigen DOI-Roh-Token ist ein SHA-256-Digest gespeichert
- **WHEN** die öffentliche DOI-Action den gespeicherten Wert `sha256:<64 Hexzeichen>` als Token erhält
- **THEN** hasht sie auch diesen Eingabewert und aktiviert damit nicht das Abo des ursprünglichen Roh-Tokens
- **AND** bleibt der ursprüngliche gültige Roh-Token über denselben Handler verwendbar

#### Scenario: Abmeldung mutiert erst nach vollständiger Signaturprüfung

- **WHEN** ein Abmeldetoken keine lesbare Subscription-ID besitzt, kein Abo gefunden wird oder die Signatur nicht zum gespeicherten Token-Hash passt
- **THEN** führt das System keine Abmeldemutation aus
- **AND** liefert es den konfigurierten Invalid-Token-Redirect oder die bestehende sichere Fallback-Seite

#### Scenario: Wiederholte Abmeldung bleibt idempotent

- **WHEN** ein gültiger Abmeldelink für ein bereits abgemeldetes Abo erneut aufgerufen wird
- **THEN** bleibt der Status `already_unsubscribed` erhalten
- **AND** Redirect, Statusseite und sichtbare Texte entsprechen weiterhin dem bestehenden Vertrag

#### Scenario: Konfigurierte Statusseite hat Vorrang vor Aktionsverarbeitung

- **WHEN** ein Request einen konfigurierten Aktivierungs-, Abmelde- oder Invalid-Token-Statuspfad adressiert
- **THEN** rendert das System die zugehörige Statusseite ohne Hash-, Lookup- oder Mutationsaufruf
