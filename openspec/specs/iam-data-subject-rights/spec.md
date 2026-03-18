# iam-data-subject-rights Specification

## Purpose
TBD - created by archiving change add-iam-data-subject-rights. Update Purpose after archive.
## Requirements
### Requirement: Recht auf Auskunft (Art. 15 DSGVO)

Das System SHALL Benutzern die Möglichkeit geben, eine vollständige Auskunft über ihre gespeicherten personenbezogenen Daten zu erhalten.

#### Scenario: Selbstauskunft über API

- **WHEN** ein authentifizierter Benutzer `GET /iam/me/data-export` aufruft
- **THEN** erhält er eine vollständige Auflistung aller zu ihm gespeicherten IAM-Daten
- **AND** die Antwort enthält mindestens Account-Daten, Organisationszuordnungen, Rollenzuweisungen
- **AND** die Daten sind in einem maschinenlesbaren Format (JSON) strukturiert

#### Scenario: Auskunft durch Administrator

- **WHEN** ein berechtigter Administrator eine Auskunftsanfrage für einen Benutzer bearbeitet
- **THEN** kann er die vollständigen Daten des Benutzers exportieren
- **AND** die Auskunftsanfrage wird als Audit-Event protokolliert

### Requirement: Recht auf Berichtigung (Art. 16 DSGVO)

Das System SHALL Benutzern die Korrektur unrichtiger personenbezogener Daten ermöglichen.

#### Scenario: Selbstkorrektur durch Benutzer

- **WHEN** ein Benutzer seine Profildaten korrigiert
- **THEN** werden die Änderungen gespeichert
- **AND** die Änderung wird als Audit-Event mit pseudonymisierten Referenzen protokolliert

### Requirement: Recht auf Löschung (Art. 17 DSGVO)

Das System SHALL eine vollständige Löschung personenbezogener Daten eines Benutzers ermöglichen, unter Berücksichtigung gesetzlicher Aufbewahrungspflichten.

#### Scenario: Account-Löschung durch Benutzer

- **WHEN** ein Benutzer die Löschung seines Accounts beantragt
- **THEN** wird der Account zunächst als Soft-Delete markiert
- **AND** nach Ablauf der konfigurierbaren Karenzzeit erfolgt die endgültige Löschung
- **AND** zugehörige IAM-Daten werden kaskadierend entfernt
- **AND** Audit-Log-Einträge des Benutzers werden pseudonymisiert

#### Scenario: Löschung bei aktivem Legal Hold

- **WHEN** ein Löschantrag vorliegt
- **AND** ein Legal Hold für den Benutzer aktiv ist
- **THEN** wird die Löschung blockiert
- **AND** die Löschung wird erst nach Aufhebung des Legal Holds fortgesetzt

### Requirement: Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)

Das System SHALL die Verarbeitung personenbezogener IAM-Daten auf Antrag einschränken können.

#### Scenario: Verarbeitung wird eingeschränkt

- **WHEN** ein Benutzer eine gültige Einschränkungsanfrage stellt
- **THEN** werden nicht zwingend erforderliche Verarbeitungsvorgänge für die betroffenen Daten ausgesetzt
- **AND** der Datensatz wird mit einem restriktiven Verarbeitungsstatus markiert
- **AND** alle Statusänderungen werden auditierbar protokolliert

### Requirement: Mitteilungspflicht bei Berichtigung/Löschung/Einschränkung (Art. 19 DSGVO)

Das System SHALL nachvollziehbar dokumentieren, dass relevante Empfänger über Berichtigung, Löschung oder Einschränkung informiert wurden, sofern gesetzlich erforderlich.

#### Scenario: Empfängerbenachrichtigung wird nachgewiesen

- **WHEN** eine Berichtigung, Löschung oder Einschränkung wirksam wird
- **THEN** werden betroffene Empfängerklassen gemäß Verarbeitungsmodell ermittelt
- **AND** die erfolgte oder begründet entfallene Benachrichtigung wird mit Zeitpunkt und Ergebnis protokolliert

### Requirement: Recht auf Datenportabilität (Art. 20 DSGVO)

Das System SHALL Benutzern den Export ihrer personenbezogenen Daten in maschinenlesbaren Formaten ermöglichen.

#### Scenario: Datenexport in verschiedenen Formaten

- **WHEN** ein Benutzer `GET /iam/me/data-export?format={json|csv|xml}` aufruft
- **THEN** erhält er seine Daten im gewünschten Format
- **AND** die exportierten Daten sind vollständig und konsistent

#### Scenario: Asynchroner Export mit Statusverfolgung

- **WHEN** ein Export aufgrund Datenumfangs asynchron verarbeitet wird
- **THEN** erhält der Benutzer einen eindeutig referenzierbaren Export-Request
- **AND** der Bearbeitungsstatus ist als `queued|processing|completed|failed` nachvollziehbar
- **AND** bei Status `completed` steht das angeforderte Zielformat zum Abruf bereit

### Requirement: Recht auf Widerspruch (Art. 21 DSGVO)

Das System SHALL Benutzern den Widerspruch gegen nicht zwingend erforderliche Datenverarbeitungen ermöglichen.

