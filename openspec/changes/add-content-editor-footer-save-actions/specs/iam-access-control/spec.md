## ADDED Requirements

### Requirement: Wiederholte Primäraktion für Rollenberechtigungen

Das System SHALL die Primäraktion der langen Rollenberechtigungsmatrix oberhalb und unterhalb der Matrix anbieten, ohne sie mit anderen speicherbaren Rollen-Teilflächen zu vermischen.

#### Scenario: Administrator speichert eine lange Berechtigungsauswahl

- **GIVEN** ein berechtigter Administrator bearbeitet die Berechtigungen einer Rolle
- **WHEN** die Berechtigungsmatrix gerendert wird
- **THEN** steht dieselbe Aktion zum Speichern der Berechtigungen oberhalb und unterhalb der Matrix bereit
- **AND** beide Positionen verwenden denselben Handler sowie denselben Berechtigungs-, Lade- und Disabled-Zustand
- **AND** allgemeine Rollendaten oder andere Rollen-Tabs werden dadurch nicht gespeichert
