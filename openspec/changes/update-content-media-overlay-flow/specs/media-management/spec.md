## MODIFIED Requirements
### Requirement: Hostseitiger Admin-Einstieg für Medienmanagement

Das System SHALL Medienmanagement mit einem kanonischen hostseitigen Einstieg unter `/admin/media` materialisieren und bei Bedarf spezialisierte Medien-Workflows unterhalb dieses Bereichs oder als hostseitig gesteuerte Overlay-Workflows bereitstellen.

#### Scenario: Medienbibliothek wird über hosteigene Admin-Route geöffnet

- **WHEN** ein berechtigter Benutzer die Medienbibliothek öffnet
- **THEN** erfolgt der Einstieg über eine hostmaterialisierte Route `/admin/media`
- **AND** Navigation, Guards, Search-Params und Standardaktionen folgen dem hostseitigen Admin-Ressourcenvertrag
- **AND** es entsteht kein separater, konkurrierender Medien-Haupteinstieg außerhalb des Admin-Bereichs

#### Scenario: Spezialisierter Medien-Workflow benötigt eigene Oberfläche

- **WHEN** Fokuspunkt-Bearbeitung, Zuschnitt, Variantenanalyse oder Usage-Impact eine spezialisierte Oberfläche benötigen
- **THEN** darf das System dafür hosteigene Unterrouten unter `/admin/media/...` bereitstellen
- **AND** diese Unterrouten bleiben an denselben Host-, Guard- und Berechtigungsvertrag gebunden
- **AND** sie umgehen nicht die zentrale Medien-Capability

#### Scenario: Content-Editor startet hostseitigen Medien-Overlay-Flow

- **WHEN** ein berechtigter Benutzer in einem Content-Editor `Aus Medienverwaltung auswählen` oder `Neu hochladen` startet
- **THEN** öffnet das System einen hostseitig gesteuerten Medien-Overlay-Flow statt eines plugin-eigenen Upload- oder Bibliotheksdialogs
- **AND** der Overlay-Flow verwendet denselben kanonischen Upload-Intake wie die Medienverwaltung
- **AND** der Abschluss bleibt kontextabhängig an den aufrufenden Editor gebunden

### Requirement: Redaktionelle und technische Metadaten

Das System SHALL technische und redaktionelle Metadaten getrennt, aber gemeinsam verwaltbar halten.

#### Scenario: Redaktion pflegt Metadaten

- **WHEN** ein Redakteur ein Medium im Studio bearbeitet
- **THEN** kann er mindestens Titel, Beschreibung, Alt-Text, Copyright und Lizenz pflegen
- **AND** technische Metadaten wie MIME-Type, Größe oder Abmessungen bleiben systemseitig nachvollziehbar

#### Scenario: Upload im Content-Kontext erzwingt Review vor Abschluss

- **WHEN** ein Benutzer im Content-Kontext ein neues Medium hochlädt
- **THEN** wechselt der hostseitige Medien-Overlay-Flow nach erfolgreichem Upload in einen Review-Schritt für redaktionelle Metadaten
- **AND** der Benutzer kann dort mindestens Titel, Beschreibung, Alt-Text, Copyright und Lizenz pflegen
- **AND** der Overlay-Flow darf das Medium erst nach einem expliziten Abschluss in den Content-Kontext zurückgeben
