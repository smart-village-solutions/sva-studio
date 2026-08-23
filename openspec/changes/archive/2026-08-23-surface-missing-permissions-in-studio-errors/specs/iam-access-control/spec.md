## ADDED Requirements

### Requirement: Berechtigungsablehnungen benennen die autoritativ geprüften Actions

Das System MUST echte Berechtigungsablehnungen über einen gemeinsamen strukturierten Denial-Vertrag beschreiben. Der Vertrag MUST die autoritativ geprüften fully-qualified Action-IDs und deren Anforderungssemantik enthalten, darf bestehende öffentliche Fehlercodes nur additiv erweitern und darf keine Rollen, Gruppen, Grants, Policy-Ausdrücke oder nicht freigegebenen Diagnosedaten offenlegen.

#### Scenario: Einzelne serverseitig geprüfte Permission fehlt

- **WHEN** eine serverseitige Fachoperation die Action `iam.user.write` prüft
- **AND** die zentrale Autorisierungsentscheidung wegen `permission_missing` verweigert
- **THEN** enthält der strukturierte Fehlerdetailvertrag `required_permissions = ["iam.user.write"]`
- **AND** kennzeichnet er die Anforderung als `allOf`
- **AND** bleibt der bestehende öffentliche Fehlercode kompatibel

#### Scenario: Client kennt eine vermutete andere Action

- **WHEN** ein Client eine Fachoperation auslöst und lokal eine Permission vermutet
- **AND** der Server eine andere primitive Action autoritativ prüft
- **THEN** verwendet die sichtbare Berechtigungsablehnung ausschließlich die serverseitig gelieferte Action
- **AND** ergänzt der Client keine Permission aus Button, Route oder Endpunktname

#### Scenario: Mehrere Permissions sind gemeinsam erforderlich

- **WHEN** eine autoritative Operation mehrere Permissions vollständig verlangt
- **AND** mindestens eine davon fehlt
- **THEN** enthält der Denial-Vertrag die tatsächlich fehlenden Permissions dedupliziert
- **AND** kennzeichnet er die Anforderung als `allOf`

#### Scenario: Eine von mehreren Permissions ist ausreichend

- **WHEN** eine autoritative Operation alternativ eine von mehreren Permissions akzeptiert
- **AND** keine Alternative im aktiven Kontext erlaubt ist
- **THEN** enthält der Denial-Vertrag die zulässigen Permission-Alternativen dedupliziert
- **AND** kennzeichnet er die Anforderung als `anyOf`

#### Scenario: Permission ist wegen Scope oder Bedingung nicht wirksam

- **WHEN** die geprüfte Action grundsätzlich vorhanden sein kann
- **AND** die Autorisierung wegen Scope-, Hierarchie- oder ABAC-Bedingungen verweigert
- **THEN** darf der Denial-Vertrag die geprüfte Action benennen
- **AND** unterscheidet sein sicherer Grund diesen Zustand von `permission_missing`
- **AND** behauptet die Oberfläche nicht, dass die Permission vollständig fehlt

#### Scenario: Technische Permission-Auflösung ist nicht belastbar

- **WHEN** ein Permission-Snapshot fehlt, degradiert ist oder wegen Redis-, Datenbank- oder Recompute-Fehlern nicht ausgewertet werden kann
- **THEN** bleibt die Entscheidung fail-closed
- **AND** liefert das System einen technischen Verfügbarkeitsfehler statt einer behaupteten fehlenden Permission
- **AND** exponiert es keine aus einem alten oder teilweisen Zustand geratenen Action-IDs

#### Scenario: Fachliches Forbidden stammt nicht aus einer Permission-Prüfung

- **WHEN** ein Request wegen CSRF, Hostvalidierung, Principal-Auswahl oder einer anderen fachlichen Regel mit `403` abgewiesen wird
- **AND** keine autoritative Permission-Entscheidung den gemeinsamen Denial-Vertrag liefert
- **THEN** deutet der Client den Status nicht als fehlende Permission um
- **AND** bleibt die fachliche Fehlerklassifikation erhalten
