## MODIFIED Requirements

### Requirement: Featured Projects sind eigenständige GenericItem-Fachinhalte

Das System MUST Featured Projects als eigenständigen Content-Type `projects.project` bereitstellen und als GenericItem mit `genericType` gleich `FeaturedProject` speichern. Die fachliche Projektansicht MUST diese Datensätze als `projects.project` darstellen. Der generische Zugriff MUST denselben Mainserver-Datensatz zusätzlich als `generic-items.generic-item` bereitstellen, wenn die handelnde Person über `generic-items.*` verfügt. Der frühere Diskriminator `PROJECT` MUST nicht als Featured Project behandelt werden.

#### Scenario: Featured Project wird angelegt

- **WHEN** ein Benutzer mit `projects.create` ein Featured Project anlegt
- **THEN** zeigt das System ausschließlich die fachlich erlaubten Felder
- **AND** speichert den Datensatz mit `genericType` gleich `FeaturedProject`
- **AND** projiziert ihn als `projects.project`

#### Scenario: Featured Project besitzt zwei autorisierte Repräsentationen

- **GIVEN** ein GenericItem mit `genericType` gleich `FeaturedProject`
- **AND** ein Benutzer besitzt `projects.read` und `generic-items.read`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** erscheint der Datensatz als `projects.project`
- **AND** zusätzlich als `generic-items.generic-item`

#### Scenario: Alter Diskriminator wird nicht übernommen

- **GIVEN** ein GenericItem mit `genericType` gleich `PROJECT`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** behandelt das System es nicht als Featured Project
- **AND** darf es weiterhin als generischen Inhalt darstellen
