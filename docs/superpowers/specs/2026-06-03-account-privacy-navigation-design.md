# Konto-, Datenschutz- und Kontoregeln-Navigation

## Ziel

Die nutzerseitigen Funktionen rund um Konto, Datenschutz und Kontoregeln
sollen im Einstieg klar getrennt werden, ohne Inhalte oder Fähigkeiten zu
entfernen. Nutzer sollen schneller verstehen:

- wo sie persönliche Kontodaten und Zugangsdaten verwalten
- wo sie Datenschutzaktionen auslösen
- wo sie globale Kontoregeln und eigene Überschreibungen einsehen oder ändern

## Problem

Die aktuelle Struktur mischt unterschiedliche Nutzerintentionen auf engem Raum:

- `Mein Konto` ist ein persönlicher Verwaltungsbereich
- `/account/privacy` bündelt sowohl Datenschutzaktionen als auch
  kontobezogene Regeltransparenz
- die Kontoregeln sind fachlich weder rein Datenschutz noch rein
  Kontoeinstellung

Dadurch konkurrieren auf derselben Fläche:

- aktionsorientierte Datenschutz-Workflows
- Status- und Verlaufsinformationen
- regel- und lebenszyklusbezogene Transparenz

## Entscheidung

Die Informationsarchitektur wird in drei Nutzungsbereiche getrennt:

1. `Konto`
2. `Datenschutz`
3. `Kontoregeln`

Diese Trennung folgt der Nutzerintention statt der internen Backend- oder
Governance-Struktur.

## Navigationsmodell

### Header-Dropdown

Das Header-Dropdown oben rechts wird als primärer Einstieg für
nutzerbezogene Einstellungen und Self-Service-Bereiche ausgebaut.

Es enthält drei Gruppen:

- `Konto`
  - `Mein Konto`
  - `Passwort ändern`
  - `E-Mail ändern`
- `Datenschutz & Regeln`
  - `Datenschutz`
  - `Kontoregeln`
- `Sitzung`
  - `Logout`

### Begründung

Der Einstieg über das Header-Dropdown passt zur vorhandenen Shell-Struktur und
ordnet die Funktionen dort ein, wo Nutzer persönliche, sitzungsnahe
Selbstverwaltung erwarten.

Gleichzeitig bleibt die fachliche Trennung innerhalb des Menüs sichtbar:

- `Datenschutz` ist nicht nur eine Unterfunktion von `Mein Konto`
- `Kontoregeln` ist nicht nur eine Unterfunktion von `Datenschutz`

## Routenmodell

Die Nutzerseite wird in drei eigenständige Routen aufgeteilt:

- `/account`
  - Profil- und Zugangskontext
- `/account/privacy`
  - Datenschutz-Cockpit
- `/account/rules`
  - Kontoregeln-Cockpit

## Seitenverantwortung

### `/account`

Diese Seite bleibt auf persönliche Kontoverwaltung fokussiert:

- Profildaten
- Einstieg zu Passwortänderung
- Einstieg zu E-Mail-Änderung
- keine Vermischung mit Datenschutzfällen oder Löschregeln

### `/account/privacy`

Diese Seite ist handlungs- und fallorientiert.

Sie bündelt:

- Datenexport anfordern
- Auskunft anfordern
- Löschanfrage anfordern
- Einschränkung der Verarbeitung anfordern
- Widerspruch einreichen
- Rechteänderung beantragen
- Verlauf und Status von Exporten, Anfragen und rechtlichen Sperren

Die Seite beantwortet primär die Nutzerfragen:

- „Was kann ich datenschutzseitig jetzt tun?“
- „Welche Datenschutzvorgänge laufen für mein Konto?“

#### Seitenstruktur

Die Seite folgt einem klaren Zwei-Ebenen-Aufbau:

1. oben ein Aktionsbereich
2. darunter ein gemeinsamer Verlaufs- und Nachweisbereich

#### Aktionsbereich

Der obere Bereich besteht aus sechs Aktionskacheln in zwei Reihen mit je drei
Karten.

Priorität und Reihenfolge:

1. `Rechteänderung beantragen`
2. `Auskunft anfordern`
3. `Datenexport anfordern`
4. `Widerspruch einreichen`
5. `Löschanfrage anfordern`
6. `Einschränkung der Verarbeitung anfordern`

Die Reihenfolge bildet die Priorisierung bereits ausreichend ab. Zusätzliche
grafische Hierarchisierung zwischen den Karten soll vermieden werden, um die
visuelle Komplexität niedrig zu halten.

Jede Karte enthält:

