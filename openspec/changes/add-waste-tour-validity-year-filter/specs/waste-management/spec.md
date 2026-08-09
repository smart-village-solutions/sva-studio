## ADDED Requirements

### Requirement: Waste-Touren können nach relativem Gültigkeitsjahr gefiltert werden

Das System SHALL in der Tourenübersicht einen reload-stabilen Filter für alle Touren, das letzte, das aktuelle oder das nächste Kalenderjahr bereitstellen und initial alle Touren anzeigen.

#### Scenario: Tourenübersicht startet ohne Jahreseinschränkung

- **WHEN** ein Benutzer die Tourenübersicht ohne gesetzten Jahresfilter öffnet
- **THEN** zeigt das System unabhängig vom Gültigkeitsjahr alle Touren an, die den übrigen Filtern entsprechen
- **AND** die Auswahl `Alle Touren` ist aktiv

#### Scenario: Gültigkeitszeitraum überschneidet das ausgewählte Jahr

- **GIVEN** ein Benutzer hat das letzte, aktuelle oder nächste Kalenderjahr ausgewählt
- **WHEN** der Gültigkeitszeitraum einer Tour das ausgewählte Jahr mindestens an einem Kalendertag überschneidet
- **THEN** zeigt das System die Tour an
- **AND** ein fehlender Gültigkeitsbeginn oder ein fehlendes Gültigkeitsende wird als offene Grenze behandelt
- **AND** der 1. Januar und der 31. Dezember gehören zum ausgewählten Zeitraum

#### Scenario: Expliziter Termin liegt im ausgewählten Jahr

- **GIVEN** ein Benutzer hat das letzte, aktuelle oder nächste Kalenderjahr ausgewählt
- **WHEN** mindestens ein expliziter Termin einer Tour im ausgewählten Kalenderjahr liegt
- **THEN** zeigt das System die Tour unabhängig von einer zusätzlichen Gültigkeitsüberschneidung an

#### Scenario: Tour hat weder passende Gültigkeit noch passenden Termin

- **GIVEN** ein Benutzer hat das letzte, aktuelle oder nächste Kalenderjahr ausgewählt
- **WHEN** der Gültigkeitszeitraum einer Tour das ausgewählte Jahr nicht überschneidet
- **AND** kein expliziter Termin der Tour im ausgewählten Jahr liegt
- **THEN** blendet das System die Tour aus

#### Scenario: Jahresfilter bleibt mit bestehenden Filtern kombinierbar

- **WHEN** ein Benutzer den Jahresfilter gemeinsam mit Name, Status, Abfallart oder freien Datumsgrenzen setzt
- **THEN** wendet das System alle gesetzten Kriterien gemeinsam an
- **AND** speichert den relativen Jahresfilter als typisierten Search-Parameter
- **AND** setzt die Listenseite bei einer Änderung des Jahresfilters auf Seite 1 zurück
- **AND** normalisiert einen ungültigen Jahresfilterwert auf `Alle Touren`
