## ADDED Requirements

### Requirement: Least-Privilege-Service-Token für MCP-Instanzanlage

Das System SHALL den lokalen MCP-Pfad zur Instanzanlage ausschließlich über einen dedizierten, kurzlebigen und an die Zielumgebung gebundenen Service-Token autorisieren. Dieser Maschinenpfad ersetzt Browser-spezifische Nachweise nur für die explizit freigegebene Aktion.

#### Scenario: Gültiger Service-Token autorisiert die MCP-Instanzanlage

- **WHEN** ein lokaler MCP-Client einen nicht abgelaufenen Service-Token mit gültigem Aussteller, passender Audience und Berechtigung für die Instanzanlage vorlegt
- **THEN** darf Studio die Instanzanlage als Maschinenpfad ausführen
- **AND** prüft Studio weiterhin die Root-Host-Grenze und alle fachlichen Eingabevalidierungen
- **AND** bleiben Browser-Session, CSRF und Fresh-Reauth für interaktive Aufrufe unverändert verpflichtend

#### Scenario: Falsch gebundener oder unberechtigter Service-Token wird fail-closed abgelehnt

- **WHEN** ein Service-Token abgelaufen ist, einen ungültigen Aussteller, eine falsche Audience oder keine Berechtigung für die Instanzanlage besitzt
- **THEN** lehnt Studio den Request fail-closed ab
- **AND** führt es keine fachliche Mutation aus
- **AND** enthält die Außenantwort weder Token- noch sicherheitskritische Prüfdetails

### Requirement: Action-spezifische Bestätigung kritischer MCP-Mutationen

Das System SHALL kritische MCP-Mutationen mit vollständig qualifizierten, action-spezifischen Berechtigungen und einer serverseitig gebundenen Bestätigungs-Challenge absichern. Ein Service-Token darf nur die minimal benötigten Actions tragen.

#### Scenario: Kritische Aktion wird nur nach aktueller Challenge ausgeführt

- **WHEN** ein berechtigter MCP-Client eine kritische Action ausführen möchte
- **THEN** muss er zuvor einen passenden Zustand oder Plan gelesen und eine an Action, Instanz, Zustands-/Versionswert und Ablauf gebundene Challenge erhalten haben
- **AND** prüft Studio Scope, Challenge, Bestätigungsphrase und Idempotenz atomar vor der Mutation

#### Scenario: Challenge kann nicht für andere oder spätere Aktionen wiederverwendet werden

- **WHEN** eine Challenge für eine andere Action oder Instanz verwendet wird, abgelaufen ist, bereits verbraucht wurde oder sich der relevante Instanzzustand geändert hat
- **THEN** lehnt Studio die kritische Mutation fail-closed ab
- **AND** verlangt es einen neuen Vorab-Read oder Plan
