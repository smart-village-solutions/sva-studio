# Design: Generisches Beispiel-PDF für den Abfallkalender

## Kontext

Zur Vorbereitung des Changes `add-waste-management-plugin` wird ein automatisch generiertes Beispiel-PDF benötigt, das die spätere Dokumentausgabe eines Abfallkalenders glaubwürdig vorwegnimmt. Das Dokument dient als visuelle und fachliche Referenz für Layout, Informationsdichte und Renderregeln, ohne bereits auf produktive Waste-Daten angewiesen zu sein.

Die Gestaltung orientiert sich eng am Referenzdokument `abfallkalender-prignitz.pdf`, bleibt aber generisch. Reale Logos, Bilder und fachliche Echtdaten werden nicht verwendet. Stattdessen kommen Platzhalterdaten und graue Flächen für mögliche Bild- oder Markenbereiche zum Einsatz.

## Ziel

Das Zielartefakt ist ein zweiseitiges PDF im Stil eines kommunalen Abfallkalenders. Es soll später als belastbare Vorlage für einen echten Generator im Waste-Management-Plugin dienen.

## Empfohlener Ansatz

Empfohlen wird ein template-naher Generatoransatz. Das Beispiel-PDF wird nicht nur als statisches Mockup verstanden, sondern bereits so beschrieben, dass Seitenaufbau, Monatsraster, Farbzuordnung, Legende und Zusatzhinweise später direkt aus Fachdaten gerendert werden können.

## Dokumentstruktur

### Seitenformat

- Das Dokument besteht aus genau zwei Seiten.
- Beide Seiten verwenden `A4 quer`.
- Seite 1 enthält `Januar` bis `Juni`.
- Seite 2 enthält `Juli` bis `Dezember`.

### Kopfbereich

Der Kopfbereich ist auf jeder Seite sichtbar und besteht aus:

- Titel `Abfallkalender 2026`
- Orts- oder Adressbezug, zum Beispiel `Musterstadt, Ackerstraße`
- grauer Platzhalter für ein Herausgeberlogo oder Bild

Der Kopfbereich bleibt visuell zurückhaltend und folgt eng den Proportionen des Referenzblatts.

### Kalenderbereich

Der Hauptbereich besteht pro Seite aus sechs Monatsblöcken in einer horizontalen Reihe.

Jeder Monatsblock enthält:

- eine grüne Monatsüberschrift
- ein vertikales Tagesraster mit Datum und Wochentagskürzel
- Einträge für Abfallfraktionen direkt in den Tageszeilen
- benannte Feiertage innerhalb der jeweiligen Tageszeile
- optionale Hervorhebungen für Sonderereignisse

Die Informationsdichte soll bewusst hoch bleiben und sich eng am Referenzblatt orientieren. Das Ziel ist keine modernisierte Magazinoptik, sondern ein vertrauter Verwaltungs- und Servicecharakter.

### Legende und Zusatzinformationen

Unterhalb des Kalenders stehen:

- links ein Block für Sonderhinweise oder Einzeltermine, zum Beispiel `Schadstoffmobil`
- rechts eine Legende mit Kürzel, Farbkennzeichnung und Langbezeichnung

Am unteren Seitenrand steht eine einzeilige Kontaktzeile des Herausgebers als Platzhalter.

## Fachliche Beispieldaten

Die Beispielinhalte bleiben generisch, aber realistisch. Verwendet werden Platzhalterdaten für das Jahr 2026.

Verwendete Kürzel:

- `HM`
- `Bio`
- `PPK`
- `LVP`
- `SM`
- `AG`

Beispielhafte Logik:

- `HM` erscheint in regelmäßigen zweiwöchigen Intervallen.
- `Bio` und `LVP` erscheinen auf ausgewählten gemeinsamen Abholtagen.
- `PPK` erscheint monatlich oder zweiwöchig.
- `SM` markiert einzelne Sondertermine.
- `AG` markiert vereinzelte Gebühren- oder Verwaltungshinweise.
- Feiertage werden direkt in die Tageszeilen ausgeschrieben.

Die Daten müssen nicht fachlich korrekt für eine reale Kommune sein, aber sie sollen wie ein plausibler Jahreskalender wirken.

## Farbschema

Die Farblogik orientiert sich nah am Referenzdokument:

- `HM`: grau
- `Bio`: grün
- `PPK`: blau
- `LVP`: gelb
- `SM`: rosa bis rot
- `AG`: hellgrau

Farben werden direkt an den Terminlabels verwendet. Die Monatsleisten bleiben grün.

## Platzhalter und Branding

- Logos oder Bilder werden durch graue Flächen ersetzt.
- Es werden keine echten Kommunenmarken eingebunden.
- Kontaktangaben im Fußbereich bleiben generische Platzhalter.

Damit bleibt die Ausgabe als Beispielartefakt erkennbar, zeigt aber trotzdem realistische Flächenbedarfe für spätere Herausgeber-Assets.

## Generatornahe Renderregeln

Die Spezifikation soll später in einen echten PDF-Generator überführt werden können. Dafür gelten folgende Renderregeln:

- Jede Seite besitzt dieselbe Kopf-, Kalender-, Legenden- und Fußlogik.
- Jeder Monat ist ein fester Container mit definierter Breite innerhalb eines Sechs-Spalten-Rasters.
- Tage laufen chronologisch von oben nach unten.
- Mehrere Fraktionen können innerhalb derselben Tageszeile erscheinen.
- Feiertage werden textlich in der Tageszeile mitgeführt.
- Sonderhinweise und Legende bleiben außerhalb des eigentlichen Monatsrasters.
- Die Layoutwirkung soll auch ohne echte Logos oder Bilder vollständig lesbar bleiben.

## Abgrenzung

Nicht Teil dieses Artefakts sind:

- produktive Waste-Management-Datenanbindung
- öffentliche Bürger-APIs oder Exportfeeds
- Druckoptimierung für mehrere Kommunenvarianten
- konfigurierbare Layoutthemen
- ein vollständiger Generatorvertrag für alle künftigen Sonderfälle

## Test- und Qualitätskriterien

Das spätere PDF gilt als passend, wenn:

- genau zwei Seiten erzeugt werden
- jede Seite sechs Monatsblöcke zeigt
- Kopfbereich, Legende, Zusatzinfos und Fußbereich vorhanden sind
- die Kürzel `HM`, `Bio`, `PPK`, `LVP`, `SM`, `AG` sichtbar verwendet werden
- Feiertage textlich integriert sind
- graue Platzhalterflächen für Logo oder Bild vorhanden sind
- das Gesamtbild in Proportion und Dichte klar an das Referenzblatt erinnert

## Ergebnis

Das Dokument definiert einen generischen, referenznahen und generatorfähigen Abfallkalender als Beispiel-PDF für die Vorbereitung des Changes `add-waste-management-plugin`.
