## ADDED Requirements

### Requirement: Gemeinsame Detaileditor-Primitives in der Studio-UI

Das Studio SHALL in `studio-ui-react` gemeinsame UI-Primitives für Detaileditoren bereitstellen, damit mehrere Content-Editoren dieselben hosteigenen Layout- und Abschnittsmuster nutzen können.

#### Scenario: Zwei Editoren nutzen dieselbe Abschnittskarte

- **GIVEN** mindestens zwei Content-Editoren mit abschnittsorientierter Detailbearbeitung
- **WHEN** ihre Detailbereiche gerendert werden
- **THEN** verwenden sie dieselbe gemeinsame Section-Card aus `studio-ui-react`
- **AND** Titel-, Beschreibungs- und Aktionsflächen folgen demselben UI-Vertrag

#### Scenario: Pluginlokale Layoutduplikate werden reduziert

- **GIVEN** ein neuer oder migrierter Detaileditor benötigt eine Standard-Sektionsfläche
- **WHEN** der Editor im Host materialisiert wird
- **THEN** wird bevorzugt das gemeinsame Primitive aus `studio-ui-react` genutzt
- **AND** es wird keine neue parallele pluginlokale Basis-Section ohne begründete Ausnahme eingeführt

### Requirement: Gemeinsame Repeater-Primitives für strukturierte Mehrfacheinträge

Das Studio SHALL kleine wiederverwendbare Repeater-Primitives für strukturierte Mehrfacheinträge bereitstellen, sofern diese Muster in mindestens zwei Editoren real genutzt werden.

#### Scenario: Wiederholbare Mehrfacheinträge nutzen denselben Host-Baustein

- **GIVEN** zwei Content-Editoren pflegen strukturierte Listen wie Links, Preise oder Inhaltsblöcke
- **WHEN** diese Bereiche gerendert werden
- **THEN** stützen sie sich auf gemeinsame hosteigene Repeater-Primitives
- **AND** Hinzufügen, Entfernen und Abschnittsrahmung folgen demselben Grundmuster

#### Scenario: Nicht stabile Muster bleiben pluginlokal

- **GIVEN** ein Editorbereich enthält stark fachspezifische Interaktions- oder Datenregeln
- **WHEN** die Verantwortung nicht sinnvoll von der Fachlogik getrennt werden kann
- **THEN** darf die konkrete UI lokal im Plugin verbleiben
- **AND** die Ausnahme ist bewusst dokumentiert statt implizit geduldet
