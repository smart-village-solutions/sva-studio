# Change: Organisationsverwaltung gemäß Issue 627 vervollständigen

## Why

Die Organisationsverwaltung kann Vereine und Institutionen bislang nur als generischen Typ
abbilden. Zudem erlaubt die Zuordnung von Accounts zu einer Organisation nur eine einzelne
Auswahl und zeigt eine fachlich nicht mehr benötigte Sichtbarkeitssteuerung. Gemäß dem Kommentar
in Issue 627 wird die Baumdarstellung vorerst zurückgestellt.

## What Changes

- Die kontrollierten Organisationstypen werden um `association` und `institution` erweitert.
- API-Validierung, Filter und Organisationsformulare unterstützen beide Werte.
- Die deutsche und englische Oberfläche zeigt die passenden Bezeichnungen an.
- Der Datenbank-Constraint und der dokumentierte Schema-Snapshot werden erweitert.
- In der Organisationsansicht können mehrere Accounts ausgewählt und nacheinander zugeordnet
  werden; fehlgeschlagene und noch nicht versuchte Auswahlen bleiben für einen erneuten Versuch
  erhalten.
- Die Sichtbarkeit von Organisationsmitgliedschaften wird aus Organisations- und
  Account-Formularen entfernt. API und Datenbank behalten das Feld kompatibel bei; neue
  Zuordnungen verwenden den bestehenden serverseitigen Standard `internal`.
- Eine eingerückte Baumdarstellung von Child-Organisationen ist ausdrücklich nicht Bestandteil
  dieser Änderung.

## Impact

- Affected specs: `iam-organizations`
- Affected code: IAM-Verträge, Organisationsabfragen und -validierung, Organisationsverwaltung,
  Accountverwaltung, gemeinsame Auswahlkomponenten, IAM-Datenbankmigrationen
- Affected arc42 sections: keine; die bestehenden Systemgrenzen und Architekturbausteine bleiben
  unverändert
