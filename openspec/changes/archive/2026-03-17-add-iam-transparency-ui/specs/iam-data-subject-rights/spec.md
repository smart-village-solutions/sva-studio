## ADDED Requirements

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
