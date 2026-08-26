## MODIFIED Requirements

### Requirement: Die Studio-Shell bietet kontextbezogene Seitenhilfe an

Die gemeinsame Studio-Shell MUST auf jeder dokumentierbaren produktiven Seite unmittelbar rechts neben der primären H1 einen konsistenten, zugänglichen Fragezeichen-Icon-Button für die aktuelle Anwenderdokumentation anzeigen. Beim Aktivieren MUST sie den Inhalt in einem responsiven Overlay darstellen, ohne den Zustand der darunterliegenden Fachseite zu verändern.

#### Scenario: Dokumentierbare Seite wird geöffnet

- **WENN** der tiefste aktive Route-Match eine Dokumentations-ID besitzt
- **DANN** zeigt die Shell unmittelbar rechts neben der primären H1 einen Fragezeichen-Icon-Button mit dem zugänglichen Namen „Hilfe öffnen“
- **UND** besitzt der Button eine mindestens 44 × 44 Pixel große interaktive Fläche
- **UND** zeigt die Shell kein zusätzliches flächiges Hilfehinweisfeld
- **UND** verwendet sie für alle zugänglichen oder sichtbaren Texte i18n-Schlüssel

#### Scenario: Ausgeschlossene Seite wird geöffnet

- **WENN** die aktive Seite einen Ausschlussgrund statt einer Dokumentations-ID besitzt
- **DANN** zeigt die Shell keinen kontextbezogenen Hilfeauslöser

#### Scenario: Anwender öffnet die Hilfe

- **WENN** der Anwender den Hilfe-Icon-Button per Maus, Tastatur oder assistiver Technologie aktiviert
- **DANN** öffnet die Shell ein benanntes Overlay mit Fokusfalle, Escape-Unterstützung und internem Scrollbereich
- **UND** setzt sie den Fokus beim Schließen auf den auslösenden Icon-Button zurück
- **UND** bietet sie einen Link zur vollständigen statischen Dokumentationsseite an

#### Scenario: Hilfe wird auf kleinem Viewport geöffnet

- **WENN** das Overlay auf einem kleinen Viewport dargestellt wird
- **DANN** nutzt es eine nahezu vollflächige, ohne horizontales Scrollen bedienbare Darstellung
- **UND** bleiben Schließen-Aktion und Dokumenttitel sichtbar beziehungsweise erreichbar

#### Scenario: Inhalt wird geladen

- **WENN** das Overlay geöffnet wird und der Inhalt noch nicht vorliegt
- **DANN** zeigt es einen neutralen, zugänglichen Ladezustand
- **UND** lädt es den Inhalt erst für die konkrete Interaktion

#### Scenario: Hilfe kann nicht geladen werden

- **WENN** die Hilfe-Fassade einen begrenzten Fehler zurückgibt oder Markdown nicht sicher gerendert werden kann
- **DANN** zeigt das Overlay einen verständlichen Fehlerzustand mit Retry-Aktion
- **UND** bleiben Navigation, Seiteninhalt, Formularzustand und Fachaktionen unterhalb des Overlays unverändert

#### Scenario: Markdown wird dargestellt

- **WENN** valider Markdown-Inhalt geladen wurde
- **DANN** rendert das Overlay Überschriften, Absätze, Listen, Tabellen, Links und Codeblöcke semantisch mit Studio-Design-Tokens
- **UND** hält die Überschriftenhierarchie den Overlay-Titel als führende Überschrift ein