- einen klaren Titel
- eine kurze Beschreibung
- einen eindeutigen CTA

Die Karten führen nicht auf sechs neue Unterseiten. Stattdessen lösen sie
direkte Aktionen oder kurze Interaktionspfade aus:

- `Rechteänderung`, `Widerspruch`, `Löschanfrage` und `Einschränkung der
  Verarbeitung` öffnen einen Dialog
- `Auskunft` und `Datenexport` werden direkt ausgelöst oder über einen kleinen
  Confirm-/Format-Dialog geführt

#### Verlaufsbereich

Unterhalb der Aktionskacheln folgt eine gemeinsame Tabelle für relevante
Datenschutzvorgänge.

Die Tabelle ist der zentrale Arbeits- und Nachweisbereich der Seite.

Anforderungen:

- eine gemeinsame Tabelle statt getrennter Unterbereiche
- neueste Aktivitäten zuerst
- deutlicher Status direkt in der Tabelle
- Filter oberhalb der Tabelle
- Detailzugang pro Vorgang
- Orientierung am Tabellenmuster der Waste-Management-Ansichten

Empfohlene Spalten:

- Vorgang
- Status
- Typ
- Erstellt am
- Zuletzt aktualisiert oder abgeschlossen am
- Kurzdetails
- Aktionen

Empfohlene Filter:

- Typ
- Status
- Zeitraum
- Freitextsuche

Die Tabelle soll sich an den etablierten Waste-Management-Mustern
orientieren:

- Filter und Suche in einer Top-Bar oberhalb der Tabelle
- klassische Tabellenstruktur mit klaren Spaltenköpfen
- keine vollständig klickbaren Zeilen
- explizite Aktionsspalte am rechten Rand

#### Detailzugang

Jeder Datenschutzvorgang benötigt einen klaren Drilldown in eine
Detailansicht.

Die Tabelle darf nicht nur Übersicht sein, sondern muss pro Eintrag einen
nachvollziehbaren Detailzugang bieten, damit Nutzer:

- den vollständigen Kontext eines Falls sehen können
- Statusänderungen besser verstehen
- Export- oder Nachweisaktionen gezielt ausführen können

Ein eigener Detailpfad pro Datenschutzfall ist damit Teil des Zielbilds.

Der Detailzugang erfolgt nicht als Dialog oder Drawer, sondern über eine
eigene Route pro Vorgang.

#### Exportformate und Export-Download

Die Datenschutz-Seite darf Exporte nicht auf den heute im UI verdrahteten
`json`-Pfad beschränken.

Da API und Backend weitere Formate unterstützen, muss das Zielbild diese
explizit berücksichtigen:

- `json`
- `csv`
- `xml`

Zusätzlich muss ein fertig erzeugter Export direkt aus dem Cockpit
herunterladbar sein.

Daraus folgen zwei Anforderungen:

- Nutzer können beim Export das gewünschte Format auswählen
- abgeschlossene Exportvorgänge bieten im Verlauf oder in der Detailansicht
  eine Download-Aktion

In der Aktionsspalte der Tabelle gilt:

- jeder Vorgang bietet mindestens `Details`
- abgeschlossene Exportvorgänge bieten zusätzlich `Download`

#### Bewusste Nicht-Betonung von Statusblöcken

Ein separater hervorgehobener Statusblock oberhalb der Tabelle wird bewusst
nicht vorgesehen.

Begründung:

- eingeschränkte Rechte sind in diesem Kontext kein besonderer Vorfall
- vollständige Sperren sind kein regulärer In-App-Fall dieser Seite
- relevante Sachverhalte sollen als Vorgänge und Nachweise in der Tabelle
  erscheinen, nicht als zusätzlicher Aufmerksamkeitsblock

Historische Zustimmungen, offene Rechteänderungen oder andere relevante
Datenschutznachweise werden daher tabellarisch abgebildet.

### `/account/rules`

Diese Seite ist regel-, lebenszyklus- und transparenzorientiert.

Sie bündelt:

- globale tenantweite Kontoregeln
- Fristen für Deaktivierung, Pseudonymisierung und Löschung
- Standardbehandlung eigener Inhalte
- mögliche persönliche Überschreibungen

Die Seite beantwortet primär die Nutzerfragen:

- „Welche Regeln gelten für mein Konto?“
- „Welche globale Voreinstellung ist aktiv?“
- „Kann ich für meine Inhalte eine abweichende Regel wählen?“

#### Seitenstruktur

Die Seite folgt einem klaren Drei-Ebenen-Aufbau:

1. kompakte Regel-Kacheln
2. Abschnitt `Globale Regeln`
3. Abschnitt `Deine Einstellung`

