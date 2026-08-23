## ADDED Requirements

### Requirement: Waste-Tourenliste verwendet die gemeinsamen Tabelleninteraktionen

Das Waste-Management MUST in der Tourenliste die gemeinsamen Studio-Muster für Icon-Aktionen, Status-Badges, anklickbare Informationen und einheitlich oben ausgerichtete Body-Zellen verwenden. Die Migration MUST bestehende Fachlogik, Berechtigungen, Navigation und Mutationen unverändert erhalten.

#### Scenario: Benutzer betrachtet anklickbare Tourinformationen

- **WENN** ein Benutzer die Tourenliste öffnet
- **DANN** erscheinen Tourname, verknüpfte Fraktionen, Verschiebungen und Abholortanzahl im gemeinsamen Muster für anklickbare Informationen
- **UND** werden Fraktionen nicht als Status-Badges dargestellt
- **UND** öffnet der Tourname das bestehende Bearbeitungsziel
- **UND** öffnen Verschiebungen weiterhin ihre Details beziehungsweise das bestehende Erstellungsziel

#### Scenario: Tour besitzt keine Abholortzuordnung

- **GIVEN** eine Tour besitzt `0` zugeordnete Abholorte
- **WENN** der Benutzer die Abholortanzahl aktiviert
- **DANN** öffnet die Liste weiterhin den bestehenden Erstellungsflow für Zuordnungen
- **UND** ist die Zahl im selben Informationsmuster wie eine positive Anzahl dargestellt

#### Scenario: Tour besitzt bestehende Abholortzuordnungen

- **GIVEN** eine Tour besitzt mindestens eine Abholortzuordnung
- **WENN** der Benutzer die Abholortanzahl aktiviert
- **DANN** öffnet die Liste weiterhin den bestehenden Bearbeitungsflow für Zuordnungen
- **UND** ändert die visuelle Vereinheitlichung keine Zuordnungsdaten

#### Scenario: Benutzer ändert den Tourstatus

- **WENN** ein berechtigter Benutzer das Status-Badge einer Tour aktiviert
- **DANN** öffnet sich ein zugänglicher Dialog mit aktuellem und beabsichtigtem Status
- **UND** wird die bestehende Statusmutation erst durch die vorgesehene Bestätigung ausgelöst
- **UND** sind laufende und deaktivierte Zustände erkennbar
- **UND** bleibt das Badge mit dem Statuswert beschriftet

#### Scenario: Benutzer verwendet eine Tour-Zeilenaktion

- **WENN** ein Benutzer Kalender, Duplizieren oder Löschen in der Aktionsspalte verwendet
- **DANN** erscheint die jeweilige Aktion als gemeinsamer Icon-Aktionsbutton mit zugänglichem Tooltip
- **UND** wird keine redundante Bearbeiten-Aktion angeboten, wenn der Tourname bereits dasselbe Ziel öffnet
- **UND** bleiben Berechtigungen, Bestätigung und Zielverhalten der Aktion unverändert

#### Scenario: Tourenzeile enthält ein- und mehrzeilige Inhalte

- **WENN** die Tourenzeile gerendert wird
- **DANN** sind alle Body-Zellen einschließlich Auswahl, Werte, Status und Aktionsgruppe einheitlich oben ausgerichtet
- **UND** verwenden die Zellen dasselbe vertikale Padding
- **UND** bleiben Controls innerhalb ihrer eigenen Trefferfläche zentriert
