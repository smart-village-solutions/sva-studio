# Design: Verlagerung der Waste-PDF-Erzeugung in die öffentliche Web-App

## Kontext
Die bestehende Waste-PDF-Lösung ist aktuell auf das Studio-Waste-Management zugeschnitten. Dort wird der Tab `Ausgabe` für die Konfiguration und serverseitige Erzeugung eines PDFs pro Abholort und Jahr verwendet. Parallel dazu existiert bereits eine eigenständige öffentliche Web-App für den Abfallkalender, die heute Kalenderdaten, Fraktionsfilter, iCal und statische PDF-Links bereitstellt, aber noch keine eigene PDF-Erzeugung besitzt.

Für das neue Zielbild soll sich die Verantwortlichkeit verschieben:
- Das Studio soll keine PDFs mehr erzeugen.
- Der Studio-Tab `Ausgabe` soll nur noch PDF-relevante Stamminhalte pflegen, die nicht aus den Waste-Fachdaten stammen.
- Die öffentliche Web-App soll das PDF serverseitig `ad hoc` pro Anfrage erzeugen, basierend auf aufgelöster Adresse, ausgewähltem Jahr und ausgewählten Fraktionen.
- Das Ergebnis soll direkt ausgeliefert, aber nicht persistent gespeichert werden.

## Ziele
- Die PDF-Erzeugung fachlich aus dem Studio-Waste-Management in die öffentliche Web-App verlagern.
- Den Studio-Tab `Ausgabe` auf die Pflege statischer PDF-Inhalte reduzieren.
- In der öffentlichen Web-App einen PDF-Export anbieten, der auf den bereits sichtbaren Kalenderdaten und deren Standortlogik basiert.
- Den PDF-Inhalt um Fraktionsauswahl, Jahreswahl und vererbte übergeordnete Abholort-Termine ergänzen.
- Bestehende produktive PDF-Kernlogik weiterverwenden, statt einen zweiten Renderansatz neu aufzubauen.

## Nicht-Ziele
- Keine persistente Speicherung erzeugter PDFs.
- Keine Wiederverwendung stabiler PDF-Links oder Storage-Artefakte.
- Keine Studio-seitige PDF-Vorschau.
- Keine PDF-Erzeugung mehr im Studio.
- Keine Einführung neuer Hinweisfelder im ersten Schritt; es werden nur bestehende Textquellen genutzt.
- Keine mehrstufige Job-Orchestrierung oder asynchrone Hintergrundverarbeitung.

## Empfohlener Ansatz
Empfohlen wird eine klare Trennung:

1. `waste-management` im Studio verwaltet nur noch PDF-Stamminhalte und Fraktionsabkürzungen.
2. `public-waste-calendar` übernimmt die serverseitige PDF-Erzeugung als unmittelbaren Export-Endpoint.
3. Die PDF-Datenbasis folgt derselben Standortauflösung und derselben fachlichen Kalenderlogik wie die öffentliche Kalenderansicht.
4. Das PDF wird pro Anfrage erzeugt und direkt als Download oder binäre Response ausgeliefert.

Dieser Ansatz vermeidet persistente Artefaktlogik, hält die Bürgerfunktion nah an der tatsächlichen Kalenderansicht und entlastet das Studio von einer operativen Exportverantwortung, die fachlich eher in die öffentliche Nutzung gehört.

## Verantwortungsgrenzen
### Studio `waste-management`
- stellt weiterhin den Tab `Ausgabe` bereit
- erzeugt dort keine PDFs mehr
- pflegt nur PDF-bezogene Stamminhalte, die nicht aus Waste-Fachdaten stammen
- pflegt optionale Fraktionsabkürzungen an den Abfallfraktionen

### Öffentliche Web-App `public-waste-calendar`
- löst den Standort wie bisher datengetrieben auf
- lässt den Nutzer Jahr und Fraktionen für den Export wählen
- erzeugt das PDF serverseitig aus dem finalen Standortkontext
- liefert das PDF direkt aus, ohne Persistenz und ohne stabile spätere Asset-URL

### Gemeinsame Kernlogik
- Dokumentmodell, Adressaufbereitung, Fraktionslegende und PDF-Renderer sollen weiterhin in produktiven Workspace-Pfaden liegen
- die bestehende PDF-Kernlogik darf weiterverwendet und für das neue Exportmodell angepasst werden

## PDF-Inhaltsmodell
### Kopfbereich
- oben links steht `Abfallkalender <Jahr>`
- darunter steht die gewählte Adresse einzeilig
- generische Platzhalter wie `Alle Straßen` oder `Alle Hausnummern` werden in dieser Kopfzeile nicht ausgegeben
- oben rechts wird eine im Studio gepflegte Branding-Grafik eingeblendet

