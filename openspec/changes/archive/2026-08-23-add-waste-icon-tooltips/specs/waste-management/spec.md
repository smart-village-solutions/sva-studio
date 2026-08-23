## ADDED Requirements

### Requirement: Reine Waste-Icon-Aktionen erklären ihre Funktion per Tooltip

Das System SHALL für jeden interaktiven Waste-Management-Button, dessen sichtbarer Inhalt ausschließlich aus einem Icon besteht, einen lokalisierten Tooltip mit derselben Bedeutung wie die zugängliche Beschriftung anzeigen.

#### Scenario: Benutzer zeigt mit der Maus auf eine Icon-Aktion

- **WHEN** ein Benutzer mit der Maus auf einen reinen Icon-Aktionsbutton zeigt
- **THEN** zeigt das System einen kurzen erklärenden Tooltip

#### Scenario: Benutzer fokussiert eine Icon-Aktion mit der Tastatur

- **WHEN** ein Benutzer einen reinen Icon-Aktionsbutton mit der Tastatur fokussiert
- **THEN** zeigt das System denselben erklärenden Tooltip

#### Scenario: Icon besitzt bereits sichtbaren Erklärungstext

- **WHEN** ein Icon innerhalb eines Buttons bereits von einer sichtbaren Aktionsbeschriftung begleitet wird oder rein dekorativ ist
- **THEN** fügt das System keinen redundanten Tooltip hinzu
