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

## MODIFIED Requirements

### Requirement: News ContentBlocks Are The Leading Content Model

The News plugin SHALL treat `contentBlocks` as the leading and exclusive News text model. It SHALL model introductions and bodies only as `contentBlocks[].intro` and `contentBlocks[].body`. It SHALL NOT expose `payload.teaser` or `payload.body` as part of the News contract and SHALL NOT derive a virtual content block from legacy payload values. Saves SHALL write `contentBlocks` and SHALL NOT write payload. The editor SHALL label and model the introduction as a content-block introduction.

#### Scenario: Legacy payload-only News is loaded

- **GIVEN** an existing Mainserver News item has no `contentBlocks` but contains legacy `payload.teaser` or `payload.body` data
- **WHEN** the editor loads the item
- **THEN** the editor keeps the content-block list empty
- **AND** the editor does not derive an introduction or body from the legacy payload

#### Scenario: User edits multiple content blocks

- **GIVEN** the user edits multiple content blocks with introductions, bodies, and media URL references
- **WHEN** the item is saved
- **THEN** the host sends the complete `contentBlocks` list as the new Mainserver state
- **AND** individual block IDs are not required because `ContentBlockInput` does not expose IDs
- **AND** the host does not send payload or a root-level teaser field

## ADDED Requirements

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
