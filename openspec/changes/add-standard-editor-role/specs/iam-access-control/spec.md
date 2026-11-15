## ADDED Requirements

### Requirement: Standard Redakteur besitzt ein begrenztes vollständiges Redaktionsprofil

Das System MUST die löschbare tenantlokale Studio-Rolle `standard_editor` mit Anzeigename „Standard Redakteur“ unterstützen. Sie MUST alle redaktionellen Inhaltsfähigkeiten der verfügbaren Inhaltsmodule einschließlich Veröffentlichung, Zurückziehen, Planung, Archivierung, Wiederherstellung, History-Lesen und fachlich unterstütztem Push-Versand erhalten. Sie MUST keine Benutzer-, Rollen-, Organisations-, Modulkonfigurations-, Schnittstellen-, Eigentumsübertragungs- oder Revisionsverwaltungsrechte aus diesem Profil erhalten.

#### Scenario: Inhalt der eigenen Organisation oder persönlicher Inhalt

- **WHEN** ein Standard Redakteur einen Inhalt seiner aktiven eigenen Organisation oder einen persönlich ihm gehörenden Inhalt desselben Mandanten bearbeitet, löscht, veröffentlicht oder per Push versendet
- **THEN** erlaubt das System die fachlich unterstützte Action bei verfügbarem Inhaltsmodul
- **AND** persönliche Inhalte bleiben unabhängig von ihrer Zugehörigkeit zur aktiven Organisation zugänglich

#### Scenario: Fremder oder nicht eindeutig zugeordneter Inhalt

- **WHEN** ein Inhalt weder der aktiven eigenen Organisation noch persönlich dem Account gehört oder keine eindeutige Ownership auflösbar ist
- **THEN** gewährt die Standardrolle keine Änderung, Löschung, Statusänderung oder Push-Aktion
- **AND** breite Mainserver-Credentials und Kompatibilitätspfade umgehen diese Prüfung nicht

#### Scenario: Keine aktive Organisation und fremder Mandant

- **WHEN** keine eigene Organisation aktiv ist
- **THEN** beschränkt sich der Datensatzzugriff aus diesem Profil auf persönlich zugeordnete Inhalte
- **AND** der Zugriff auf fremde Mandanten bleibt immer ausgeschlossen

#### Scenario: Vollständiger Redaktionsablauf

- **WHEN** ein Redakteur einen berechtigten Inhalt erstellt, dessen Fachdaten und Metadaten bearbeitet, die Veröffentlichung plant oder zurückzieht, ihn archiviert oder wiederherstellt und die Historie öffnet
- **THEN** erhält er die jeweils benötigten Rechte und Redaktionszugänge
- **AND** prüfen direkte Serveraufrufe dieselben Eigentumsgrenzen wie die Oberfläche
- **AND** Erstellen erlaubt keine Zuordnung zu einem fremden Principal

### Requirement: Standard Redakteur verwaltet Medien und Kategorien mandantenweit

Die Standardrolle MUST Medien und Kategorien im eigenen Mandanten lesen, erstellen, bearbeiten, verwenden und löschen können. Das System MUST diese Ressourcen ohne Organisationsbeschränkung behandeln und bestehende Referenzintegrität beim Löschen bewahren.

#### Scenario: Gemeinsame Ressource verwenden

- **WHEN** eine Kategorie oder ein Medium im eigenen Mandanten verfügbar ist
- **THEN** darf der Standard Redakteur die Ressource unabhängig von seiner Organisation verwalten und in berechtigten Inhalten verwenden
- **AND** daraus entsteht kein Zugriff auf Ressourcen fremder Mandanten

#### Scenario: Referenzierte Ressource löschen

- **WHEN** eine Ressource noch in Inhalten referenziert ist
- **THEN** erhält der bestehende Löschvertrag die Referenzintegrität und hinterlässt keine beschädigten Inhaltsverweise
