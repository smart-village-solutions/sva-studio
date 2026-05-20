## MODIFIED Requirements

### Requirement: UI-gestützte Betroffenenrechtsprozesse

Das System SHALL Betroffenenrechtsprozesse nicht nur per API, sondern auch über nachvollziehbare Self-Service- und Admin-Oberflächen bereitstellen.

#### Scenario: Admin-UI zeigt bearbeitbare DSR-Fälle

- **WHEN** ein berechtigter Administrator die DSR-Sicht im IAM-Cockpit öffnet
- **THEN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen in filterbaren, tabellarischen Listen
- **AND** die Übersicht unterstützt Drill-downs auf separate Detailseiten für Statuswechsel, Fristen und Audit-relevante Metadaten

#### Scenario: Unberechtigter Admin-Zugriff auf DSR-Fälle wird sicher abgefangen

- **WHEN** ein Administrator ohne DSR-Berechtigung die DSR-Sicht öffnet
- **THEN** wird ein verweigerter Zustand angezeigt
- **AND** personenbezogene Details aus DSR-Fällen werden nicht offengelegt

#### Scenario: Statuswechsel in DSR-Fällen sind nachvollziehbar und handlungsleitend

- **WHEN** ein berechtigter Administrator den Status eines DSR-Falls ändert
- **THEN** zeigt die UI den neuen Status samt Zeitstempel und nächster erwarteter Aktion
- **AND** bei Konflikt oder Validierungsfehler erhält der Administrator eine konkrete, umsetzbare Fehlerrückmeldung

#### Scenario: DSR-Detailseite zeigt blockierende Umstände strukturiert

- **WHEN** ein berechtigter Administrator einen DSR-Fall auf dessen Detailseite öffnet
- **THEN** werden Blocker wie Legal Holds, fehlende Vorbedingungen oder restriktive Verarbeitungszustände strukturiert und verständlich dargestellt
- **AND** muss der Administrator diese Informationen nicht aus Rohmetadaten oder einer Listenzeile rekonstruieren
