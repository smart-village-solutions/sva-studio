## ADDED Requirements

### Requirement: Redaktionelle Touren besitzen ein eigenständiges Studio-Modul

Das System SHALL Touren als eigenes aktivierbares Studio-Plugin mit paginierter Liste und Detailfläche für den berechtigten Instanz- und Principal-Kontext bereitstellen. Der erste Lieferabschnitt SHALL zwei tenantgeschützte Plugin-Routen mit `tours.read` und gemeinsamen Studio-Komponenten für Liste und Detail verwenden. Die Liste SHALL Name, Kategorien, fachliche Aktivität, Veröffentlichung, Länge und Änderungszeit ausgeben sowie den Datenanbieter bei entsprechender Zugriffserlaubnis. Das Detail SHALL Route und Stationen in ihrer gelieferten Reihenfolge strukturiert zeigen. Die erfassten Inhalte SHALL im Mainserver liegen.

#### Scenario: Berechtigte Redakteure sehen Touren

- **GIVEN** das Tourenmodul ist aktiv und der Benutzer besitzt `tours.read`
- **WHEN** der Benutzer in der Tourenliste blättert und einen Treffer öffnet
- **THEN** sieht er ausschließlich im aktiven Kontext berechtigte Inhalte mit der tatsächlichen Pagination und kann jeden angezeigten Treffer unter demselben Zugriffskontext öffnen

#### Scenario: Der erste Lieferabschnitt bietet nur lesende Oberflächen

- **GIVEN** ausschließlich der Leseabschnitt ist bereitgestellt
- **WHEN** ein berechtigter Benutzer das Modul verwendet
- **THEN** stehen Liste und Details bereit und der Create-Picker bietet Touren noch nicht an
- **AND** das Modul bietet weder Anlege- oder Editieroberflächen noch aufrufbare Schreibendpunkte an

### Requirement: Die vollständige Tourenliste durchsucht und filtert den autorisierten Bestand

Im Ausbau der vollständigen Fachliste SHALL das System Suche nach Name sowie Filter für Kategorie, Aktivität und Veröffentlichung auf den gesamten autorisierten Bestand vor der Pagination anwenden.

#### Scenario: Ein Treffer außerhalb der aktuellen Seite wird bei der Suche gefunden

- **GIVEN** eine berechtigte Tour erfüllt die Suche und Filter und liegt außerhalb der zuvor angezeigten Seite
- **WHEN** die Redaktion die Suche oder Filter anwendet
- **THEN** gehört die Tour zum gefilterten Ergebnis vor der Aufteilung in Seiten

### Requirement: Touren-Schreibfähigkeiten werden getrennt freigegeben

Das System SHALL beim Übergang zum Standard-Content-Pfad vorhandene Lese-URLs auf die entsprechenden neuen Ansichten weiterleiten. Der Host SHALL Anlegen, Aktualisieren und Entfernen getrennt autorisieren und für die Veröffentlichung die bestehende Lifecycle-Aktion verwenden. Schreibfähigkeiten SHALL nur gemäß ihres bestätigten Mainserver-Vertrags verfügbar sein. Zentrale Leseflächen SHALL `tours.read` anwenden. Touren SHALL fachliche Aktivität und Veröffentlichung in der Projektion getrennt abbilden.

#### Scenario: Anlegen wird vor der Bestandsbearbeitung verfügbar

- **GIVEN** der Create-Vertrag ist bestätigt und der Bestandsupdate-Vertrag ist noch offen
- **WHEN** berechtigte Redakteure Touren im Standard-Content-Pfad öffnen
- **THEN** können sie einen neuen unveröffentlichten Entwurf anlegen und bestehende Touren lesen
- **AND** eine unbestätigte Schreibfähigkeit bleibt auch bei direktem Aufruf unverfügbar
- **AND** erfolgreich ausgeführte Änderungen werden über die bestehende Host-Historie und Inhaltsprojektion nachvollziehbar

#### Scenario: Inaktive veröffentlichte Tour bleibt veröffentlicht

- **GIVEN** eine Tour ist fachlich inaktiv und im Mainserver sichtbar
- **WHEN** ihre zentrale Projektion vollständig neu aufgebaut oder nach einer Einzeländerung aktualisiert wird
- **THEN** weist Studio sie als inaktiv und veröffentlicht aus

### Requirement: Routen und Stationen sind strukturiert pflegbar

Das System SHALL einen zugänglichen Toureneditor mit Basisdaten, Route und Ort, geordneten Stationen, Medien und Historie anbieten. Der Editor SHALL fachliche Aktivität und Veröffentlichung getrennt behandeln sowie Koordinaten manuell erfassen und Stationen per Tastatur sortieren können. Eine vorhandene Route SHALL mindestens zwei gültige Koordinatenpaare enthalten. Eine neue Tour SHALL unveröffentlicht starten. Speichern SHALL den neu geladenen, tatsächlich persistierten Stand anzeigen. Eine Streckenkarte SHALL die strukturierte Bedienung jederzeit verfügbar lassen.

#### Scenario: Redaktion ändert Strecke und Stationsreihenfolge

- **GIVEN** eine berechtigte Redaktion kann die Tour verlustfrei bearbeiten
- **WHEN** sie gültige Routenpunkte erfasst, Stationen mit der Tastatur sortiert und speichert
- **THEN** sind die Route und Reihenfolge nach dem erneuten Laden unverändert gegenüber der gespeicherten Auswahl
- **AND** persistierte Stationen können erst nach ausdrücklicher Bestätigung entfernt werden
