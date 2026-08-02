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

Das System MUST Überschrift, Nur-Text, Sprachcode, genau eine bestehende Kategorie, ein oder mehrere Bilder, höchstens einen HTTPS-Link, Sortiergewicht, Sichtbarkeit und Veröffentlichungszeitpunkt bearbeiten. Überschrift, Text, Sprachcode, Kategorie und mindestens ein Bild MUST Pflichtfelder sein. Andere GenericItem-Bereiche MUST verborgen bleiben.

#### Scenario: Vollständige Cockpit Card wird gespeichert

- **WHEN** ein Benutzer alle Pflichtfelder, mehrere gültige Bilder und optional einen HTTPS-Link speichert
- **THEN** persistiert das System Überschrift in `title`, Text als alleinigen Content-Block, Kategorie in `categories`, Bilder in `mediaContents` und den Link in `webUrls`
- **AND** erhält es unbekannte bestehende Payload-Schlüssel

#### Scenario: Ungültige Kardinalität wird abgewiesen

- **WHEN** keine oder mehrere Kategorien, kein Bild oder mehrere Links übermittelt werden
- **THEN** weist das System die Speicherung feldbezogen ab
- **AND** verändert keinen bestehenden Datensatz

#### Scenario: Fachfremde Inhalte werden abgewiesen

- **WHEN** HTML-Text, Nicht-Bild-Medien, ein Nicht-HTTPS-Link, Kontakte oder Orte übermittelt werden
- **THEN** weist das System die Speicherung ab
- **AND** führt keine Mainserver-Mutation aus

### Requirement: Text und Bilder teilen den Inhalts-Tab

Das System MUST für gespeicherte Cockpit Cards die Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie` anbieten. `Basis` MUST Überschrift, Sprachcode und Kategorie enthalten. `Inhalt` MUST Text und Bilder gemeinsam enthalten. `Einstellungen` MUST Link und Publikationsmetadaten enthalten.

#### Scenario: Inhalt wird gemeinsam bearbeitet

- **WHEN** ein Benutzer den Tab `Inhalt` öffnet
- **THEN** kann er dort den Text bearbeiten
- **AND** Bilder auswählen, hochladen, sortieren und entfernen
- **AND** gibt es keinen separaten Medien-Tab

#### Scenario: Neue Cockpit Card besitzt noch keine Historie

- **WHEN** ein Benutzer eine Cockpit Card anlegt
- **THEN** zeigt das System `Basis`, `Inhalt` und `Einstellungen`
- **AND** keinen Historie-Tab vor dem ersten Speichern
