## ADDED Requirements

### Requirement: Cockpit Cards sind eigenständige GenericItem-Fachinhalte

Das System MUST Cockpit Cards als eigenständigen Content-Type `cockpit-cards.cockpit-card` bereitstellen und als GenericItem mit `genericType` gleich `COCKPIT_CARD` speichern. Die gemeinsame Inhaltsübersicht MUST Cockpit Cards ausschließlich als diesen Fachtyp darstellen.

#### Scenario: Cockpit Card wird angelegt

- **WHEN** ein Benutzer mit `cockpit-cards.create` eine Cockpit Card anlegt
- **THEN** zeigt das System ausschließlich die fachlich erlaubten Felder
- **AND** speichert den Datensatz mit `genericType` gleich `COCKPIT_CARD`
- **AND** projiziert ihn als `cockpit-cards.cockpit-card`

#### Scenario: Cockpit Card erscheint nicht doppelt

- **GIVEN** ein GenericItem mit `genericType` gleich `COCKPIT_CARD`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** erscheint es als `cockpit-cards.cockpit-card`
- **AND** nicht zusätzlich als `generic-items.generic-item`

### Requirement: Cockpit Cards besitzen ein begrenztes Fachmodell

Das System MUST Überschrift, optionalen Nur-Text, optionalen Sprachcode, genau eine bestehende Kategorie, null oder mehr Bilder, höchstens einen HTTPS-Link mit optionalem Linktext und Öffnungsverhalten, Sortiergewicht, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeiten. Ausschließlich Überschrift und Kategorie MUST fachliche Pflichtfelder sein. Andere GenericItem-Bereiche und technische Herkunftsfelder MUST verborgen bleiben.

#### Scenario: Cockpit Card mit optionalen Inhalten wird gespeichert

- **WHEN** ein Benutzer Überschrift und Kategorie sowie optional Text, Sprache, gültige Bilder und einen HTTPS-Link speichert
- **THEN** persistiert das System Überschrift in `title`, Kategorie in `categories`, vorhandenen Text als alleinigen Content-Block, Bilder in `mediaContents`, den Link in `webUrls[0].url`, den Linktext in `webUrls[0].description` und das Öffnungsverhalten in `payload.openInNewTab`
- **AND** erhält es `externalId`, unbekannte bestehende Payload-Schlüssel und unterstützte Medienmetadaten

#### Scenario: Öffnungsverhalten ohne Link wird normalisiert

- **WHEN** ein Benutzer keinen Link speichert
- **THEN** speichert das System keine `webUrls`
- **AND** normalisiert `payload.openInNewTab` auf `false`

#### Scenario: Ungültige Kardinalität wird abgewiesen

- **WHEN** keine oder mehrere Kategorien oder mehrere Links übermittelt werden
- **THEN** weist das System die Speicherung feldbezogen ab
- **AND** verändert keinen bestehenden Datensatz

#### Scenario: Optionale Inhalte bleiben leer

- **WHEN** weder Text noch Sprache noch Bilder übermittelt werden
- **THEN** speichert das System die Cockpit Card ohne Content-Block und ohne Medien
- **AND** überlässt die sprachliche Standardabbildung dem konsumierenden Frontend

#### Scenario: Fachfremde Inhalte werden abgewiesen

- **WHEN** HTML-Text, Nicht-Bild-Medien, ein Nicht-HTTPS-Link, Kontakte oder Orte übermittelt werden
- **THEN** weist das System die Speicherung ab
- **AND** führt keine Mainserver-Mutation aus

### Requirement: Text und Bilder teilen den Inhalts-Tab

Das System MUST für gespeicherte Kacheln die Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie` anbieten. `Basis` MUST Überschrift, Sprachcode und Kategorie enthalten. `Inhalt` MUST Text und Bilder gemeinsam enthalten. `Einstellungen` MUST Link, Linktext, Öffnungsverhalten und Publikationsmetadaten enthalten.

#### Scenario: Inhalt wird gemeinsam bearbeitet

- **WHEN** ein Benutzer den Tab `Inhalt` öffnet
- **THEN** kann er dort den Text bearbeiten
- **AND** Bilder auswählen, hochladen, sortieren und entfernen
- **AND** den Alternativtext in Vorschaukarten und als einziges Medienmetadatum im gemeinsamen Medienauswahldialog bearbeiten
- **AND** gibt es keinen separaten Medien-Tab

#### Scenario: Neue Cockpit Card besitzt noch keine Historie

- **WHEN** ein Benutzer eine Cockpit Card anlegt
- **THEN** zeigt das System `Basis`, `Inhalt` und `Einstellungen`
- **AND** keinen Historie-Tab vor dem ersten Speichern
