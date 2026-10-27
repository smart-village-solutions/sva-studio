## ADDED Requirements

### Requirement: Refresh-Fallback erhält den vollständigen gültigen Sessionkontext

Das Studio MUST bei einem zulässigen Fallback nach transientem Token-Refreshfehler denselben vollständigen Organisations- und Auth-Scope erhalten wie bei regulärer Sessionauflösung. Die fachliche Gültigkeit von `Session.expiresAt`, absolute Maxdauer und benutzerbezogener Widerruf MUST unverändert führend bleiben. Ein technischer Fehler MUST keine aktive Organisation still durch einen persönlichen Principal ersetzen.

#### Scenario: Refresh scheitert vor Ablauf bei aktiver Organisation

- **WHEN** der Token-Refresh einer noch gültigen Session mit aktiver Organisation vorübergehend scheitert
- **THEN** enthält ein weiterhin authentifiziertes Ergebnis dieselbe aktive Organisation und denselben Auth-Scope
- **AND** konsumieren Middleware und nachfolgende Plugin-/Content-Prüfungen diesen vollständigen Kontext

#### Scenario: Fachliche Sessiongrenze oder Widerruf ist erreicht

- **WHEN** Sessionablauf, absolute Maxdauer oder Widerrufsmarker eine Session ungültig machen
- **THEN** gibt auch ein Refresh-Fallback keine geschützte Aktion frei
- **AND** verlängert ein Speicher-Retry die Session nicht über ihre fachliche Grenze

### Requirement: Session-Updates und Refreshes sind gegen konkurrierende Zustandsverluste geschützt

Der bestehende Studio-Session-Store MUST Feldänderungen atomar gegen den maßgeblichen gelesenen Zustand anwenden. Parallele Organisations- und Tokenänderungen MUST erhalten bleiben; veraltete Tokenpakete und Updates auf gelöschte, abgelaufene oder widerrufene Sessions MUST abgewiesen werden. Konfliktbehandlung SHALL begrenzt und topologiegerecht im bestehenden Session-/Redis-Pfad erfolgen, ohne neue allgemeine Lock-Infrastruktur oder Änderung externer IdP-Verträge.

#### Scenario: Organisationswechsel und Refresh überlappen

- **WHEN** Organisationswechsel und Refresh denselben ursprünglichen Sessionstand lesen und in beliebiger Reihenfolge abschließen
- **THEN** enthält der gültige Endstand sowohl die bestätigte Organisation als auch das maßgebliche neue Tokenpaket
- **AND** kann ein späterer Full-Write keinen dieser bestätigten Feldstände unbemerkt zurücksetzen

#### Scenario: Mehrere geschützte Requests benötigen Refresh

- **WHEN** mehrere Requests derselben Session innerhalb des Refreshfensters eintreffen
- **THEN** werden Refreshes innerhalb der belegten unterstützten Prozess-/Deploymenttopologie koordiniert
- **AND** wird nach dem Warten der aktuelle autoritative Zustand verwendet
- **AND** darf ein veraltetes Refresh-Ergebnis keinen neueren Tokenstand überschreiben

#### Scenario: Session endet zwischen Read und Commit

- **WHEN** Logout, Ablauf oder Widerruf zwischen Lesen und Aktualisieren wirksam wird
- **THEN** wird kein neuer Sessiondatensatz als Nebenwirkung des Updates angelegt
- **AND** kann auch ein später fertiggestellter Refresh die Session nicht wiederbeleben
- **AND** gilt dies auch bei verändertem separatem Widerrufsmarker, obwohl der Session-Key noch vorhanden ist

#### Scenario: Konflikte oder Speicherfehler konvergieren nicht

- **WHEN** die begrenzte Konfliktbehandlung keine gültige Aktualisierung erreicht oder Redis nicht verfügbar ist
- **THEN** liefert Studio einen klassifizierten korrelierten Fehler
- **AND** wird kein lokaler Erfolg oder ungesicherter Sessionstand als autoritativ verwendet
