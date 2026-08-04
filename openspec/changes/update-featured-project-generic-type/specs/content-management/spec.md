## MODIFIED Requirements

### Requirement: Featured Projects sind eigenständige GenericItem-Fachinhalte

Das System MUST Featured Projects als eigenständigen Content-Type `projects.project` bereitstellen und als GenericItem mit `genericType` gleich `FeaturedProject` speichern. Die gemeinsame Inhaltsübersicht MUST diese Datensätze ausschließlich als `projects.project` darstellen. Der frühere Diskriminator `PROJECT` MUST nicht als Featured Project behandelt werden.

#### Scenario: Featured Project wird angelegt

- **WHEN** ein Benutzer mit `projects.create` ein Featured Project anlegt
- **THEN** zeigt das System ausschließlich die fachlich erlaubten Felder
- **AND** speichert den Datensatz mit `genericType` gleich `FeaturedProject`
- **AND** projiziert ihn als `projects.project`

#### Scenario: Featured Project erscheint nicht doppelt

- **GIVEN** ein GenericItem mit `genericType` gleich `FeaturedProject`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** erscheint es als `projects.project`
- **AND** nicht zusätzlich als `generic-items.generic-item`

#### Scenario: Alter Diskriminator wird nicht übernommen

- **GIVEN** ein GenericItem mit `genericType` gleich `PROJECT`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** behandelt das System es nicht als Featured Project
