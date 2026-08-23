## ADDED Requirements

### Requirement: Root-GenericItems verwenden ausschließlich schreibbare GraphQL-Felder

Der Mainserver-Adapter MUST den Root-GenericItem-Vertrag an den Argumenten der Top-Level-Mutation `createGenericItem` ausrichten. Er MUST `ContentBlockInput.intro` für Einleitungen verwenden und darf `teaser` weder selektieren noch deklarieren, als Variable senden oder in Root-GenericItem-Typen modellieren. Ein in Query- oder verschachtelten Input-Typen historisch vorhandenes Teaser-Feld MUST für den Root-Vertrag ignoriert werden.

#### Scenario: Root-GenericItem wird angelegt oder aktualisiert

- **WHEN** der Adapter eine `createGenericItem`-Mutation für ein Root-GenericItem erzeugt
- **THEN** enthält das Dokument kein Argument und keine Variable `teaser`
- **AND** liegen optionale Einleitungen ausschließlich in `contentBlocks[].intro`

#### Scenario: Schema enthält ein historisches lesbares Teaser-Feld

- **GIVEN** der hinterlegte GraphQL-Snapshot führt `GenericItem.teaser` als lesbares Feld
- **WHEN** der Studio-Client sein GenericItem-Fragment erzeugt
- **THEN** selektiert er dieses Feld nicht
- **AND** bietet es nicht über den Studio-Vertrag an

#### Scenario: Verschachtelter Input besitzt ein Teaser-Feld

- **GIVEN** `GenericItemInput` enthält für verschachtelte GenericItems ein Feld `teaser`
- **WHEN** der Adapter ein Root-GenericItem schreibt
- **THEN** verwendet er dieses verschachtelte Feld nicht als Umgehung des Top-Level-Vertrags

### Requirement: News verwenden den nativen ContentBlockInput-Vertrag

Der Mainserver-Adapter MUST News-Einleitung und -Inhalt über `contentBlocks[].intro/body` lesen und schreiben. Er MUST historische Textfelder im News-Payload ignorieren und darf daraus keinen Fallback-Block synthetisieren.

#### Scenario: News-Antwort enthält historischen Payload-Text

- **GIVEN** der Mainserver liefert `payload.teaser` oder `payload.body`
- **AND** liefert keine Content-Blocks
- **WHEN** der Adapter die News abbildet
- **THEN** enthält die abgebildete News keine daraus erzeugten Content-Blocks
