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

#### Scenario: Content-Editor startet bestehenden hostseitigen Medien-Overlay-Flow

- **WHEN** ein ausreichend berechtigter Benutzer in einem Content-Editor Bibliotheksauswahl oder Upload startet
- **THEN** verwendet das System den bestehenden hostseitig gesteuerten Medien-Overlay-Flow statt eines plugin-eigenen Upload- oder Bibliotheksdialogs
- **AND** verwendet der Overlay-Flow denselben kanonischen Upload-Intake wie die Medienverwaltung
- **AND** bleibt der Abschluss kontextabhängig an den aufrufenden Editor gebunden

### Requirement: Redaktionelle und technische Metadaten

Das System SHALL technische und redaktionelle Metadaten getrennt, aber gemeinsam verwaltbar halten und globale Asset-Metadaten nicht mit contentbezogenen Verwendungsmetadaten gleichsetzen.

#### Scenario: Redaktion pflegt globale Asset-Metadaten

- **WHEN** ein Redakteur mit `media.update` ein Medium in der Medienverwaltung oder im Review bearbeitet
- **THEN** kann er mindestens Titel, Beschreibung, Alt-Text, Copyright und Lizenz am `MediaAsset` pflegen
- **AND** technische Metadaten wie MIME-Type, Größe oder Abmessungen bleiben systemseitig nachvollziehbar
- **AND** bestehende Content-Snapshots werden durch diese Änderung nicht automatisch überschrieben

#### Scenario: Review ohne globale Änderungsberechtigung

- **WHEN** ein Redakteur ein Asset mit `media.read` und `media.reference.manage`, aber ohne `media.update` überprüft
- **THEN** zeigt der Review die globalen Asset-Metadaten schreibgeschützt
- **AND** darf der Redakteur das Asset bei ansonsten erfülltem Zielvertrag übernehmen

#### Scenario: Upload im Content-Kontext erzwingt Review vor Abschluss

- **WHEN** ein Benutzer im Content-Kontext ein neues Medium hochlädt
- **THEN** wechselt der hostseitige Medien-Overlay-Flow nach erfolgreichem Upload in einen Review-Schritt
- **AND** sind globale Metadaten nur mit `media.update` editierbar
- **AND** darf der Overlay-Flow das Medium erst nach einem expliziten Abschluss in den Content-Kontext zurückgeben

## ADDED Requirements

### Requirement: Asset-Verwendung bleibt vom Asset-Lebenszyklus getrennt

Das System SHALL eine konkrete Content-Verwendung als Referenz auf ein eigenständiges `MediaAsset` behandeln und ihren Mainserver-kompatiblen Metadaten-Snapshot nicht als globalen Asset-Zustand interpretieren.

#### Scenario: Content übernimmt Asset-Metadaten als Startwerte

- **WHEN** ein Asset erstmals mit einem Content verknüpft wird
- **THEN** darf der Content unterstützte globale Metadaten als lokale Startwerte übernehmen
- **AND** bleiben spätere lokale Änderungen auf diese Verwendung begrenzt
- **AND** verändert eine lokale Caption- oder Alt-Text-Änderung nicht das globale Asset

#### Scenario: Content-Verwendung wird entfernt

- **WHEN** eine Content-Verwendung entfernt wird
- **THEN** wird ihre `MediaReference` beim nächsten erfolgreichen Referenz-Replace entfernt
- **AND** bleibt das Asset selbst erhalten

#### Scenario: Asset besitzt aktive Referenzen

- **WHEN** ein Benutzer ein Asset mit aktiven Content-Referenzen löschen möchte
- **THEN** greift die bestehende Nutzungstransparenz und Löschsicherung
- **AND** werden Mainserver-Snapshots nicht als Ersatz für die Studio-Referenzsicherheit behandelt
