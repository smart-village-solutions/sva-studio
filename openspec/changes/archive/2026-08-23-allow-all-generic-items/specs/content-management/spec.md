## ADDED Requirements

### Requirement: Generische Inhalte bilden alle Mainserver-GenericItems ab

Das System MUST im Generic-Items-Modul alle Mainserver-Datensätze vom Typ `GenericItem` unabhängig von ihrem `genericType` anzeigen und über den generischen Editor bearbeitbar machen. Dies MUST bekannte Fachtypen wie `FeaturedProject`, `FAQ` und `COCKPIT_CARD` sowie unbekannte oder zukünftige Diskriminatoren einschließen.

#### Scenario: Fachlich spezialisierter Datensatz wird generisch geöffnet

- **GIVEN** ein Mainserver-GenericItem besitzt `genericType` gleich `FAQ`, `COCKPIT_CARD` oder `FeaturedProject`
- **AND** der Benutzer besitzt die erforderliche `generic-items.read`-Berechtigung
- **WHEN** er das Generic-Items-Modul öffnet
- **THEN** erscheint der Datensatz in der generischen Liste
- **AND** lässt sich über die generische Detailansicht öffnen

#### Scenario: Unbekannter Diskriminator bleibt generisch nutzbar

- **GIVEN** ein Mainserver-GenericItem besitzt einen dem Studio unbekannten `genericType`
- **WHEN** ein berechtigter Benutzer es generisch liest oder bearbeitet
- **THEN** filtert das System den Datensatz nicht aufgrund seines Diskriminators aus
- **AND** erhält es nicht bearbeitete GenericItem-Felder und unbekannte Payload-Schlüssel

#### Scenario: Generischer und fachlicher Zugriff bestehen gleichzeitig

- **GIVEN** ein Benutzer besitzt sowohl generische als auch passende fachliche Leserechte
- **WHEN** die gemeinsame Inhaltsübersicht die autorisierten Projektionen lädt
- **THEN** darf derselbe Mainserver-Datensatz als generischer und als fachlicher Inhalt erscheinen
- **AND** bleiben beide Repräsentationen anhand ihres Content-Types unterscheidbar

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

#### Scenario: Alter Diskriminator wird nicht als Featured Project übernommen

- **GIVEN** ein GenericItem mit `genericType` gleich `PROJECT`
- **WHEN** die Inhaltsprojektion aktualisiert wird
- **THEN** behandelt das System es nicht als Featured Project
- **AND** darf es weiterhin als generischen Inhalt darstellen

