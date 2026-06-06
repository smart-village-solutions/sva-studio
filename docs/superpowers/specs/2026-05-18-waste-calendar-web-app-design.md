# Design: Öffentliche Web-App für den Abfallkalender

> Hinweis: Dieses Design ist teilweise überholt. Der aktuelle PDF-Vertrag liegt in [2026-06-06-public-waste-pdf-export-shift-design.md](./2026-06-06-public-waste-pdf-export-shift-design.md). Die öffentliche App erzeugt PDFs inzwischen serverseitig ad hoc statt nur externe PDF-Links abzuleiten.

## Kurzbeschreibung
Es wird eine eigenständige öffentliche Web-App im Monorepo eingeführt, die den Abfallkalender für einen ausgewählten Abholort in einer schlichten iFrame-tauglichen Oberfläche darstellt. Die App liest serverseitig eine lokale JSON-Konfiguration ein, kapselt den Zugriff auf dieselbe Supabase wie das Waste-Management und stellt dem Browser nur öffentliche Read-Verträge bereit.

## Fachlicher Scope
- öffentliche Nutzung ohne Login
- genau ein gemerkter Standort pro Browser
- datengetriebener Auswahlfluss für den Abholort
- Terminliste ab dem nächsten Termin
- Monatskalender mit Navigation von `heute - 1 Jahr` bis `heute + 1 Jahr`
- Jahreskalender mit Navigation von `heute - 1 Jahr` bis `heute + 1 Jahr`
- Fraktionsfilter nach dem Laden des Kalenders
- PDF-Links für Vorjahr, aktuelles Jahr und nächstes Jahr
- iCal-Feed für alle verfügbaren künftigen Termine des gewählten Standorts
- deutschsprachige UI mit offenem Pfad für spätere Mehrsprachigkeit

## Nicht-Ziele
- keine Wiederverwendung der Studio-Plugin-UI
- keine öffentliche Schreibfunktion
- keine direkten Supabase-Credentials im Browser
- keine URL-basierte Deep-Link-Steuerung als Primärmechanismus
- keine eigene PDF-Erzeugungslogik in dieser App
- kein vorgelagertes periodisches Build-System für Kalenderdaten in der ersten Version

## Nutzerfluss
1. Beim ersten Aufruf lädt die App entweder den per Cookie gemerkten Standort oder startet im Auswahlfluss.
2. Die Auswahl erfolgt datengetrieben in den Stufen `Region -> Ort -> optional Straße -> optional Hausnummer oder Hausnummerbereich`.
3. Wenn nach der Ortswahl nur ein allgemeiner Straßenkontext wie `Alle Straßen` existiert, ist die Auswahl abgeschlossen.
4. Erst nach vollständiger Auflösung wird der Kalender geladen.
5. Nach erfolgreicher Auflösung speichert die App genau einen stabilen Standortschlüssel im Cookie und lädt den Kalender beim nächsten Aufruf automatisch wieder.
6. Oberhalb des geladenen Kalenders erscheint ein Hinweis, dass die gemerkte Adresse geändert werden kann.
7. Fraktionsfilter wirken auf den bereits geladenen Kalenderzustand.
8. Klickbare Kalendertage öffnen ein Modal mit Termin, Abfallart und optionalen Hinweisen.

## Technischer Ansatz
- Die App ist eine eigenständige öffentliche Web-Anwendung im Monorepo und technisch vom Studio-Plugin getrennt.
- Eine lokale JSON-Datei liefert mindestens `instanceId`, Supabase-Zugang, Cookie-Konfiguration sowie das URL-Schema für PDF.
- Der Server kapselt alle Infrastrukturzugriffe und stellt dem Browser nur schlanke Read-Endpunkte bereit.
- Die fachliche Kernlogik bleibt framework-agnostisch und wird von React- oder Routing-spezifischen Bindings getrennt.
- Für die erste Version liest die App direkt aus der bestehenden `waste_*`-Struktur derselben Supabase.
- Ein internes denormalisiertes Public-Read-Model bleibt als spätere Optimierung zulässig, ist aber nicht Teil des Erstzuschnitts.

## Architekturbausteine
### Config Loader
- lädt und validiert die lokale JSON-Konfiguration beim Start
- kapselt Fehler für fehlende oder ungültige Konfiguration

### Public Waste Repository
- liest serverseitig Regionen, Orte, Straßen, Hausnummern beziehungsweise Hausnummerbereiche, Abholorte, Touren, Fraktionen, Termine und Hinweise
- liefert stabile Domain-Objekte statt roher Tabellenzeilen

