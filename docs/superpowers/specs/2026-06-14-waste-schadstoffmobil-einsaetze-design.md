# Schadstoffmobil-Einsätze

## Kontext

Der öffentliche Abfallkalender wird nach Abfallfraktionen gefiltert. Das Schadstoffmobil ist deshalb fachlich keine besondere Tourart, sondern eine normale Abfallfraktion, die über die bestehende Tour–Fraktion-Beziehung einer oder mehreren normalen Touren zugeordnet wird.

Ein Einsatz des Schadstoffmobils besteht aus einem Datum, einem optionalen gemeinsamen Hinweis und einem oder mehreren Abholorten. Abholorte können konkrete oder übergeordnete Orte sein. Ein Einsatz für `Perleberg (alle Straßen)` muss daher bei der Kalenderabfrage für eine konkrete Straße in Perleberg erscheinen.

Das bisherige Modell `waste_location_tour_pickup_dates` kann diese Fachlichkeit nicht vollständig abbilden: Es bindet Hinweis und Datum an genau einen Ort und verhindert mit seiner eindeutigen Kombination aus Tour, Ort und Datum mehrere Einsätze derselben Tour am selben Tag.

## Ziele

- Schadstoffmobil erscheint als auswählbare Abfallfraktion im bestehenden Kalenderfilter.
- Einsätze gehören zu normalen Touren und folgen dadurch deren Fraktionszuordnungen.
- Ein Einsatz kann mehrere Abholorte mit einem gemeinsamen optionalen Hinweis abdecken.
- Mehrere Einsätze derselben Tour am selben Tag bleiben zulässig.
- Übergeordnete Abholorte gelten für alle untergeordneten Adressen.
- Redaktionelle Pflege erfolgt in der vorhandenen Tourpflege und mit der vorhandenen Berechtigung `waste-management.scheduling.manage`.

## Nicht-Ziele

- Keine neue Rolle, Berechtigung, API-Aktion oder Schadstoffmobil-Sondermaske.
- Keine erzwungene Einzigkeit für Fraktion, Tour oder Einsätze.
- Keine strukturierte Zerlegung des Hinweises in Zeitfenster oder weitere Felder.
- Keine Suche oder Filterung innerhalb des Hinweistexts.
- Keine Änderung an der normalen Fraktions- oder Tourverwaltung.

## Domänenmodell

### Abfallfraktion und Tour

`Schadstoffmobil` wird als normale aktive Abfallfraktion angelegt. Die Fraktion wird über die vorhandenen `wasteFractionIds` einer oder mehreren normalen `waste_tours` zugeordnet. Diese Zuordnung ist die einzige Grundlage dafür, unter welcher Fraktion ein Einsatz im öffentlichen Kalender erscheint.

Es gibt keine Erkennung über einen Tour-Namen. Ob fachlich nur eine Tour verwendet wird, ist eine betriebliche Konvention und keine technische Nebenbedingung.

### Einsatz

Ein Einsatz ist eine eigenständige Entität mit:

- `id`
- `tour_id`
- `pickup_date`
- `note` als optionalem, gemeinsamen Freitext
- `created_at` und `updated_at`

Mehrere Einsätze mit derselben Tour und demselben Datum sind zulässig.

### Einsatzorte

Ein Einsatz hat mindestens einen Einsatzort. Die Zuordnung enthält:

- `assignment_id`
- `collection_location_id`

Ein Ort kann mehreren Einsätzen derselben Tour am selben Tag zugeordnet sein. Doppelte Zuordnungen innerhalb desselben Einsatzes sind nicht zulässig.

## Ortsauflösung für öffentliche Kalender

Bei einer Kalenderabfrage wird der konkrete Abholort einschließlich seiner übergeordneten Orte aufgelöst. Ein Einsatz wird angezeigt, wenn mindestens einer seiner Einsatzorte in dieser Menge enthalten ist.

Beispiel: Für eine Adresse in der Ackerstraße werden Einsätze angezeigt, die an der konkreten Adresse, an der Straße, am Ort oder an einem weiteren bereits vorhandenen übergeordneten Abholort hinterlegt sind. Die Auflösung erfolgt nur von konkret nach übergeordnet, nie umgekehrt.

Allgemeine Tour-Ort-Zuordnungen (`waste_location_tour_links`) sind für explizite Einsätze keine Voraussetzung. Sie bleiben für reguläre, wiederkehrende Tourlogik unverändert bestehen.

## Redaktionelle Pflege

Die vorhandene Tourpflege erhält eine generische Einsatzverwaltung. Redakteurinnen und Redakteure legen dort Einsätze mit Datum, optionalem Hinweis und einer Mehrfachauswahl von Abholorten an, bearbeiten sie und löschen sie.

Die Auswahl bietet alle vorhandenen Abholorte einschließlich übergeordneter Orte. Die Benutzeroberfläche behandelt das Schadstoffmobil nicht speziell; die Fraktionszuordnung der Tour sorgt für die Darstellung und Filterung im Kalender.

## Öffentliche Ausgabe

Ein expliziter Einsatz wird als konkrete Ausprägung einer Tour im Kalender ausgegeben und trägt deren Abfallfraktionen. Damit funktioniert der bestehende Fraktionsfilter unverändert.

Trifft ein expliziter Einsatz auf einen regulär berechneten Termin derselben Tour und desselben abgefragten Orts, stellt der Kalender den expliziten Einsatz statt eines doppelten generischen Eintrags dar. Mehrere explizite Einsätze bleiben getrennte Kalendereinträge. Der explizite Hinweis hat Vorrang vor einem allgemeinen Tour- oder Verschiebungshinweis.

## Import und Migration

Der Import für Einsätze benötigt eine stabile Einsatzkennung, damit mehrere Ortszeilen zu einem Einsatz mit gemeinsamem Hinweis gruppiert werden. Ein Einsatz ohne Ort ist ungültig; der Hinweis bleibt optional.

Bestehende Datensätze aus `waste_location_tour_pickup_dates` werden additiv migriert: Jeder Datensatz wird zu einem Einsatz mit genau einem Einsatzort, wobei Datum, Tour und Hinweis erhalten bleiben. Leser wechseln erst nach erfolgreicher Migration auf das neue Modell.

## Fehlerbehandlung und Zugriffsregeln

- Ungültige Touren, ungültige Daten und Einsätze ohne Ort werden vor dem Speichern abgewiesen.
- Mehrere Einsätze am gleichen Tag oder wiederholte Ortsverwendung in verschiedenen Einsätzen sind zulässig.
- Die bestehende Aktion `waste-management.scheduling.manage` schützt alle schreibenden Einsatzoperationen.
- Hinweise werden als Freitext gespeichert und wie andere redaktionelle Inhalte sicher ausgegeben.

## Tests

Mindestens erforderlich sind:

- Repository-Tests für Einsatz und mehrere Einsatzorte.
- Migrationstest von einem bisherigen Einzeltermin zu einem Einsatz mit einem Ort.
- Importtest, der mehrere Ortszeilen über die Einsatzkennung zusammenführt.
- Studio-Test für Anlegen, Bearbeiten und Löschen eines Einsatzes mit mehreren Orten.
- Public-Output-Tests für Fraktionsfilter, übergeordnete Ortsauflösung, mehrere Einsätze am selben Tag und die Unterdrückung eines doppelten Wiederholungstermins.
