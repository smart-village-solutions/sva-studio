## ADDED Requirements
### Requirement: Bearbeitbare Plugin-Rechte in der Rollenverwaltung
Die Studio-Admin-UI SHALL plugin-spezifische Rechte aus einer zentralen Plugin-Permission-Registry generisch in der Rollenverwaltung bearbeitbar anzeigen.

#### Scenario: Rollen-Detailseite gruppiert Plugin-Rechte fachlich
- **GIVEN** ein Administrator ist eingeloggt und hat Rollenverwaltungsrechte
- **WHEN** er eine Rollen-Detailseite unter `/admin/roles/$roleId` öffnet
- **THEN** werden Rechte für `News`, `Events` und `POI` als eigene fachliche Gruppen angezeigt
- **AND** die Rechte sind bearbeitbar, ohne dass der Administrator rohe technische Strukturen wie JSON-Scopes interpretieren muss
- **AND** die Darstellung ist nicht auf diese drei Plugins hartcodiert, sondern aus der Registry erweiterbar

### Requirement: Plugin-Rechte sind in Gruppenansichten sichtbar
Die Studio-Admin-UI SHALL plugin-spezifische Rechte in Gruppenansichten verständlich ausweisen.

#### Scenario: Veraltete content-Rechte werden nicht als produktive Plugin-Rechte angezeigt
- **GIVEN** ein Administrator ist eingeloggt und hat Rollenverwaltungsrechte
- **WHEN** er die Rechte einer Rolle prüft
- **THEN** zeigt die UI `news.*`, `events.*` und `poi.*` als fachliche Plugin-Rechte an
- **AND** veraltete `content.*`-Einträge werden nicht als bearbeitbarer Redaktionsvertrag für News, Events oder POI angeboten
