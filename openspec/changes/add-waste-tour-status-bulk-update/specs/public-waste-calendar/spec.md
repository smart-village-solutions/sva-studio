## ADDED Requirements

### Requirement: Öffentliche Waste-Ausgaben verwenden ausschließlich veröffentlichte Touren

Das System MUST Touren und ihre Termine in öffentlichen Waste-Ausgaben ausschließlich dann
berücksichtigen, wenn die Tour den Status `published` besitzt. Touren im Status `draft` oder
`archived` MUST unabhängig von ihren Terminen und Zuordnungen ausgeschlossen bleiben.

#### Scenario: Veröffentlichte Tour wird öffentlich ausgegeben

- **WHEN** eine einem aktiven Abholort zugeordnete Tour den Status `published` besitzt
- **THEN** darf das System ihre gültigen Termine in Webansicht, PDF, iCal und Reminderprojektion
  berücksichtigen

#### Scenario: Entwurf besitzt bereits vollständige Termine

- **WHEN** eine Tour im Status `draft` gültige Termine und aktive Abholortzuordnungen besitzt
- **THEN** erscheint sie weder in Webansicht, PDF noch iCal
- **AND** erzeugt sie keine öffentliche Reminderprojektion

#### Scenario: Veröffentlichte Tour wird archiviert

- **WHEN** eine zuvor veröffentlichte Tour auf `archived` gesetzt wird
- **THEN** liefern nachfolgende öffentliche Lesezugriffe keine Termine dieser Tour mehr
- **AND** bleiben andere veröffentlichte Touren unverändert verfügbar

#### Scenario: Unbekannter Tourstatus wird gelesen

- **WHEN** die öffentliche Runtime einen unbekannten oder ungültigen Tourstatus vorfindet
- **THEN** behandelt sie die Tour fail-closed als nicht veröffentlicht
- **AND** gibt sie keine Termine dieser Tour aus
