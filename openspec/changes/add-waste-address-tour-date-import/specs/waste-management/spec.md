## MODIFIED Requirements
### Requirement: Waste-Management umfasst kontrollierte Data-Tools

Das System SHALL CSV-Import, Seed und Reset als kontrollierte Data-Tools im Waste-Management-Modul bereitstellen.

#### Scenario: Spezialimport für Tourzuordnungen nutzt Adressblock und Fraktionsspalten
- **WHEN** ein Benutzer den spezialisierten Waste-CSV-Import für Tourzuordnungen verwendet
- **THEN** beginnt die Datei mit `Ort` und kann optional `Region`, `Straße` und `Hausnummern` im Adressblock enthalten
- **AND** alle weiteren Kopfzeilen werden als Abfallfraktionen interpretiert
- **AND** die Zellwerte dieser Fraktionsspalten werden als Tourbezeichnungen interpretiert

#### Scenario: Leere Straßen- oder Hausnummernfelder erzeugen Sammel-Abholorte
- **WHEN** im Spezialimport `Straße` oder `Hausnummern` leer ist
- **THEN** wird der Datensatz auf einen expliziten Sammel-Abholort mit `Alle Straßen` und `Alle Hausnummern` abgebildet
- **AND** es erfolgt keine implizite Massenanwendung auf alle bestehenden Adressen des Orts

#### Scenario: Belegte Fraktionszellen erzeugen Touren und Zuordnungen
- **WHEN** eine Fraktionsspalte in einer gültigen Importzeile eine Tourbezeichnung enthält
- **THEN** wird die referenzierte Tour bei Bedarf angelegt oder um die Fraktion ergänzt
- **AND** die Tour wird für genau diese Adresse zugeordnet
- **AND** leere Fraktionszellen bleiben ohne Zuordnung

#### Scenario: Fehlende Abfallarten werden aus Fraktionsspalten minimal angelegt
- **WHEN** eine Fraktionsspalte im Spezialimport auf eine noch nicht vorhandene Abfallart verweist
- **THEN** legt das System die Abfallart minimal mit Standardfarbe und aktivem Status an
- **AND** die neue Abfallart erscheint in der Vorschau als neues Artefakt

#### Scenario: Importvorschau zeigt strukturierte Fehler und neue Artefakte
- **WHEN** ein Benutzer vor dem finalen Import eine Vorschau ausführt
- **THEN** zeigt das System erkannte Abfallarten, neue Touren, neue Abholorte sowie gültige und fehlerhafte Zeilen
- **AND** zeilenbezogene Fehler können als Fehlerdatei exportiert werden
