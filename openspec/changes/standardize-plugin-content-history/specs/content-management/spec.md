## ADDED Requirements

### Requirement: Alle redaktionell veränderbaren Plugin-Inhalte besitzen eine funktionale Historie

Das System MUST für jede aktive Plugin-Contribution mit redaktionell veränderbaren Datensätzen eine funktionale, hostseitig geladene Historienansicht bereitstellen. Ein sichtbarer Platzhalter oder eine dauerhaft leere Schein-Historie erfüllt diese Anforderung nicht.

#### Scenario: Bestehendes Content-Plugin zeigt echte Historieneinträge

- **WENN** ein berechtigter Benutzer die Historie eines bestehenden Plugin-Inhalts öffnet
- **DANN** lädt der Host die für diesen Inhalt erfassten Änderungen
- **UND** das Plugin zeigt mindestens Zeitpunkt, lokalisierte Aktion, Actor und Änderungsgegenstand an
- **UND** Lade-, Leer-, Fehler- und Erfolgszustand sind unterscheidbar

#### Scenario: Plugin besitzt keine redaktionell veränderbaren Datensätze

- **WENN** eine Plugin-Contribution ausschließlich Infrastruktur, SDK-Funktionen, Auswahlwerte oder andere nicht redaktionell mutierbare Beiträge bereitstellt
- **DANN** klassifiziert der Host sie explizit als nicht historienpflichtig
- **UND** die UI zeigt dafür keinen funktionslosen Historien-Tab

### Requirement: Mainserver-Inhalte zeigen ausschließlich Studio-seitige Änderungen

Das System MUST für Mainserver-basierte Inhalte eine Studio-Mutationshistorie führen, die ausschließlich erfolgreich über das Studio ausgeführte Änderungen enthält. Das System MUST diese Historie als Studio-seitig und nicht als vollständige Mainserver-Historie kennzeichnen.

#### Scenario: Studio ändert einen Mainserver-Inhalt erfolgreich

- **WENN** eine autorisierte Änderung eines Mainserver-Inhalts über das Studio fachlich erfolgreich abgeschlossen wird
- **DANN** erzeugt der Host einen korrelierbaren Historieneintrag für den Inhalt
- **UND** der Eintrag enthält die Studio-Aktion, den autorisierten Actor, den Zeitpunkt und die bekannten Änderungsfelder

#### Scenario: Mainserver-Mutation schlägt fehl

- **WENN** eine über das Studio ausgelöste Mainserver-Mutation abgelehnt wird oder technisch fehlschlägt
- **DANN** erscheint sie nicht als erfolgreiche Änderung in der sichtbaren Inhaltshistorie
- **UND** der Versuch bleibt gemäß Audit-Vertrag nachvollziehbar

#### Scenario: Inhalt wird außerhalb des Studios verändert

- **WENN** ein Mainserver-Inhalt direkt im Mainserver oder über ein anderes System verändert wird
- **DANN** erzeugt das Studio keinen synthetischen Historieneintrag
- **UND** die Historienansicht behauptet keine vollständige Erfassung externer Änderungen

### Requirement: Plugin-Historien verwenden ein gemeinsames Darstellungsmodell

Das System SHALL Plugin-Historien mit einem gemeinsamen, lokalisierten und barrierefreien Darstellungsmodell ausgeben. Die Historienansicht MUST schreibgeschützt sein und MUST Herkunft sowie Abdeckungsgrenze erkennbar machen, wenn die führende Datenquelle außerhalb des Studios liegt.

#### Scenario: Historie wird erfolgreich dargestellt

- **WENN** Historieneinträge geladen wurden
- **DANN** zeigt die UI Zeitpunkt in der konfigurierten Editor-Zeitzone, Aktion, Actor, Zusammenfassung und vorhandene geänderte Felder
- **UND** verwendet sie semantische Listen- oder Tabellenstrukturen mit zugänglichen Beschriftungen
- **UND** enthält das History-Panel keine Aktion zum Speichern des aktuellen Editorformulars

#### Scenario: Historie kann nicht geladen werden

- **WENN** der History-Read fehlschlägt oder nicht autorisiert ist
- **DANN** zeigt die UI einen lokalisierten und für assistive Technologien wahrnehmbaren Fehlerzustand
- **UND** stellt keine veralteten oder fremden Historieneinträge als aktuellen Erfolg dar