### Kalenderbereich
- der Kalender zeigt das gewählte Jahr
- der Export berücksichtigt nur die vom Nutzer gewählten Fraktionen
- die zugrunde liegenden Termine folgen der fachlichen Standort- und Vererbungslogik

### Legende
- unterhalb des Kalenders steht eine Legende für die ausgewählten oder im Export vorkommenden Fraktionen
- jede Legendenzeile zeigt Farbe, Abkürzung und Bezeichnung der Fraktion
- die Darstellung soll möglichst einzeilig bleiben
- Fraktionsabkürzungen sind ein neues pflegbares Attribut der Fraktion
- wenn keine Abkürzung gepflegt ist, wird sie aus den ersten Zeichen der normalen Bezeichnung gebildet

### Hinweis- und Kontaktbereich
- unter dem Kalender steht ein Hinweisblock für besondere Hinweise, die auf dem Kalenderblatt selbst nicht sinnvoll dargestellt werden können
- diese Hinweise werden ausschließlich aus bestehenden Textquellen auf Ebene `Termin`, `Tour` oder `Abholort` abgeleitet
- es wird im ersten Schritt kein separates neues PDF-Hinweisfeld eingeführt
- zusätzlich wird ein Freitext- oder Kontaktblock angezeigt, der aus dem Studio stammt und zum Beispiel Kontaktdaten, Servicezeiten oder organisatorische Hinweise enthält

## Datenauflösung und Vererbungslogik
Der PDF-Export arbeitet nicht nur mit dem exakt gewählten finalen Abholort, sondern mit dessen wirksamem Standortkontext.

Eine Tour oder ein Termin wird in das PDF aufgenommen, wenn die Zuordnung:
- direkt am gewählten Abholort hängt oder
- an einem fachlich übergeordneten Abholort hängt, der für den gewählten Standort weiterhin gilt

Damit gilt im Export dieselbe fachliche Vererbung, die auch für die Kalenderlogik relevant ist:
- ein ortsweiter Abholort wie `Perleberg (alle Straßen)` gilt auch für konkrete Straßen des Orts
- ein straßenweiter Abholort wie `Ackerstraße (alle Hausnummern)` gilt auch für konkrete Hausnummern dieser Straße

Beispiel:
- Für `Perleberg, Ackerstraße` muss das PDF auch Tourdaten wie `Schadstoffmobil` enthalten, wenn diese nur dem übergeordneten Abholort `Perleberg (alle Straßen)` zugeordnet sind.

Erst nach dieser fachlichen Zusammenführung greift die vom Nutzer gewählte Fraktionsfilterung.

## Studio-Konfigurationsmodell
Der Tab `Ausgabe` bleibt im Studio erhalten, verliert aber die operative Exportfunktion.

Im ersten Schritt pflegt das Studio dort nur:
- Branding-Grafik für den PDF-Kopfbereich
- Freitext- oder Kontaktblock für den unteren PDF-Bereich

Nicht mehr Bestandteil des Studio-Tabs:
- Auswahl von Abholort und Jahr für eine direkte PDF-Erzeugung
- Button `PDF erzeugen`
- Ergebnislink oder „letztes Ergebnis“
- Übersicht bereits erzeugter PDFs

Die bisherige Sichtbarkeit von PDF-Links in `Abholorte` entfällt ebenfalls aus dem Zielbild, da es keine persistent gespeicherten PDF-Artefakte mehr gibt.

## Öffentlicher Exportfluss
1. Der Nutzer öffnet die öffentliche Web-App.
2. Er löst seinen Standort wie bisher über Region, Ort, Straße und optional Hausnummer auf.
3. Nach der vollständigen Standortauflösung lädt die App den Kalender.
4. Der Nutzer wählt Fraktionen für die Anzeige und separat ein Jahr für den PDF-Export.
5. Beim Start des Exports ruft die App einen serverseitigen PDF-Endpoint auf.
6. Der Server ermittelt alle wirksamen Termine für den aufgelösten Standortkontext einschließlich übergeordneter Zuordnungen.
7. Der Server filtert die Termine auf das gewählte Jahr und die ausgewählten Fraktionen.
8. Der Server rendert daraus das PDF und liefert es unmittelbar als Datei-Response zurück.

## Technischer Ansatz
### Öffentliche Runtime
- ergänzt die öffentliche App um einen serverseitigen PDF-Endpoint
- verwendet dieselbe fachliche Standortauflösung und Kalenderaggregation wie die sichtbare Kalenderansicht
- erzeugt keinen Storage-Eintrag und kein wiederverwendbares Artefakt

