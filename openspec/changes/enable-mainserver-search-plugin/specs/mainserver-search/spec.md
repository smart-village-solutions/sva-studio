## ADDED Requirements

### Requirement: Bestehendes optionales Suchplugin

Das System SHALL die Suche im bestehenden Plugin `search` bereitstellen. Header-Einstieg, Ergebnisseite und Suchhandler MUST Pluginaktivierung, angemeldete Sitzung, Instanzkontext und `search.read` berücksichtigen. Die Suchpermission MUST von den Leserechten der gefundenen Inhalte getrennt bleiben.

#### Scenario: Suchplugin ist verfügbar und berechtigt

- **WHEN** das Plugin für die aktive Instanz aktiviert ist und der Benutzer `search.read` besitzt
- **THEN** ist der Sucheinstieg in der Kopfzeile nutzbar
- **AND** wird die Ergebnisseite vom Host unter `/plugins/search` materialisiert

#### Scenario: Plugin oder Suchrecht fehlt

- **WHEN** das Plugin deaktiviert ist oder `search.read` fehlt
- **THEN** erscheint kein bedienbarer Header-Einstieg
- **AND** lehnt der Server direkte Suchanfragen gemäß dem bestehenden Aktivierungs- und Autorisierungsvertrag ab

### Requirement: Öffentliche Mainserver-Suchkandidaten

Das System SHALL die bereits öffentlich indexierten Mainserver-Inhalte innerhalb des serverseitig bestimmten Quell-, Gemeinde- und Umgebungskontexts durchsuchen. Es MUST ausschließlich bestehende unterstützte Studio-Typ- und Detailverträge nutzen und MUST mehrdeutige Kandidatenidentitäten oder Typzuordnungen vor der Ausgabe auflösen.

#### Scenario: Suchkandidat hat denselben Zahlenwert wie ein anderer Inhaltstyp

- **WHEN** zwei Quellmodelle dieselbe numerische ID liefern
- **THEN** bleiben beide Kandidaten anhand Verbindung, Umgebung, Quellmodell und ID unterscheidbar

#### Scenario: GenericItem benötigt fachliche Zuordnung

- **WHEN** ein Suchkandidat aus dem GenericItem-Index stammt
- **THEN** wird dessen konkreter registrierter Studio-Inhaltstyp vor der Berechtigungsprüfung ermittelt
- **AND** erzeugt ein fehlendes Fachrecht keinen generischen Ersatztreffer
- **AND** wird eine ungeklärte Zuordnung nicht als erlaubter Treffer ausgegeben

### Requirement: Serverseitige Suchautorisierung

Das System SHALL Suchkandidaten vor Ausgabe anhand der bestehenden Studio-Leseregeln und des Mainserver-Zugriffskontexts prüfen. Es MUST den aktuellen Benutzer und die aktive Organisation verwenden und MUST weder alle Organisationsmitgliedschaften vereinigen noch Besitzgleichheit mit allgemeinem Lesezugriff gleichsetzen.

#### Scenario: Kandidaten haben unterschiedliche Zugriffsentscheidungen

- **WHEN** eine Abfrage erlaubte und wegen Berechtigung ausgeschlossene Kandidaten liefert
- **THEN** enthält die Browserantwort nur für erlaubte Kandidaten Titel, Vorschau, Datenanbieter und Detailverweis
- **AND** wird eine erlaubte Leseentscheidung nicht als Bearbeitungsberechtigung verwendet

#### Scenario: Lesen ohne manuellen Kontowechsel

- **WHEN** eine Suche im bestehenden Sitzungskontext ausgeführt wird
- **THEN** bestimmt die vorhandene Credential-Policy den Leseprincipal automatisch
- **AND** bleibt die explizite Ressourcenautorisierung mit diesem Principal erhalten
- **AND** führt eine Rechteablehnung nicht zum Ausprobieren eines anderen Zugangs

#### Scenario: Kontext wechselt während einer Anfrage

- **WHEN** Benutzer, Instanz oder aktive Organisation während Suche oder Zählung wechselt
- **THEN** werden Ergebnisse und Zählstände des alten Kontexts verworfen
- **AND** werden nachfolgende Suchanfragen im neuen Kontext erneut autorisiert

### Requirement: Vollständigkeitsabhängige Trefferzahlen

Das System SHALL erlaubte und eindeutig wegen Berechtigung ausgeschlossene Treffer desselben Such-/Filter-/Quellumfangs getrennt zählen. Eine exakte Anzeige wie „20 Ergebnisse (+ 30 ohne passende Berechtigung)“ MUST vollständig erfasste, deduplizierte und abschließend geprüfte Kandidaten voraussetzen. Ungeklärte oder technisch fehlgeschlagene Prüfungen MUST von Berechtigungsablehnungen unterschieden werden.

