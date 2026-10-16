## ADDED Requirements

### Requirement: Bus-Key-Bereich in der zentralen Instanzverwaltung

Das System SHALL im vorhandenen Root-Instanzdetail unter Betrieb einen Bereich für
Bus-API-Keys bereitstellen. Dieser Bereich SHALL ausschließlich Plattform-Superadmins
zugänglich und kein pro Tenant aktivierbares Modul sein.

#### Scenario: Plattform-Superadmin öffnet Instanzdetail

- **WHEN** ein auf dem Root-Host angemeldeter Benutzer `instance_registry_admin` besitzt
- **THEN** kann er die Keys der ausgewählten Instanz auflisten, erstellen, sperren und zulässig reaktivieren
- **AND** werden ausschließlich Datensätze mit exakt passender `label = instanceId` angezeigt
- **AND** steht der Bereich unter „IAM-Basis neu aufbauen“ mit „Key erstellen“ als erster Aktion unten links vor „Metadaten neu laden“

#### Scenario: Tenant-Administrator versucht Zugriff

- **WHEN** ein Tenant-Benutzer einschließlich `system_admin` den Bereich zu öffnen versucht
- **THEN** bleibt der Bereich unzugänglich, unabhängig von Tenant-Modulen, Rollen, Gruppen oder Organisationen

### Requirement: Formular für Bus-Key-Metadaten und UTC-Ablauf

Das System SHALL den Ort und die Instanz-ID aus der Registry anzeigen und bei der
Erstellung Kontakt-E-Mail, Erstellerinitialen und einen letzten Gültigkeitstag abfragen.
Kontakt und Initialen SHALL client- und serverseitig validierte Pflichtfelder sein.

#### Scenario: Erstellung mit Jahresend-Standard

- **WHEN** der berechtigte Benutzer das Formular im Kalenderjahr 2026 öffnet
- **THEN** ist Gültig bis einschließlich mit dem 31. Dezember 2026 vorbelegt
- **AND** berechnet der Server daraus `expiresAt = 2027-01-01T00:00:00.000Z`
- **AND** stammen `owner` und `label` aus dem serverseitig geprüften Instanzkontext

#### Scenario: Benutzer wählt einen anderen letzten Gültigkeitstag

- **WHEN** der Benutzer den 15. März 2027 wählt und der Ablauf beim Absenden noch zukünftig ist
- **THEN** berechnet der Server `expiresAt = 2027-03-16T00:00:00.000Z`
- **AND** beeinflussen Browser-Zeitzone und Sommerzeit den gespeicherten Tag nicht
- **AND** wird der genaue UTC-Ablauf erklärt

### Requirement: Einmalige Key-Anzeige und bewusste Rotation

Das System SHALL neu erzeugte Klartext-Keys nur einmal im flüchtigen UI-Zustand mit
expliziter Kopieraktion anzeigen und deren Persistenz in Browser-Speichern verhindern.
Rotation SHALL einen neuen und alten Key vorübergehend parallel erlauben.

#### Scenario: Key wurde über den Button kopiert

- **WHEN** das Kopieren des angezeigten API-Keys über den Kopierbutton erfolgreich ist
- **THEN** erscheint die Bestätigung im reservierten Platz neben den Buttons
- **AND** zeigt der Dialog keine zusätzliche Key-ID
- **AND** schließt „Schließen“ den Dialog ohne weitere Rückfrage

#### Scenario: Benutzer muss vor dem Schließen noch kopieren

- **WHEN** der Benutzer die Key-Anzeige ohne erfolgreiche Kopieraktion schließen möchte
- **THEN** erscheint eine Rückfrage zur einmaligen Sichtbarkeit des API-Keys
- **AND** schließt „Ja, ich habe den API-Key kopiert“ den Dialog
- **AND** führt „Nein, ich muss den API-Key noch kopieren“ zur Anzeige desselben API-Keys zurück

#### Scenario: Kopieren in die Zwischenablage schlägt fehl

- **WHEN** die Zwischenablage den Kopieraufruf ablehnt
- **THEN** erscheint die Fehlermeldung im geöffneten Key-Dialog mit dem Hinweis zur manuellen Übernahme
- **AND** wird der Key nicht als erfolgreich kopiert markiert

#### Scenario: Anzeige wird geschlossen oder Instanz gewechselt

- **WHEN** der Benutzer die Key-Anzeige schließt oder eine andere Instanz öffnet
- **THEN** wird der Klartext-Key verworfen
- **AND** dürfen verspätete Antworten der zuvor geöffneten Instanz nicht erscheinen

#### Scenario: Alter Key wird nach Client-Umstellung gesperrt

- **WHEN** ein neuer Key erstellt wird
- **THEN** bleibt der bisherige Key zunächst gültig
- **AND** kann der Benutzer ihn nach Client-Umstellung bewusst mit Bestätigung sperren
- **AND** kennzeichnet der Sperrdialog die betroffene ID mit **Key-ID:** und verwendet für die Sperraktion die rote Buttonvariante
- **AND** verlängert Reaktivieren niemals das Ablaufdatum und bleibt für abgelaufene Keys gesperrt

#### Scenario: Erstellung endet mit unklarem Ausgang

- **WHEN** nach dem Create-Aufruf ein Timeout auftritt
- **THEN** erklärt Studio den unklaren Ausgang und lädt die Metadaten neu
- **AND** wird keine automatische erneute Key-Erstellung ausgelöst