### PDF-Kernlogik
- bleibt in produktiven Workspace-Packages
- wird so angepasst, dass Branding-Grafik, optionale Fraktionsabkürzungen, bereinigte Adressdarstellung sowie Hinweis- und Kontaktblöcke unterstützt werden
- bleibt serverseitig ausführbar

### Studio-Datenquellen
- liefern die statischen PDF-Stamminhalte
- liefern die Fraktionsabkürzungen
- liefern keine gespeicherten PDF-Artefakte mehr

## Fehlerverhalten
Folgende Fehler- oder Leerzustände müssen sauber getrennt werden:
- unvollständige oder ungültige Adressauflösung
- kein Jahr gewählt
- keine Fraktionen gewählt
- keine exportierbaren Termine für Kombination aus Standort, Jahr und Fraktionswahl vorhanden
- temporäre Datenquellen- oder Renderfehler

`Keine exportierbaren Termine` ist ein fachlicher Leerzustand und darf nicht als technischer Serverfehler erscheinen. In diesem Fall soll der Nutzer eine verständliche Rückmeldung erhalten statt einer defekten oder leeren PDF-Datei ohne Erklärung.

## Accessibility und UX
- Die Jahreswahl für den Export muss klar von der bloßen Kalendernavigation unterscheidbar sein.
- Die Fraktionsauswahl für den Export muss verständlich beschriftet und tastaturbedienbar sein.
- Download- oder Fehlerzustände müssen auch für assistive Technologien wahrnehmbar sein.
- Die PDF-Aktion darf nicht auf impliziten Zuständen beruhen; Jahr und Filter müssen vor dem Export eindeutig erkennbar sein.

## Teststrategie
### Kernlogik
- Unit-Tests für Adressformatierung ohne `Alle Straßen` und `Alle Hausnummern`
- Unit-Tests für Fraktionsabkürzungs-Fallback
- Unit-Tests für Hinweisaggregation aus bestehenden Textquellen
- Unit-Tests für Vererbungslogik von übergeordneten Abholorten
- Unit-Tests für Filterung nach Jahr und ausgewählten Fraktionen

### Öffentliche Runtime
- Integrations-Tests für den neuen PDF-Endpoint
- Fehlerfälle für ungültige Anfrage, fehlende Auswahl und fachlichen Leerzustand
- Nachweise, dass keine Persistenz oder Storage-Artefakte erzeugt werden

### Öffentliche UI
- E2E-Tests für Standortauflösung, Fraktionswahl, Jahrwahl und erfolgreichen PDF-Download
- E2E-Tests für Fälle mit übergeordneten vererbten Tourdaten

### Studio
- UI-Tests für den umgebauten `Ausgabe`-Tab als Konfigurationsfläche
- Tests für das neue optionale Feld der Fraktionsabkürzung
- Regressionstests, dass Studio keine operative PDF-Erzeugung mehr anbietet

## Migration und Architekturwirkung
### Fachliche Migration
- Der bisherige Fachvertrag „Studio erzeugt Waste-PDFs“ entfällt.
- Der bisherige Fachvertrag „öffentliche Web-App erzeugt keine PDFs selbst“ entfällt ebenfalls.
- Der Studio-Tab `Ausgabe` bleibt erhalten, aber mit neuem Fokus auf Stamminhalte statt Artefakterzeugung.

### Technische Migration
- bestehende PDF-Endpoint-, Storage- und Linklistenlogik im Studio wird zurückgebaut oder aus dem Fachpfad entfernt
- öffentliche App erhält einen serverseitigen Exportvertrag statt statischer PDF-Linkableitung
- die bisherige öffentliche PDF-URL-Schema-Konfiguration wird obsolet oder muss auf den neuen Endpoint-Vertrag umgestellt werden

### Betroffene Capabilities
- `waste-management`
- `public-waste-calendar`

### Betroffene Architekturstellen
- `03-context-and-scope`
- `05-building-block-view`
- `06-runtime-view`
- `08-cross-cutting-concepts`

## Offene Abgrenzung für die Umsetzung
Nicht mehr offen sind die grundlegenden Verantwortlichkeiten.

In der Umsetzung bleibt noch konkret festzulegen:
- wo die Branding-Grafik im Studio fachlich und technisch gespeichert wird
- welche bestehenden Hinweisfelder auf `Termin`, `Tour` und `Abholort` tatsächlich bereits vorhanden und nutzbar sind
- wie die Jahreswahl im öffentlichen UI am klarsten neben der Kalenderansicht modelliert wird

Diese offenen Punkte dürfen den abgestimmten Grundvertrag nicht mehr verändern:
- PDF-Erzeugung nur in der öffentlichen Web-App
- `ad hoc` ohne Persistenz
- Studio nur für statische PDF-Stamminhalte
