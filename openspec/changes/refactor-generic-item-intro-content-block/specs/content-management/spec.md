## ADDED Requirements

### Requirement: GenericItem-Einleitungen gehören zu Content-Blocks

Das System MUST redaktionelle Einleitungen von GenericItems ausschließlich als `intro` des jeweiligen Content-Blocks modellieren. Der offene GenericItem-Editor MUST die Einleitung je Block bearbeiten und darf kein separates globales Teaser-Feld anbieten. Fachplugins ohne separate Einleitung MUST ihren bestehenden Body-Vertrag beibehalten und dürfen kein künstliches `intro` erzeugen. Das System MUST historische Top-Level-Teaser weder lesen noch als Fallback übernehmen.

#### Scenario: GenericItem mit Blockeinleitung wird bearbeitet

- **GIVEN** ein GenericItem besitzt einen Content-Block mit `intro` und `body`
- **WHEN** ein Redakteur die Blockeinleitung ändert
- **THEN** speichert das System den neuen Wert als `contentBlocks[].intro`
- **AND** sendet kein Top-Level-Teaser-Feld

#### Scenario: Historischer Top-Level-Teaser ist vorhanden

- **GIVEN** eine Mainserver-Antwort besitzt außerhalb der Content-Blocks einen historischen Teaser-Wert
- **AND** kein Content-Block besitzt `intro`
- **WHEN** das Studio den Datensatz abbildet
- **THEN** übernimmt es den historischen Wert nicht
- **AND** zeigt keine daraus abgeleitete Einleitung an

#### Scenario: FAQ oder Kachel wird gespeichert

- **GIVEN** der Fachtyp besitzt keine separate Einleitung
- **WHEN** ein Redakteur eine FAQ oder Kachel speichert
- **THEN** bleibt der Fachinhalt im festgelegten `contentBlocks[].body`
- **AND** erzeugt das System kein `intro`

### Requirement: News-Text gehört ausschließlich zu Content-Blocks

Das System MUST Einleitung und Inhalt einer News ausschließlich als `contentBlocks[].intro` und `contentBlocks[].body` modellieren. Es MUST `payload.teaser` und `payload.body` weder als News-Vertrag anbieten noch daraus einen Content-Block erzeugen. Der Editor MUST die Einleitung als Blockeinleitung bezeichnen und modellieren.

#### Scenario: News besitzt nur historischen Payload-Text

- **GIVEN** eine News besitzt `payload.teaser` oder `payload.body`
- **AND** keine Content-Blocks
- **WHEN** das Studio die News abbildet
- **THEN** bleibt die Liste der Content-Blocks leer
- **AND** übernimmt das Studio den Payload-Text nicht

#### Scenario: News-Einleitung wird gespeichert

- **WHEN** ein Redakteur die Einleitung einer News speichert
- **THEN** sendet das Studio den Wert als `contentBlocks[0].intro`
- **AND** sendet keinen Teaser im Payload oder als Root-Feld

### Requirement: Featured-Project-Texte teilen einen kontrollierten ersten Content-Block

Das System MUST `Description` eines Featured Projects auf `contentBlocks[0].intro` und `FullText` auf `contentBlocks[0].body` abbilden. Bei Updates MUST es weitere Eigenschaften des ersten Blocks und alle weiteren Content-Blocks erhalten, soweit sie nicht vom Featured-Project-Vertrag kontrolliert werden. Es MUST keinen historischen Top-Level-Teaser als Description-Fallback verwenden.

#### Scenario: Projektbeschreibung und Volltext werden gespeichert

- **WHEN** ein Redakteur Description und FullText eines Featured Projects speichert
- **THEN** schreibt das System beide Werte in `intro` und `body` desselben ersten Content-Blocks
- **AND** sendet kein Top-Level-Teaser-Feld

#### Scenario: Projekt besitzt weitere Content-Blocks

- **GIVEN** ein Featured Project besitzt einen ersten Textblock und weitere fachfremde Content-Blocks
- **WHEN** Description oder FullText geändert wird
- **THEN** aktualisiert das System ausschließlich die kontrollierten Felder des ersten Blocks
- **AND** erhält die weiteren Content-Blocks unverändert