#### Regel-Kacheln

Die erste Ebene zeigt kompakte Kacheln zu den tatsächlich relevanten globalen
Regelparametern.

Nicht empfohlen sind scheinbar personalisierte Lifecycle-Statusanzeigen, wenn
sie faktisch nur die globalen Regeln wiederholen.

Empfohlene Inhalte:

- Deaktivierung nach
- Pseudonymisierung nach
- Löschung nach
- Standard für eigene Inhalte
- persönliche Überschreibung aktiv oder aus

Darstellungsprinzip pro Kachel:

- großer Wert oder kurze Kennzahl
- kurze erklärende Zeile darunter

Beispiel:

- `90 Tage`
- `Deaktivierung nach Inaktivität`

#### Abschnitt `Globale Regeln`

Nach den Kacheln folgt ein erklärender Abschnitt, der die tenantweiten Regeln
knapp und verständlich erläutert.

Ziel ist nicht juristische Vollständigkeit, sondern verständliche Einordnung:

- wann Deaktivierung greift
- wann Pseudonymisierung greift
- wann Löschung greift
- wie eigene Inhalte standardmäßig behandelt werden

#### Abschnitt `Deine Einstellung`

Der Bereich `Deine Einstellung` ist klar von den globalen Regeln getrennt.

Er bündelt die persönliche Konfiguration, sofern eine Überschreibung zulässig
ist.

Das zentrale Element ist ein Dropdown mit der aktuell wirksamen Regel als
vorausgewähltem Wert.

Damit werden Anzeige des aktuellen Zustands und Änderbarkeit in einem Element
kombiniert.

Unter dem Dropdown bleibt ein kurzer Hilfetext, der erklärt:

- ob gerade der Tenant-Standard gilt oder eine persönliche Überschreibung
- was die gewählte Option fachlich bedeutet

Änderungen werden nicht sofort beim Auswählen gespeichert, sondern erst über
einen expliziten `Speichern`-Button bestätigt.

## Fachliche Einordnung der Kontoregeln

`Kontoregeln` werden bewusst als eigener Bereich modelliert, weil sie zwei
Charaktere gleichzeitig haben:

- Transparenz über globale Regeln
- persönliche Konfiguration über zulässige Überschreibungen

Da sich dieser Bereich fachlich weiterentwickeln wird, ist eine eigene Route
robuster als eine versteckte Untersektion innerhalb von `Datenschutz`.

## UX-Leitplanken

- Keine Funktion wird entfernt.
- Die neue Struktur trennt nach Nutzerzielen, nicht nach internen
  Datenmodellen.
- Datenschutzaktionen sollen auf `/account/privacy` schnell erreichbar und
  dominant bleiben.
- Kontoregeln sollen auf `/account/rules` verständlich erklärt werden, bevor
  persönliche Überschreibungen angeboten werden.
- Beide Bereiche sollen im Header-Dropdown gleichberechtigt auffindbar sein.

## Auswirkungen auf die bestehende UI

### Datenschutz-Seite

Die bestehende Privacy-Seite verliert die Sektion `Konten-Löschregeln` und
fokussiert sich vollständig auf Datenschutzaktionen und Vorgangsverlauf.

Die bisherige kartenbasierte Fallliste wird durch einen tabellarischen
Vorgangsbereich mit Filtern ersetzt.

### Neue Regeln-Seite

Die bestehende Kartenlogik zu Löschregeln wird auf eine eigene Route
verschoben und dort zu einer eigenständigen Regeln-Seite mit Kacheln,
Erklärbereich und persönlicher Einstellungssektion ausgebaut.

### Account-Einstieg

Der aktuelle Einstieg über `Mein Konto` bleibt erhalten, aber Datenschutz und
Kontoregeln werden zusätzlich direkt im Header-Dropdown erreichbar.

## Offene Folgearbeit

Diese Design-Entscheidung legt Navigation, Zuständigkeiten und die grobe
Seitenstruktur fest.
Folgende Detailfragen bleiben für die Umsetzungsplanung offen:

- genaue Gruppierung und visuelle Trennung der Header-Menüpunkte
- ob `Passwort ändern` und `E-Mail ändern` eigene Routen oder Dialoge erhalten
- genaue Inhaltsstruktur von `/account/rules`
- Migration bestehender Tests und Breadcrumbs auf die neue Route
- konkrete Benennung, Beschreibung und CTA-Texte der sechs Datenschutz-Karten
- genaue Spalten- und Filterbezeichnungen der Datenschutz-Tabelle
- exakte Routenstruktur für Datenschutzfall-Details