### Location Resolver
- bildet den datengetriebenen Auswahlfluss ab
- entscheidet, wann die Auswahl wegen fehlender weiterer Differenzierung beendet ist
- erzeugt den kanonischen Standortschlüssel für Cookie, Kalender, PDF und iCal

### Calendar Service
- aggregiert Termine, Fraktionen, Hinweistexte, Terminliste, Monatsansicht und Jahresansicht
- begrenzt die Navigation auf genau ein Jahr in Vergangenheit und Zukunft
- erzeugt globale Aktionsmetadaten für PDF und iCal

### Preference Store
- speichert genau einen Standort im Cookie
- verwirft ungültige oder nicht mehr auflösbare Standortwerte

### Public Web UI
- rendert die reduzierte Oberfläche für Auswahl, Kalender und globale Aktionen
- bleibt ein dünner Verbraucher des serverseitig erzeugten View-Models

## Öffentliche Verträge
- serverseitig gerenderte Startseite für Initialzustand oder direkte Wiederherstellung des gemerkten Standorts
- Read-Endpunkt für die jeweils nächste Auswahlstufe des Standortflusses
- Read-Endpunkt für den vollständigen Kalender eines finalen Standorts
- iCal-Endpunkt für alle verfügbaren künftigen Termine des gewählten Standorts
- PDF-Links werden aus einem URL-Schema serverseitig für Vorjahr, aktuelles Jahr und nächstes Jahr abgeleitet

## PDF- und iCal-Modell
- PDF ist ein externer Vertrag über ein URL-Schema; die App selbst ist nicht für die Dokumenterzeugung verantwortlich
- Die App muss die PDF-Ziel-URLs ausschließlich aus dem finalen Standort und dem gewählten Jahr ableiten
- iCal ist ein serverseitig erzeugter Feed der App und umfasst stets alle verfügbaren künftigen Termine für den gewählten Standort

## Fehlerverhalten
- Fehlende oder ungültige Konfiguration führt zu einer klaren öffentlichen Fehlerseite ohne interne Details
- Temporäre Datenquellenfehler führen zu verständlichen Retry-fähigen Fehlermeldungen
- Ein ungültig gewordener Standort-Cookie wird verworfen und durch den normalen Auswahlfluss ersetzt
- Fehlende künftige Termine gelten als fachlicher Leerzustand, nicht als technischer Fehler

## Accessibility
- Zielstandard ist WCAG 2.1 AA
- Der komplette Auswahlfluss muss tastaturbedienbar sein
- Monats- und Jahreskalender müssen klare Fokuszustände und verständliche Ansagen für Screenreader bieten
- Das Modal muss semantisch korrekt ausgezeichnet, fokussiert geöffnet und sauber geschlossen werden
- Farben der Abfallarten dürfen nie die einzige Informationsträgerin sein
- Kontraste, skalierbare Typografie und verständliche Statusmeldungen sind verpflichtend
- Der iFrame-Einsatz darf die Bedienbarkeit nicht verschlechtern

## Teststrategie
- Unit-Tests für Konfigurationsvalidierung, Standortauflösung, Kalenderaggregation, PDF-URL-Ableitung, iCal-Erzeugung und Cookie-Wiederherstellung
- Integrations-Tests für öffentliche Read-Endpunkte und Fehlerfälle mit kontrollierten Fixture-Daten
- E2E-Tests für Hauptreise, Wiederherstellung des gemerkten Standorts, Fraktionsfilter, Kalender-Modal und Export-Aktionen
- zusätzliche Accessibility-Tests für zugängliche Namen, Fokusverhalten, Tastaturbedienung und repräsentative E2E-A11y-Smokes

## Risiken und Leitplanken
- Die bestehende Admin-Datenstruktur ist nicht automatisch optimal für öffentliche Read-Abfragen; Query-Komplexität muss beobachtet werden
- Cookie-Verhalten im iFrame-Kontext muss früh gegen die Zielumgebung geprüft werden
- Die einfache UI darf nicht dazu verleiten, Accessibility oder Fehlerzustände zu unterschätzen
- Wenn direkte Source-Reads für Kalender oder Export-Metadaten zu teuer werden, ist ein internes Public-Read-Model die vorgesehene Folgeoption

## Architekturwirkung
- neues öffentliches Frontend im Monorepo
- neue serverseitige Read-Schicht für den öffentlichen Abfallkalender
- keine Änderung am bestehenden Admin-Plugin als UI-Basis
- neue öffentliche Vertragsfläche für Standortauflösung, Kalenderansicht und iCal
- explizite Entkopplung von PDF-Erzeugung und öffentlicher Kalenderausspielung

## Referenz für den nächsten Schritt
- Das Design dient als Grundlage für einen OpenSpec-Change zur Einführung der öffentlichen Abfallkalender-App.
