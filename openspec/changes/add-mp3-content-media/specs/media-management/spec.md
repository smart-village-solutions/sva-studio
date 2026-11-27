## ADDED Requirements

### Requirement: MP3 im gemeinsamen Medienablauf

Das System SHALL MP3 über den bestehenden Upload-, Verarbeitungs- und Medienauswahlpfad für redaktionelle Hörbeiträge unterstützen.

#### Scenario: Gültiger MP3-Upload wird nutzbar

- **WHEN** eine berechtigte Person eine MP3-Datei innerhalb des geltenden Größenlimits hochlädt
- **THEN** prüft das System die Audiodaten serverseitig und verarbeitet die Datei über private Quarantäne und Scanfreigabe
- **AND** liefert es eine stabile Auslieferungsadresse für ein zur öffentlichen Verwendung freigegebenes Original

#### Scenario: Der Scan hat keine Freigabe erteilt

- **WHEN** Scan oder öffentliche Auslieferung fehlen oder der Scan fehlschlägt
- **THEN** wird die Datei über den öffentlichen Medienpfad weder ausgeliefert noch bei öffentlichen App-Inhalten zugeordnet

#### Scenario: Datei ist ungültig oder Asset ist geschützt

- **WHEN** die Datei keine MP3-Audiodaten enthält, das Größenlimit überschreitet oder ein geschütztes Asset für Inhalte der öffentlichen App gewählt wird
- **THEN** weist der Server Upload beziehungsweise Zuordnung mit einem verständlich darstellbaren Fehler zurück
- **AND** macht die Zuordnung geschützte und fremde Assets nicht öffentlich erreichbar

#### Scenario: Eingefügter Medienlink umgeht keine Freigabe

- **WHEN** eine Person die URL eines vom Studio verwalteten Mediums als Direktlink einfügt
- **THEN** prüft der Server Mandant, Berechtigung und öffentliche Freigabe wie bei der Asset-Auswahl vor dem Mainserver-Schreibaufruf
- **AND** weist er nicht eindeutig auflösbare, geschützte oder signierte URLs dieses Medienpfads zurück
