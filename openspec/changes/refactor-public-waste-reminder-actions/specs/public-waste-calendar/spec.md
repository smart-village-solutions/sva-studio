## ADDED Requirements

### Requirement: Öffentliche Reminder-Actions prüfen Tokens vor jeder Mutation fail-closed

Das System SHALL konfigurierte Reminder-Statusseiten ohne Tokenverarbeitung ausliefern und DOI- sowie Abmeldeaktionen in getrennter, deterministischer Reihenfolge verarbeiten. Tokenformat, Kryptografie, Secretquelle und Repository-Verträge SHALL dabei unverändert bleiben.

#### Scenario: DOI-Aktion aktiviert nur nach vorhandenem Token

- **WHEN** ein Benutzer den DOI-Pfad ohne Token oder mit einem ungültigen beziehungsweise abgelaufenen Token aufruft
- **THEN** aktiviert das System kein Abo
- **AND** liefert es den konfigurierten Redirect oder die bestehende sichere Fallback-Seite

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