#### Scenario: Alle Kandidaten wurden geprüft

- **WHEN** die vollständige Abfrage 20 erlaubte und 30 eindeutig abgelehnte Treffer ohne ungeklärte Kandidaten ergibt
- **THEN** wird die entsprechende exakte aggregierte Anzeige ausgegeben
- **AND** bleiben Angaben einzelner ausgeschlossener Inhalte verborgen

#### Scenario: Kandidatenbestand oder Prüfung ist unvollständig

- **WHEN** weitere Kandidatenseiten fehlen, ein Ergebnis-/Zeitlimit erreicht ist oder eine Zuordnung nicht belastbar aufgelöst wurde
- **THEN** wird keine exakte Gesamtzahl behauptet
- **AND** wird die Unvollständigkeit sichtbar gekennzeichnet
- **AND** erscheint ein laufender Ladehinweis nur während tatsächlich laufender Arbeit

### Requirement: Ergebnisseite mit kombinierbaren Filtern

Das Suchplugin SHALL genau ein dauerhaftes Suchfeld im Header auf Desktop und Mobil sowie eine Ergebnisseite mit zugänglichen Treffern in der vorhandenen StudioDataTable, Zählstatus, Inhaltstyp- und Kategorie-Mehrfachauswahl sowie einem Datenanbieterfilter anbieten. Die Ergebnisseite MUST ohne zusätzliche Sucheingabe auskommen. Titel, Inhaltstyp und Datenanbieter MUST über die üblichen Tabellenfunktionen sortierbar sein. Filteroptionen und Optionszahlen MUST aus dem berechtigt lesbaren Bestand stammen. Suchbegriff, fachliche Filter, Sortierung und sichtbares Paging MUST hostvalidiert und typisiert in der URL abgebildet werden.

#### Scenario: Benutzer kombiniert Filter

- **WHEN** der Benutzer Inhaltstyp, Kategorien oder Datenanbieter ändert
- **THEN** werden die Filter gemeinsam angewendet und das sichtbare Paging zurückgesetzt
- **AND** können aktive Filter einzeln oder gemeinsam zurückgesetzt werden
- **AND** beziehen sich Treffer und ausgeschlossene Gesamtzahl auf denselben Filtersatz

#### Scenario: Benutzer navigiert zurück

- **WHEN** der Benutzer einen Treffer öffnet und anschließend zurück zur Suche navigiert
- **THEN** wird der Such-/Filter-/Pagingzustand aus der URL wiederhergestellt
- **AND** wird der weiterhin maßgebliche Sitzungskontext nicht durch URL-Parameter überschrieben

### Requirement: Paging nach Zugriffsprüfung

Das System SHALL berechtigte Treffer vor dem sichtbaren Paging auswählen und gemäß der validierten Sortierung ordnen und bei Bedarf weitere Upstream-Seiten prüfen. Es MUST eine stabile, deduplizierte Reihenfolge verwenden und MUST eine Kandidatenseite ohne erlaubte Treffer von einem erschöpften Suchbestand unterscheiden.

#### Scenario: Erste Kandidatenseite enthält nur ausgeschlossene Treffer

- **WHEN** spätere Kandidatenseiten noch ungeprüft sind
- **THEN** wird die Suche nicht vorzeitig als ergebnislos beendet
- **AND** werden weitere Kandidaten innerhalb der technischen Grenzen geprüft

### Requirement: Zugängliche und geheimnisfreie Suchoberfläche

Das System SHALL vorhandene Studio-Design-System-Komponenten, deutsche und englische Übersetzungen und WCAG-2.1-AA-konforme Interaktionen verwenden. Browser und Suchantworten MUST frei von Master-/Suchschlüsseln sein; ausgeschlossene Dokumentinhalte und ungeprüftes Highlight-HTML MUST verborgen bleiben. Der Server MUST geschützte Suchzugänge verwenden und rohe Suchbegriffe oder Dokumentinhalte aus technischen Logs fernhalten.

#### Scenario: Suche wird per Tastatur oder mobil bedient

- **WHEN** ein Benutzer das Suchfeld im Header auf Desktop oder Mobil per Enter absendet
- **THEN** führt der Einstieg zur selben zugänglichen Ergebnisseite
- **AND** sind Fokus, Filterbedienung und Statusmeldungen ohne Maus verständlich

#### Scenario: Suchdienst ist nicht erreichbar

- **WHEN** Meilisearch oder eine notwendige Zugriffsprüfung ausfällt
- **THEN** zeigt die Oberfläche einen unterscheidbaren Fehler- oder Unvollständigkeitszustand
- **AND** wird daraus weder ein erlaubter Treffer noch eine scheinbar erfolgreiche leere Gesamtsuche abgeleitet
