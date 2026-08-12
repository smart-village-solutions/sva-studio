## ADDED Requirements

### Requirement: Studio benennt erforderliche Berechtigungen verständlich und technisch eindeutig

Die Account- und Fach-UI MUST strukturierte Berechtigungsablehnungen über einen gemeinsamen lokalisierten Darstellungspfad ausgeben. Jede belastbar bekannte Permission MUST mit ihrem verständlichen lokalisierten Namen und ihrer technischen Action-ID erscheinen; fehlt ein Name, MUST die validierte Action-ID als sicherer Fallback sichtbar bleiben.

#### Scenario: Einzelne Permission fehlt

- **WHEN** die UI einen validierten Denial mit `permission_missing` und `iam.user.write` erhält
- **THEN** zeigt sie sinngemäß „Fehlende Berechtigung: Benutzer bearbeiten (`iam.user.write`)“
- **AND** verwendet sie den zentral registrierten deutschen oder englischen Berechtigungsnamen

#### Scenario: Lokalisierter Name ist nicht verfügbar

- **WHEN** eine validierte Action-ID keinen auflösbaren lokalisierten Namen besitzt
- **THEN** zeigt die UI mindestens die technische Action-ID
- **AND** fällt die gesamte Fehleranzeige nicht aus

#### Scenario: Alle aufgeführten Permissions sind erforderlich

- **WHEN** ein Denial mehrere Permissions mit `requirement_mode = allOf` enthält
- **THEN** benennt die UI alle tatsächlich fehlenden Permissions als gemeinsam erforderlich
- **AND** zeigt sie für jede Permission Name und Action-ID beziehungsweise den Action-ID-Fallback

#### Scenario: Eine alternative Permission ist ausreichend

- **WHEN** ein Denial mehrere Permissions mit `requirement_mode = anyOf` enthält
- **THEN** kommuniziert die UI, dass eine der aufgeführten Berechtigungen erforderlich ist
- **AND** behauptet sie nicht, dass sämtliche Alternativen gleichzeitig vergeben werden müssen

#### Scenario: Permission ist im aktuellen Kontext nicht ausreichend

- **WHEN** der Denial-Grund einen Scope-, Hierarchie- oder ABAC-Konflikt beschreibt
- **THEN** benennt die UI die erforderliche Action
- **AND** erklärt sie, dass die Berechtigung im aktuellen Kontext nicht ausreicht
- **AND** bezeichnet sie die Action nicht fälschlich als vollständig fehlend

#### Scenario: Permission-Zustand ist technisch nicht verfügbar

- **WHEN** die Berechtigungsauflösung degradiert oder technisch fehlgeschlagen ist
- **THEN** zeigt die UI einen lokalisierten Verfügbarkeits- oder Retry-Zustand
- **AND** nennt sie keine spekulativ fehlende Permission

#### Scenario: Berechtigungsfehler ist barrierefrei wahrnehmbar

- **WHEN** eine Berechtigungsablehnung nach Navigation oder Fachaktion dargestellt wird
- **THEN** verwendet die UI einen bestehenden persistenten und semantisch geeigneten Alert-Zustand
- **AND** ist die vollständige Information ohne Farbe verständlich
- **AND** kann die technische Action-ID als Text ausgewählt und kopiert werden

### Requirement: Host und Plugins teilen denselben Permission-Anzeigekatalog

Das Studio MUST lokalisierte Permission-Namen aus einem gemeinsamen Hostvertrag auflösen, der Core-/Host-Permissions und registrierte Plugin-Permissions umfasst. Plugins dürfen für Berechtigungsablehnungen keinen parallelen Formatter oder abweichenden technischen Fehlervertrag benötigen.

#### Scenario: Registrierte Plugin-Permission wird verweigert

- **WHEN** eine registrierte Plugin-Action wie `news.update` serverseitig verweigert wird
- **THEN** löst der Host den Namen über die registrierte Plugin-Permission-Definition auf
- **AND** zeigt die gemeinsame Fehlerdarstellung Name und `news.update`

#### Scenario: Übersetzungsvollständigkeit wird geprüft

- **WHEN** Host- oder Plugin-Permissions für die produktive Registry registriert werden
- **THEN** prüft ein automatisierter Katalogtest die vorgesehenen deutschen und englischen Namen
- **AND** bleibt die technische Action-ID der Laufzeit-Fallback für kompatible oder unbekannte Erweiterungen
