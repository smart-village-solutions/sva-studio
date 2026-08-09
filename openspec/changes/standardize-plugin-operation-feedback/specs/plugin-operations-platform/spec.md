## ADDED Requirements

### Requirement: Plugin-Operations-Jobs liefern einen dauerhaften UI-Bezug

Die Plugin-Operations-Plattform MUST für angenommene Jobs eine stabile Job-ID und die für Fachkurzsicht, Monitoring und Detailansicht erforderlichen Status-, Progress-, Ergebnis- und Fehlerprojektionen bereitstellen.

#### Scenario: Fachbereich bindet einen gestarteten Job an

- **WHEN** ein Fachbereich einen generischen Plugin-Operations-Job startet
- **THEN** kann er den initialen Status und spätere Aktualisierungen über dieselbe stabile Job-ID laden
- **AND** muss das Plugin keinen parallelen Statusstore betreiben

### Requirement: Jobfolgeaktionen werden explizit als Hostvertrag exponiert

Die Plugin-Operations-Plattform MUST erlaubte Folgeaktionen wie Retry, Cancel, Ergebnisöffnung oder Download zustands- und berechtigungssicher über hostgeführte Verträge abbilden, bevor die UI sie anbietet.

#### Scenario: UI fragt zulässige Folgeaktionen ab

- **WHEN** ein Job in der Fachkurzsicht oder Detailansicht dargestellt wird
- **THEN** kann die UI aus dem Hostvertrag ableiten, welche Folgeaktionen im aktuellen Zustand zulässig sind
- **AND** erfindet sie keine Aktion allein aus einem Statusstring oder pluginlokaler Konvention
