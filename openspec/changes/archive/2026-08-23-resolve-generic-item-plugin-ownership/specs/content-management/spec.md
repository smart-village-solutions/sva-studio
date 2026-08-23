## ADDED Requirements

### Requirement: Die gemeinsame Inhaltsübersicht verwendet eine eindeutige GenericItem-Repräsentation

Das System MUST jedes Mainserver-GenericItem in der gemeinsamen Inhaltsübersicht genau einmal darstellen. Deklariert ein registriertes Fachplugin die Zuständigkeit für den exakten `genericType`, MUST dessen Fach-Content-Type die Darstellung übernehmen. Ohne registrierte Zuständigkeit MUST `generic-items.generic-item` die Darstellung übernehmen. Die Klassifikation MUST vor und unabhängig von der benutzerspezifischen Autorisierung erfolgen.

#### Scenario: Registriertes Fachplugin übernimmt die Darstellung

- **GIVEN** ein GenericItem besitzt `genericType` gleich `FeaturedProject`
- **AND** `projects.project` ist dafür in der Build-time-Registry registriert
- **WHEN** die gemeinsame Inhaltsübersicht projiziert wird
- **THEN** erscheint der Datensatz ausschließlich als `projects.project`
- **AND** erscheint er dort nicht zusätzlich als `generic-items.generic-item`

#### Scenario: Unbekannter Typ fällt auf generische Darstellung zurück

- **GIVEN** kein registriertes Fachplugin übernimmt den `genericType` eines GenericItems
- **WHEN** die gemeinsame Inhaltsübersicht projiziert wird
- **THEN** erscheint der Datensatz als `generic-items.generic-item`
- **AND** bleibt über dessen generischen Detailpfad erreichbar

#### Scenario: Fehlendes Fachrecht erzeugt keinen generischen Ersatz

- **GIVEN** ein registriertes Fachplugin übernimmt den `genericType` eines GenericItems
- **AND** die Person besitzt `generic-items.read`, aber nicht das erforderliche Fach-Leserecht
- **WHEN** sie die gemeinsame Inhaltsübersicht öffnet
- **THEN** erscheint der Datensatz dort weder fachlich noch generisch
- **AND** verändert die Berechtigung nicht seinen kanonischen Content-Type

#### Scenario: Technischer Vollzugriff bleibt separat erhalten

- **GIVEN** eine Person besitzt `generic-items.read`
- **WHEN** sie das eigenständige Modul „Generische Inhalte“ öffnet
- **THEN** enthält dessen technische Liste weiterhin alle Mainserver-GenericItems unabhängig vom `genericType`
- **AND** gilt die eindeutige Repräsentation ausschließlich für die gemeinsame Inhaltsübersicht

## MODIFIED Requirements

### Requirement: Featured Projects sind eigenständige GenericItem-Fachinhalte

Das System MUST Featured Projects als eigenständigen Content-Type `projects.project` bereitstellen und als GenericItem mit `genericType` gleich `FeaturedProject` speichern. Die gemeinsame Inhaltsübersicht MUST diese Datensätze ausschließlich als `projects.project` darstellen, wenn das Projekte-Plugin registriert ist. Das eigenständige Generic-Items-Modul MUST denselben Mainserver-Datensatz weiterhin über seinen technischen Vollzugriff bereitstellen, wenn die handelnde Person über `generic-items.*` verfügt. Der frühere Diskriminator `PROJECT` MUST nicht als Featured Project behandelt werden.

#### Scenario: Featured Project wird angelegt

- **WHEN** ein Benutzer mit `projects.create` ein Featured Project anlegt
- **THEN** zeigt das System ausschließlich die fachlich erlaubten Felder
- **AND** speichert den Datensatz mit `genericType` gleich `FeaturedProject`
- **AND** projiziert ihn in der gemeinsamen Inhaltsübersicht ausschließlich als `projects.project`

#### Scenario: Technischer Zugriff bleibt im Generic-Items-Modul erhalten

- **GIVEN** ein GenericItem mit `genericType` gleich `FeaturedProject`
- **AND** ein Benutzer besitzt `generic-items.read`
- **WHEN** er das eigenständige Generic-Items-Modul öffnet
- **THEN** darf er denselben Mainserver-Datensatz dort als technischen generischen Inhalt sehen
- **AND** erzeugt das keine zweite Repräsentation in der gemeinsamen Inhaltsübersicht

#### Scenario: Alter Diskriminator wird nicht übernommen

- **GIVEN** ein GenericItem mit `genericType` gleich `PROJECT`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** behandelt das System es nicht als Featured Project
- **AND** stellt es ohne andere registrierte Zuständigkeit generisch dar
