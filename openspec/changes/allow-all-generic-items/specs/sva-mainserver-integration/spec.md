## ADDED Requirements

### Requirement: Generische Projektionsadapter enthalten jeden GenericItem-Diskriminator

Das System MUST in allen generischen Mainserver-Projektionsadaptern jeden Datensatz vom Typ `GenericItem` unabhängig vom Wert seines Feldes `genericType` als `generic-items.generic-item` abbilden. Schlanker und Legacy-Adapter MUST denselben Inklusionsvertrag erfüllen und dürfen keine Allow- oder Denylist bekannter Fachtypen führen.

#### Scenario: Gemischte GenericItems werden schlank projiziert

- **GIVEN** eine Mainserver-Seite enthält freie GenericItems, FAQs, Kacheln, Featured Projects und einen unbekannten Diskriminator
- **WHEN** der schlanke Adapter die generische Projektion lädt
- **THEN** projiziert er jeden Datensatz als `generic-items.generic-item`
- **AND** behält die Upstream-Pagination unverändert bei

#### Scenario: Legacy-Adapter liefert dieselbe Typmenge

- **GIVEN** dieselbe gemischte Mainserver-Seite wird über den Legacy-Adapter geladen
- **WHEN** die generische Projektion aktualisiert wird
- **THEN** enthält sie dieselben GenericItem-IDs wie der schlanke Adapter
- **AND** filtert weder bekannte noch unbekannte `genericType`-Werte aus

#### Scenario: Fachprojektion bleibt zusätzlich typisiert

- **GIVEN** ein GenericItem erfüllt den Vertrag eines registrierten Fachplugins
- **WHEN** der Benutzer sowohl den generischen als auch den fachlichen Content-Type lesen darf
- **THEN** darf die Inhaltsprojektion getrennte Zeilen für beide Content-Types persistieren
- **AND** kollidieren ihre Projektionsschlüssel nicht

