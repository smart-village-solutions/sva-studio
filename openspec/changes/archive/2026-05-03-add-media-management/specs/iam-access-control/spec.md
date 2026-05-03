## ADDED Requirements
### Requirement: Rollenbasierte Autorisierung für Medienmanagement

Das System SHALL Medienmanagement über die zentrale IAM-Autorisierung absichern.

#### Scenario: Zugriff auf Medienbibliothek ohne Leserecht

- **WHEN** ein Benutzer die Medienbibliothek, einen Media-Picker oder eine Medien-Detailansicht aufruft
- **AND** ihm im aktiven Kontext die Berechtigung `media.read` fehlt
- **THEN** verweigert das System den Zugriff
- **AND** es werden keine Medienmetadaten oder Vorschaudaten offengelegt

#### Scenario: Hostseitiger Admin-Einstieg respektiert Modul- und Guard-Modell

- **WHEN** ein Benutzer `/admin/media` oder eine spezialisierte Medien-Unterseite aufruft
- **THEN** erfolgt die Zugriffskontrolle über denselben hostseitigen Guard- und Sichtbarkeitsvertrag wie bei anderen Admin-Capabilities
- **AND** Medienmanagement entsteht nicht als Sonderpfad außerhalb des aktuellen Modul- oder Guard-Modells

#### Scenario: Upload erfordert eigene Medienberechtigung

- **WHEN** ein Benutzer ein neues Medium hochladen oder einen Upload initialisieren will
- **THEN** prüft das System eine dedizierte Berechtigung wie `media.create`
- **AND** ein Benutzer mit reinem Leserecht darf keinen Uploadpfad nutzen

#### Scenario: Metadatenpflege und Referenzverwaltung sind getrennt steuerbar

- **WHEN** ein Benutzer Metadaten eines Assets ändern oder Referenzen eines Assets verwalten will
- **THEN** prüft das System dafür passende Fachberechtigungen wie `media.update` und `media.reference.manage`
- **AND** nicht autorisierte Änderungen werden serverseitig abgewiesen

#### Scenario: Plugin-Picker respektiert Medienrechte

- **WHEN** ein Plugin den Media-Picker für eine fachliche Rolle öffnet
- **THEN** zeigt das System nur Medien, Rollen und Aktionen an, die im aktiven Berechtigungskontext erlaubt sind
- **AND** direkte Storage-Artefakte oder geschützte Medienmetadaten werden nicht an das Plugin offengelegt

#### Scenario: Löschen oder Archivieren eines Assets ist gesondert geschützt

- **WHEN** ein Benutzer ein Asset löschen oder archivieren will
- **THEN** prüft das System dafür eine dedizierte Berechtigung wie `media.delete`
- **AND** die Freigabeentscheidung berücksichtigt aktive Referenzen und Scope-Grenzen fail-closed

#### Scenario: Geschützte Auslieferung bleibt kontrolliert

- **WHEN** ein nicht öffentliches Medium ausgeliefert werden soll
- **THEN** prüft das System den aktiven Berechtigungskontext für den geschützten Zugriffspfad
- **AND** direkte öffentliche Auslieferung ohne passende Berechtigung bleibt ausgeschlossen

#### Scenario: Signierte Zugriffs-URLs haben eine begrenzte Gültigkeitsdauer

- **WHEN** das System eine signierte URL für ein geschütztes Medium ausstellt
- **THEN** hat die URL eine systemseitig konfigurierbare und nach oben begrenzte Gültigkeitsdauer
- **AND** eine URL ohne Ablaufzeitpunkt oder mit einer die maximale Konfiguration überschreitenden Gültigkeitsdauer wird nicht ausgestellt
