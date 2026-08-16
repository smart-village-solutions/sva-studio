## MODIFIED Requirements

### Requirement: Tour-Zuordnungen sind fachlich sortierbar

Das System SHALL Abholorte im Dialog zur Tour-Zuordnung tabellarisch mit getrennten Fachwerten darstellen und SHALL die vollständige gefilterte Ergebnismenge interaktiv sortieren können, ohne die Gruppierung ausgewählter und nicht ausgewählter Abholorte aufzuheben.

#### Scenario: Dialog zeigt getrennte Adressspalten

- **WHEN** ein Benutzer den Dialog zur Tour-Zuordnung öffnet
- **THEN** zeigt das System Auswahl, Region, Ort, Straße und Hausnummer in getrennten Tabellenspalten
- **AND** das System zeigt weder den Aktivstatus noch einen zusätzlichen Zuordnungsstatus des Abholorts
- **AND** zusammengesetzte Werte wie `Amt Meyenburg / Brügge / Alle Straßen / Alle Hausnummern` werden den vier passenden Adressspalten zugeordnet
- **AND** auf schmalen Ansichten bleiben dieselben Fachwerte beschriftet und lesbar

#### Scenario: Benutzer sortiert die gefilterten Abholorte nach Ort und Straße

- **WHEN** ein Benutzer die Sortierrichtung auswählt
- **THEN** sortiert das System die vollständige aktuell gefilterte Ergebnismenge hierarchisch nach Ort, Straße und Hausnummer in der gewählten Richtung
- **AND** die Filterung erfolgt vor der Sortierung
- **AND** ausgewählte Abholorte stehen weiterhin vor nicht ausgewählten Abholorten
- **AND** dieselbe Sortierhierarchie gilt innerhalb beider Gruppen
- **AND** fehlende Werte stehen nach vorhandenen Werten
- **AND** Bezeichnung und ID stellen bei gleichen Adresswerten eine stabile Reihenfolge sicher

#### Scenario: Benutzer berücksichtigt die Region bei der Mehrfachsortierung

- **WHEN** ein Benutzer Region als optionales Sortierkriterium aktiviert
- **THEN** sortiert das System hierarchisch nach Region, Ort, Straße und Hausnummer
- **AND** die gewählte Sortierrichtung gilt für alle Adresskriterien
- **AND** deaktiviert der Benutzer das Kriterium wieder, beginnt die Sortierhierarchie erneut mit dem Ort

#### Scenario: Benutzer ändert Auswahl bei aktiver Sortierung

- **WHEN** ein Benutzer einen sichtbaren Abholort aus- oder abwählt
- **THEN** aktualisiert das System die ausgewählte beziehungsweise nicht ausgewählte Gruppe unmittelbar
- **AND** die optionale Regionssortierung und die Sortierrichtung bleiben erhalten
- **AND** Auswahlen außerhalb des aktuellen Filters bleiben unverändert gespeichert
