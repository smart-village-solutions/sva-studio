# Schadstoffmobil-Einsätze

## Kontext

Das bestehende Waste-Management-Modell deckt reguläre Touren gut ab: Touren besitzen Wiederholungslogik, allgemeine Ortszuordnungen und berechnete Termine. Für das Schadstoffmobil reicht dieses Modell fachlich nicht aus. Die fachliche Wahrheit ist hier nicht "welche Tour fährt grundsätzlich welche Orte an", sondern "an welchem Tag kann das Schadstoffmobil an welchem Ort mit welchem Hinweis angetroffen werden".

Im Bestand existieren bereits drei relevante Bausteine:

- `waste_tours` für die übergeordnete Tour
- `waste_location_tour_links` für generelle Ortszuordnungen über Zeiträume
- `waste_location_tour_pickup_dates` für explizite ortsbezogene Termine

Für das Schadstoffmobil soll es genau eine Tour geben. Pro Einsatztag und Abholort wird ein reiner Freitext-Hinweis gepflegt. Der Hinweis wird weder durchsucht noch gefiltert.

## Ziele

- Das Schadstoffmobil bleibt als genau eine Tour modelliert.
- Datum, Abholort und Hinweis werden als explizite Einsätze gepflegt.
- Die führende Wahrheit für das Schadstoffmobil ist eine Einsatzliste, nicht eine aus Wiederholung und Standard-Ortszuordnung abgeleitete Terminlogik.
- Die Lösung bleibt nah am bestehenden Schema und am vorhandenen Importpfad für ortsbezogene Tourtermine.

## Nicht-Ziele

- Keine neue Tour pro Einsatztag
- Keine strukturierte Modellierung des Hinweises in Startzeit, Endzeit oder Teilfeldern
- Keine Suche oder Filterung auf dem Hinweistext
- Keine Änderung der bestehenden Modellierung regulärer Touren

## Entscheidungen

### 1. Tourmodell

Das Schadstoffmobil bleibt eine normale Tour in `waste_tours`, zum Beispiel `Schadstoffmobil`.

Die Tour dient nur als fachlicher Container und Identifikationsanker. Ihre Standard-Wiederholungslogik ist für die öffentlichen Einsätze nicht führend.

### 2. Führende Einsatzdaten

Die bestehende Tabelle `waste_location_tour_pickup_dates` wird für das Schadstoffmobil zur führenden Einsatzliste ausgebaut. Dazu wird ein optionales Feld `note TEXT` ergänzt.

Ein Einsatzdatensatz besteht damit aus:

- `tour_id`
- `location_id`
- `pickup_date`
- `note`

Für das Schadstoffmobil ist genau diese Kombination die fachliche Wahrheit: wann, wo und mit welchem Hinweis das Fahrzeug angetroffen werden kann.

### 3. Verhältnis zu allgemeinen Ortszuordnungen

`waste_location_tour_links` bleibt für reguläre Touren unverändert bestehen. Für das Schadstoffmobil ist diese Tabelle nicht führend. Sie kann optional weiter für allgemeine Beziehungen oder UI-Hilfen bestehen, darf aber nicht die öffentlichen Einsätze bestimmen.

### 4. Hinweistext

`note` ist ein reiner Freitext. Beispiele:

- `Dienstag 14:00–16:30 Uhr, Parkplatz am Rathaus`
- `Vor dem Wertstoffhof, nur Annahme von Problemabfällen aus Haushalten`

Es gibt keine zusätzliche Feldstruktur und keine Such- oder Filterfunktion auf diesem Text.

## Datenfluss

### Studio

Im Studio wird für die Tour `Schadstoffmobil` eine eigene Einsatzliste gepflegt. Ein Eintrag enthält:

- Datum
- Abholort
- Hinweis

Anlegen, Bearbeiten und Löschen arbeiten direkt auf `waste_location_tour_pickup_dates.note`.

Die bestehende Tourmaske bleibt für Basismetadaten wie Name und Aktiv-Status zuständig.

### Import

Der bestehende Importpfad `waste-management.ortsbezogene-tourtermine` wird um die Spalte `note` erweitert.

Der Import erzeugt oder aktualisiert explizite Einsatzdatensätze. Für das Schadstoffmobil ist dieser Import damit fachlich passend, weil er bereits orts- und datumsbezogen arbeitet.

### Öffentliche Ausgabe

Die öffentliche Ausgabe des Schadstoffmobils verwendet die expliziten Einsatzdatensätze direkt. Sie zeigt pro Eintrag:

- Datum
- Ort
- Hinweis

Es findet keine Ableitung über Wiederholung oder Standard-Ortszuordnung statt.

## Validierung

- Pro Kombination aus `tour_id`, `location_id` und `pickup_date` bleibt genau ein Datensatz zulässig. Die bestehende Unique-Constraint bleibt erhalten.
- `note` ist technisch optional, damit das bestehende Modell kompatibel bleibt.
- Für Schadstoffmobil-Einsätze wird `note` fachlich als Pflichtfeld behandelt.
- Reguläre Touren dürfen weiterhin Einträge ohne `note` verwenden, sofern sie diese Tabelle überhaupt nutzen.

## API und Repository

Repository- und API-Modelle für `waste_location_tour_pickup_dates` werden um `note?: string | null` erweitert.

Die Änderung ist additiv:

- bestehende Leser bleiben kompatibel
- bestehende Datensätze bleiben gültig
- neue Studio- und Importpfade können das Feld sofort nutzen

## Migration

Die technische Migration bleibt klein:

1. Schema um `note TEXT` in `waste_location_tour_pickup_dates` erweitern
2. Repository-Lese- und Schreibpfade anpassen
3. Importschema und Importpersistenz um `note` ergänzen
4. Studio-Einsatzliste für das Schadstoffmobil ergänzen
5. Öffentliche Ausgabe auf direkte Nutzung des Hinweises prüfen

## Fehlerbehandlung

- Ein doppelter Einsatz für dieselbe Kombination aus Tour, Ort und Datum wird wie bisher über die eindeutige Kombination abgefangen.
- Leerer Hinweis bei Schadstoffmobil-Einsätzen wird im Studio und im Import als Validierungsfehler behandelt.
- Öffentliche Ausgabe ohne `note` fällt nicht auf technische Fehler zurück, sondern zeigt den Eintrag ohne Zusatztext nur dort an, wo dies für Nicht-Schadstoffmobil-Touren zulässig ist.

## Tests

Mindestens erforderlich sind:

- Repository-Test für Lesen und Upsert mit `note`
- Import-Test für `waste-management.ortsbezogene-tourtermine` mit `note`
- Studio-UI-Test für Anlegen, Bearbeiten und Löschen eines Schadstoffmobil-Einsatzes
- Public-Output-Test, dass explizite Einsätze mit Datum, Ort und Hinweis angezeigt werden

## Risiken und Trade-offs

- Die Wiederverwendung von `waste_location_tour_pickup_dates` ist pragmatisch und hält die Änderung klein. Sie ist semantisch etwas allgemeiner als ein dedizierter Einsatztyp, aber ausreichend nah am fachlichen Bedarf.
- Die Pflicht des Hinweises gilt fachlich nur für das Schadstoffmobil. Diese Regel muss deshalb an Tourtyp oder Anwendungsfluss gebunden werden, nicht global für alle Datensätze der Tabelle.
- Wenn später strukturierte Zeitfelder benötigt werden, kann `note` nicht verlustfrei ausgewertet werden. Das ist hier bewusst akzeptiert, weil aktuell reiner Freitext gewünscht ist.
