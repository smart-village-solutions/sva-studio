# Design: Generisches Beispiel-PDF fuer den Abfallkalender

## Kontext

Zur Vorbereitung des Changes `add-waste-management-plugin` wird ein automatisch generiertes Beispiel-PDF benoetigt, das die spaetere Dokumentausgabe eines Abfallkalenders glaubwuerdig vorwegnimmt. Das Dokument dient als visuelle und fachliche Referenz fuer Layout, Informationsdichte und Renderregeln, ohne bereits auf produktive Waste-Daten angewiesen zu sein.

Die Gestaltung orientiert sich eng am Referenzdokument `abfallkalender-prignitz.pdf`, bleibt aber generisch. Reale Logos, Bilder und fachliche Echtdaten werden nicht verwendet. Stattdessen kommen Platzhalterdaten und graue Flaechen fuer moegliche Bild- oder Markenbereiche zum Einsatz.

## Ziel

Das Zielartefakt ist ein zweitseitiges PDF im Stil eines kommunalen Abfallkalenders. Es soll spaeter als belastbare Vorlage fuer einen echten Generator im Waste-Management-Plugin dienen.

## Empfohlener Ansatz

Empfohlen wird ein template-naher Generatoransatz. Das Beispiel-PDF wird nicht nur als statisches Mockup verstanden, sondern bereits so beschrieben, dass Seitenaufbau, Monatsraster, Farbzuordnung, Legende und Zusatzhinweise spaeter direkt aus Fachdaten gerendert werden koennen.

## Dokumentstruktur

### Seitenformat

- Das Dokument besteht aus genau zwei Seiten.
- Beide Seiten verwenden `A4 quer`.
- Seite 1 enthaelt `Januar` bis `Juni`.
- Seite 2 enthaelt `Juli` bis `Dezember`.

### Kopfbereich

Der Kopfbereich ist auf jeder Seite sichtbar und besteht aus:

- Titel `Abfallkalender 2026`
- Orts- oder Adressbezug, zum Beispiel `Musterstadt, Ackerstrasse`
- grauer Platzhalter fuer ein Herausgeberlogo oder Bild

Der Kopfbereich bleibt visuell zurueckhaltend und folgt eng den Proportionen des Referenzblatts.

### Kalenderbereich

Der Hauptbereich besteht pro Seite aus sechs Monatsbloecken in einer horizontalen Reihe.

Jeder Monatsblock enthaelt:

- eine gruene Monatsueberschrift
- ein vertikales Tagesraster mit Datum und Wochentagskuerzel
- Eintraege fuer Abfallfraktionen direkt in den Tageszeilen
- benannte Feiertage innerhalb der jeweiligen Tageszeile
- optionale Hervorhebungen fuer Sonderereignisse

Die Informationsdichte soll bewusst hoch bleiben und sich eng am Referenzblatt orientieren. Das Ziel ist keine modernisierte Magazinoptik, sondern ein vertrauter Verwaltungs- und Servicecharakter.

### Legende und Zusatzinformationen

Unterhalb des Kalenders stehen:

- links ein Block fuer Sonderhinweise oder Einzeltermine, zum Beispiel `Schadstoffmobil`
- rechts eine Legende mit Kuerzel, Farbkennzeichnung und Langbezeichnung

Am unteren Seitenrand steht eine einzeilige Kontaktzeile des Herausgebers als Platzhalter.

## Fachliche Beispieldaten

Die Beispielinhalte bleiben generisch, aber realistisch. Verwendet werden Platzhalterdaten fuer das Jahr 2026.

Verwendete Kuerzel:

- `HM`
- `Bio`
- `PPK`
- `LVP`
- `SM`
- `AG`

Beispielhafte Logik:

- `HM` erscheint in regelmaessigen zweiwoechigen Intervallen.
- `Bio` und `LVP` erscheinen auf ausgewaehlten gemeinsamen Abholtagen.
- `PPK` erscheint monatlich oder zweiwoechig.
- `SM` markiert einzelne Sondertermine.
- `AG` markiert vereinzelte Gebuehren- oder Verwaltungshinweise.
- Feiertage werden direkt in die Tageszeilen ausgeschrieben.

Die Daten muessen nicht fachlich korrekt fuer eine reale Kommune sein, aber sie sollen wie ein plausibler Jahreskalender wirken.

## Farbschema

Die Farblogik orientiert sich nah am Referenzdokument:

- `HM`: grau
- `Bio`: gruen
- `PPK`: blau
- `LVP`: gelb
- `SM`: rosa bis rot
- `AG`: hellgrau

Farben werden direkt an den Terminlabels verwendet. Die Monatsleisten bleiben gruen.

## Platzhalter und Branding

- Logos oder Bilder werden durch graue Flaechen ersetzt.
- Es werden keine echten Kommunenmarken eingebunden.
- Kontaktangaben im Fussbereich bleiben generische Platzhalter.

Damit bleibt die Ausgabe als Beispielartefakt erkennbar, zeigt aber trotzdem realistische Flaechenbedarfe fuer spaetere Herausgeber-Assets.

## Generatornahe Renderregeln

Die Spezifikation soll spaeter in einen echten PDF-Generator ueberfuehrt werden koennen. Dafuer gelten folgende Renderregeln:

- Jede Seite besitzt dieselbe Kopf-, Kalender-, Legenden- und Fusslogik.
- Jeder Monat ist ein fester Container mit definierter Breite innerhalb eines Sechs-Spalten-Rasters.
- Tage laufen chronologisch von oben nach unten.
- Mehrere Fraktionen koennen innerhalb derselben Tageszeile erscheinen.
- Feiertage werden textlich in der Tageszeile mitgefuehrt.
- Sonderhinweise und Legende bleiben ausserhalb des eigentlichen Monatsrasters.
- Die Layoutwirkung soll auch ohne echte Logos oder Bilder vollstaendig lesbar bleiben.

## Abgrenzung

Nicht Teil dieses Artefakts sind:

- produktive Waste-Management-Datenanbindung
- oeffentliche Buerger-APIs oder Exportfeeds
- Druckoptimierung fuer mehrere Kommunenvarianten
- konfigurierbare Layoutthemen
- ein vollstaendiger Generatorvertrag fuer alle kuenftigen Sonderfaelle

## Test- und Qualitaetskriterien

Das spaetere PDF gilt als passend, wenn:

- genau zwei Seiten erzeugt werden
- jede Seite sechs Monatsbloecke zeigt
- Kopfbereich, Legende, Zusatzinfos und Fussbereich vorhanden sind
- die Kuerzel `HM`, `Bio`, `PPK`, `LVP`, `SM`, `AG` sichtbar verwendet werden
- Feiertage textlich integriert sind
- graue Platzhalterflaechen fuer Logo oder Bild vorhanden sind
- das Gesamtbild in Proportion und Dichte klar an das Referenzblatt erinnert

## Ergebnis

Das Dokument definiert einen generischen, referenznahen und generatorfaehigen Abfallkalender als Beispiel-PDF fuer die Vorbereitung des Changes `add-waste-management-plugin`.
