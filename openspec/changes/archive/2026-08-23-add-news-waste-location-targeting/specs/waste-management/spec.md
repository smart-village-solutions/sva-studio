## ADDED Requirements

### Requirement: Waste-Abholorte liefern Zielschlüssel für Nachrichten

Das System MUST aus aktiven Abholorten und ihrer Adresshierarchie stabile Zielschlüssel für Nachrichten ableiten.

#### Scenario: Konkrete Hausnummer wird abgebildet

- **WHEN** ein Abholort auf eine Straße und eine Hausnummer verweist
- **THEN** enthält der Zielschlüssel den zusammengesetzten Straßen- und Hausnummerntext sowie PLZ und Ort

#### Scenario: Abholort besitzt keine Hausnummer

- **WHEN** ein aktiver Abholort auf einen Ort mit PLZ und eine Straße, aber auf keine Hausnummer verweist
- **THEN** enthält der Zielschlüssel die Straße ohne Hausnummer sowie PLZ und Ort
- **AND** adressiert der Schlüssel die gesamte Straße

#### Scenario: Doppelte Schlüssel sind vorhanden

- **WHEN** mehrere Abholortdatensätze dieselbe Straße, PLZ und denselben Ort ergeben
- **THEN** gibt die Nachrichtenzielauswahl diesen externen Schlüssel nur einmal aus

### Requirement: Städte unterstützen feldselektive Updates

Das System MUST bei Stadt-Updates ausschließlich explizit übermittelte Felder verändern.

#### Scenario: Postleitzahl wird ergänzt

- **WHEN** ein Client nur `postalCode` aktualisiert
- **THEN** bleiben der aktuelle Name und die aktuelle Region der Stadt unverändert

#### Scenario: Optionales Feld wird ausgelassen

- **WHEN** ein älterer Client `postalCode` nicht übermittelt
- **THEN** bleibt eine bestehende Postleitzahl unverändert

#### Scenario: Postleitzahl wird ausdrücklich entfernt

- **WHEN** ein Client `postalCode: null` übermittelt
- **THEN** wird die Postleitzahl entfernt
