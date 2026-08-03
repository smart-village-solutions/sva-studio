## MODIFIED Requirements

### Requirement: Inhalt ist ein erweiterbares Core-Element

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte für spezielle Datentypen erweitert werden kann, referenzbasierte Mediennutzung unterstützt und IAM-Ownership getrennt von Ersteller, Bearbeiter und sichtbarem Autor hält.

#### Scenario: Core-Inhalt wird mit Basiskern angelegt

- **WENN** ein Inhalt gespeichert oder geladen wird
- **DANN** enthält er mindestens `contentType`, Titel, Veröffentlichungsdatum, Erstellungsdatum, Änderungsdatum, Autor, Payload, Status, Historie, `ownerUserId` und `ownerOrganizationId`
- **UND** diese Core-Felder bleiben unabhängig vom konkreten Inhaltstyp verfügbar
- **UND** `ownerUserId` und `ownerOrganizationId` steuern IAM-Zugriff, nicht sichtbare Autorenanzeige

### Requirement: Erstellungs- und Bearbeitungsansicht für Inhalte

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen und Ownership serverseitig nach IAM-Regeln setzen.

#### Scenario: Inhalt anlegen

- **WENN** ein berechtigter Benutzer einen neuen Inhalt anlegt
- **DANN** kann er mindestens Inhaltstyp, Titel, Veröffentlichungsdatum, Payload und Status erfassen
- **UND** das System setzt Erstellungsdatum, Änderungsdatum, Autor, `ownerUserId` und bei aktiver Organisation `ownerOrganizationId` systemseitig
- **UND** der gespeicherte Inhalt ist nach erfolgreichem Speichern in der Inhaltsliste sichtbar, wenn derselbe Scope auch den Detailzugriff erlauben würde

#### Scenario: Inhalt bearbeiten

- **WENN** ein berechtigter Benutzer einen bestehenden Inhalt bearbeitet
- **DANN** kann er Titel, Veröffentlichungsdatum, Payload, Status und bei ausreichender `update`-Permission Ownership-Felder ändern
- **UND** das Änderungsdatum wird nach erfolgreichem Speichern aktualisiert
- **UND** die Bearbeitungsansicht zeigt die aktuellen Metadaten des Inhalts an
- **UND** ein normales Update ändert den sichtbaren Autor nicht automatisch

## ADDED Requirements

### Requirement: Listen- und Detailautorisierung sind deckungsgleich

Das System SHALL für Inhaltslisten, Inhaltsdetails und Inhaltsmutationen dieselben Owner- und Scope-Regeln verwenden.

#### Scenario: Own-Scoped Listeneintrag

- **WENN** ein Benutzer nur `content.read` mit Scope `own` besitzt
- **UND** ein Inhalt `owner_user_id` gleich dem aktuellen Account besitzt
- **DANN** erscheint der Inhalt in der Liste
- **UND** derselbe Benutzer kann die Detailansicht öffnen

#### Scenario: Ownerloser Inhalt

- **WENN** ein Inhalt weder `owner_user_id` noch `owner_organization_id` besitzt
- **UND** ein Benutzer nur `own` oder `organization` Scope besitzt
- **DANN** erscheint der Inhalt nicht in der Liste
- **UND** die Detailansicht wird verweigert
