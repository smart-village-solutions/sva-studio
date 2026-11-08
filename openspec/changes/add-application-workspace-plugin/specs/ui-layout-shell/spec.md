## ADDED Requirements

### Requirement: Gemeinsame Tabler-Icon-Auswahl in Code und Figma

Das Design-System SHALL eine gemeinsame Icon-Auswahl in `@sva/studio-ui-react` und eine entsprechende editierbare Komponente im bestehenden Figma-Designsystem „SVA Studio“ bereitstellen. Die Auswahl MUST die Outline-Icons der eingesetzten Tabler-Version mit Standardkontur 2 verwenden, Suche nach Iconnamen, Auswahlmarkierung und Vorschau anbieten und ausschließlich eine stabile Iconkennung als Wert übergeben. Die Komponente MUST auf vorhandenen Design-System-Primitives und Tokens aufbauen und leeren, ausgewählten, Hover-, Fokus-, deaktivierten, schreibgeschützten und fehlerhaften Zustand sowie Suche ohne Treffer abdecken. Der erste Verbraucher SHALL das Kachelformular des Anwendungsarbeitsplatzes sein.

#### Scenario: Icon suchen und per Tastatur auswählen

- **WHEN** ein Benutzer im Kachelformular die Icon-Auswahl öffnet, nach einem Tabler-Namen sucht und ein Ergebnis per Tastatur auswählt
- **THEN** zeigen Auswahlfeld und Vorschau das gewählte Icon
- **AND** erhält das Formular dessen stabile Kennung
- **AND** bleiben Fokus und Auswahlzustand für assistive Technik nachvollziehbar

#### Scenario: Suche abbrechen oder ohne Treffer schließen

- **WHEN** die Suche keinen Treffer liefert oder der Benutzer die Auswahl mit Escape abbricht
- **THEN** ist der Leerzustand verständlich lokalisiert
- **AND** verändert Abbrechen den bisherigen Feldwert nicht
- **AND** kehrt der Fokus beim Schließen zum Auslöser zurück

#### Scenario: Figma und implementierte Komponente abgleichen

- **WHEN** die Komponente zur Abnahme vorgelegt wird
- **THEN** sind die festgelegten Zustände, Auswahlfläche und Suchverhalten in der bestehenden Figma-Bibliothek dokumentiert und über Link und Node-ID auffindbar
- **AND** stimmen Code und Figma bei semantischen Tokens, Tabler-Kontur, Theme-/Light-/Dark-Darstellung und Interaktionszuständen überein
- **AND** ist der Figma-Baustein vor der Code-Implementierung gestaltet und abgestimmt worden

### Requirement: Anwendungs-Einstieg in der Kopfzeile

Die bestehende Kopfzeile SHALL bei wirksamer Aktivierung von `application-workspace` für alle angemeldeten Benutzer der aktuellen Instanz einen Link mit 3×3-Grid-Icon zur Anwendungsübersicht anzeigen. Der zugängliche Name und Tooltip SHALL auf Deutsch „Anwendungen“ und auf Englisch „Applications“ lauten. Das Symbol MUST dekorativ verborgen sein. Unaufgelöster Kontext MUST keinen fremden oder veralteten Einstieg anzeigen.

#### Scenario: Aktivierter Anwendungsarbeitsplatz

- **WHEN** ein Benutzer einer Instanz mit aktivem Plugin die Kopfzeile sieht
- **THEN** erreicht er die Übersicht per Maus und Tastatur über den benannten Grid-Link
- **AND** bleiben Konto, Sprachwahl, Theme und andere vorhandene Header-Aktionen erreichbar

#### Scenario: Aktivierung fehlt oder ist noch ungeklärt

- **WHEN** keine wirksame instanzgebundene Aktivierung feststeht
- **THEN** zeigt die Kopfzeile keinen Anwendungs-Einstieg aus einem alten oder fremden Kontext

### Requirement: Anwendungsübersicht ohne Seitenleiste

Die Anwendungsübersicht SHALL innerhalb der bestehenden Shell ohne Sidebar, Rail, reservierten Sidebar-Abstand und mobilen Navigationseinstieg dargestellt werden. Kopfzeile, Hauptinhalts-Landmark sowie bestehende Sitzungs-, Zugriffs- und Rechtstextprüfungen MUST erhalten bleiben. Andere Routen und gespeicherte Navigationspräferenzen MUST unverändert funktionieren. Übersicht und Einstellungen MUST vorhandene Design-System-Komponenten, responsive Darstellung und WCAG 2.1 AA einhalten.

#### Scenario: Übersicht auf Desktop und Mobilgerät

- **WHEN** ein Benutzer die Übersicht auf großem oder kleinem Viewport öffnet
- **THEN** stehen die Kacheln im verfügbaren Content-Bereich ohne Seitenleiste oder funktionslosen Menüknopf bereit
- **AND** bleiben Kopfzeile, sichtbarer Tastaturfokus und zugängliche Linknamen verfügbar

#### Scenario: Rückkehr ins Studio oder Öffnen der Einstellungen

- **WHEN** der Benutzer die Studio-Kachel oder die Einstellungsseite öffnet
- **THEN** gilt wieder das normale Studio-Layout mit seinen bisherigen Navigationspräferenzen
- **AND** hat der Besuch der Übersicht keine Sidebar-Präferenz überschrieben