#### Scenario: Widerspruch gegen optionale Verarbeitung

- **WHEN** ein Benutzer einer optionalen Datenverarbeitung widerspricht
- **THEN** wird die betroffene Verarbeitung für den Benutzer deaktiviert
- **AND** der Widerspruch wird revisionssicher protokolliert

### Requirement: Konfigurierbare Löschfristen

Das System SHALL konfigurierbare Aufbewahrungsfristen für verschiedene Datenarten unterstützen.

#### Scenario: Ablauf einer Löschfrist

- **WHEN** ein zur Löschung vorgemerkter Datensatz die konfigurierte Karenzzeit erreicht
- **AND** kein Legal Hold aktiv ist
- **THEN** wird der Datensatz endgültig gelöscht
- **AND** die Löschung wird protokolliert

#### Scenario: Konfiguration der Löschfristen

- **WHEN** ein Administrator die Löschfrist für Account-Daten konfiguriert
- **THEN** wird der neue Wert für zukünftige Löschvorgänge wirksam
- **AND** die Änderung wird als Audit-Event protokolliert

### Requirement: 48h-SLA für Löschanträge

Das System SHALL für gültige Löschanträge eine Sperrung und Soft-Delete-Markierung innerhalb von 48 Stunden sicherstellen.

#### Scenario: SLA-konforme Löschvorbereitung

- **WHEN** ein gültiger Löschantrag angenommen wird
- **THEN** wird der Account innerhalb von maximal 48 Stunden gesperrt und als Soft-Delete markiert
- **AND** der Zeitstempel für Antragseingang und Soft-Delete ist auditierbar gespeichert

#### Scenario: SLA-Verstoß führt zu Eskalation

- **WHEN** die 48-Stunden-Grenze ohne Soft-Delete überschritten wird
- **THEN** wird automatisch ein Eskalationsereignis erzeugt
- **AND** der Verstoß ist im Monitoring und Audit-Trail nachvollziehbar

### Requirement: UI-gestützte Betroffenenrechtsprozesse

Das System SHALL Betroffenenrechtsprozesse nicht nur per API, sondern auch über nachvollziehbare Self-Service- und Admin-Oberflächen bereitstellen.

#### Scenario: Self-Service zeigt Anträge und Exportstatus

- **WHEN** ein authentifizierter Benutzer die Datenschutz-Oberfläche seines Accounts öffnet
- **THEN** sieht er seine Betroffenenanfragen und Export-Jobs mit Status, Zeitstempeln und Ergebnis
- **AND** blockierende Umstände wie Legal Holds oder Verarbeitungseinschränkungen sind verständlich kenntlich gemacht

#### Scenario: Export-Starts sind gegen CSRF und unbeabsichtigte GET-Aufrufe gehärtet

- **WHEN** ein Self-Service- oder Admin-Export gestartet wird
- **THEN** erfolgt der Start ausschließlich über `POST`
- **AND** der Request verlangt CSRF-konformen Browser-Kontext und einen `Idempotency-Key`
- **AND** Legacy-`GET` auf den Export-Start-Endpunkten liefert `405 Method Not Allowed`

#### Scenario: Admin-UI zeigt bearbeitbare DSR-Fälle

- **WHEN** ein berechtigter Administrator die DSR-Sicht im IAM-Cockpit öffnet
- **THEN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen in filterbaren Listen
- **AND** die Oberfläche unterstützt Drill-downs für Statuswechsel, Fristen und Audit-relevante Metadaten

#### Scenario: Unberechtigter Admin-Zugriff auf DSR-Fälle wird sicher abgefangen

- **WHEN** ein Administrator ohne DSR-Berechtigung die DSR-Sicht öffnet
- **THEN** wird ein verweigerter Zustand angezeigt
- **AND** personenbezogene Details aus DSR-Fällen werden nicht offengelegt

#### Scenario: Statuswechsel in DSR-Fällen sind nachvollziehbar und handlungsleitend

- **WHEN** ein berechtigter Administrator den Status eines DSR-Falls ändert
- **THEN** zeigt die UI den neuen Status samt Zeitstempel und nächster erwarteter Aktion
- **AND** bei Konflikt oder Validierungsfehler erhält der Administrator eine konkrete, umsetzbare Fehlerrückmeldung

#### Scenario: Optionale Verarbeitung ist für Betroffene sichtbar

- **WHEN** ein Benutzer der optionalen Verarbeitung widersprochen hat oder eine Einschränkung aktiv ist
- **THEN** zeigt die UI den aktuellen Verarbeitungsstatus und dessen Wirksamkeit an
- **AND** der Benutzer muss den Zustand nicht aus technischen API-Rohdaten ableiten

#### Scenario: DSR-Statusmodell ist UI-seitig konsistent abbildbar

- **WHEN** DSR-Requests und Export-Jobs in Self-Service oder Admin-UI dargestellt werden
- **THEN** verwenden beide Oberflächen ein kanonisches Statusmodell mit klaren Übergängen (z. B. `queued`, `in_progress`, `completed`, `blocked`, `failed`)
- **AND** Statusmeldungen enthalten eine verständliche Bedeutung für den nächsten Nutzer- oder Admin-Schritt

