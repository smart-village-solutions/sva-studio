# Waste-Abholpunkte global sortieren und auswählen

Die Abholpunktliste unter **Abfallkalender → Abholpunkte** wird
global in der instanzbezogenen Waste-Datenbank gefiltert, sortiert und
paginiert. Die sichtbare Reihenfolge gilt deshalb für den gesamten Trefferbestand
und nicht nur für die aktuelle Browserseite.

## Sortierung bedienen

Die Standardsortierung ist **Adresse, aufsteigend**. Sie verwendet diese
Reihenfolge:

1. Ort
2. Straße
3. Hausnummer
4. technische ID als stabiler Gleichstandsauflöser

Im Dialog **Filter** ergänzt die Adressreihenfolge mit Region dieses erste Kriterium.
Die einzelnen Spalten Region, Ort, Straße, Hausnummer, Touren und Status sind
über die Tabellenköpfe und die Feldauswahl im Dialog sortierbar. Die Spalte
Touren sortiert nach der Zahl der angezeigten Zuordnungen einschließlich null. Bis zu drei
Touren sind je Abholpunkt direkt sichtbar. Längere Listen lassen sich über
die angezeigte Anzahl aufklappen. Dort stehen die Touren mit ihren
Gültigkeitszeiträumen und Verknüpfungen zu den Tourdetails.
Die gemeinsame Richtung gilt für alle fachlichen Kriterien. Die technische ID
bleibt immer aufsteigend, damit ein Datensatz beim Blättern nicht zwischen
Seiten wandert. Fehlende Region, Straße oder Hausnummer stehen in beiden
Richtungen am Ende.

Die Datenbank verwendet eine feste deutsch-numerische ICU-Sortierung. Dadurch
stehen beispielsweise die Hausnummern `2`, `2a` und `10` in natürlicher Folge;
Groß-/Kleinschreibung und Umlaute werden nach demselben Vertrag auf jeder
Studio-Instanz verglichen.

## Filter, Seiten und URL-Zustand

Suche, Aktivitätsstatus, Region, Ort, Straße, Hausnummer und konkrete Tour
werden vor der Sortierung auf den Gesamtbestand angewendet. Jahr und
Tourstatus bestimmen die angezeigten und bei der Sortierung gezählten
Zuordnungen. Ein Abholpunkt ohne passende Zuordnung bleibt in der Liste,
solange keine konkrete Tour oder ein anderes Kriterium ihn ausschließt. Änderungen an einem Filter, an der Sortierung oder an
der Seitengröße springen auf Seite eins zurück. Ein reiner Seitenwechsel behält
alle anderen Einstellungen bei.

Paginierte Tabellen im Abfallmodul zeigen standardmäßig 100 Einträge pro Seite.
Wo die Seitengröße auswählbar ist, gilt die gewählte Größe.

Sortiermodus und Richtung liegen wie die übrigen Listenparameter in der URL.
Ein geteilter oder neu geladener Link stellt deshalb dieselbe Ansicht wieder
her. Ungültige UI-Werte werden auf die Defaults normalisiert; unbekannte oder
widersprüchliche Direktparameter weist der Server mit `400 invalid_request` ab.

Jeder Tab verwendet seine eigenen Filter. Beim Wechsel über die Tab-Leiste
erscheinen die zuletzt verwendeten Filter des Ziel-Tabs. **Filter zurücksetzen**
setzt nur die Filter der geöffneten Liste zurück. Das Studio hält die zuletzt
verwendeten Filter im Arbeitsspeicher für den laufenden Anmeldekontext.
Nach Abmeldung oder einem neuen Browser-Tab gelten die Standardwerte oder die
ausdrücklich in der geöffneten URL gesetzten Filter.

## Tabellenköpfe im Abfallmodul

Die sechs Listen beginnen mit Suche oder Filter und den fachlichen Aktionen.
Der mittig geöffnete Dialog bearbeitet einen Entwurf. **Filter anwenden**
übernimmt ihn. **Abbrechen** und Escape lassen die Treffer unverändert.
Angewandte Kriterien stehen unter der Bedienleiste und lassen sich einzeln
entfernen. Sammelaktionen für markierte Einträge stehen bei der Auswahl. Der
aktive Tourfilter der Abholpunktliste zeigt auch den Gültigkeitszeitraum.
Bei einer Suche oder Filterauswahl ohne Treffer lässt sich der Listenfilter
direkt im Leerzustand zurücksetzen.

Abfallarten sind auch über das PDF-Kürzel auffindbar. In den Stammdaten steuert
der Datentyp die Elternauswahl. Ausweichtermine lassen sich zusätzlich nach Typ,
Tour und Zeitraum des ursprünglichen Abholtermins filtern. Bei Tour-Einsätzen
steht die Tour als Filter bereit. Eine verknüpfte Tour bleibt über **Zur Tour**
erreichbar. Die Listen sind nach ihren Fachspalten sortierbar.

Die Fraktionsprüfung öffnet sich in der Abholpunktliste über
**Fraktionszuordnung prüfen**. Ausgabe, Datentools und Einstellungen gruppieren
die Arbeit in aufklappbare Abschnitte. Beim Schließen bleiben Eingaben und
Prozessfortschritt erhalten.

## Auswahl über mehrere Seiten

Ausgewählte Abholpunkte werden anhand ihrer IDs gehalten. Sie bleiben bei
Sortier- und Seitenwechseln ausgewählt. **Alle gefilterten auswählen** verwendet
eine serverseitige Auflösung sämtlicher IDs des aktuellen Filters, nicht nur die
IDs der sichtbaren Seite.

Beim Abwählen werden nur die Einträge des aktuellen Filters entfernt. Bereits
ausgewählte Abholpunkte außerhalb dieses Filters bleiben erhalten. Der bestehende
Master-Data-Overview bleibt weiterhin für Hierarchien, Formulare und
Zuordnungsansichten zuständig; die paginierte Projektion besitzt ausschließlich
die Listenreihenfolge, Gesamtzahl und Seitendaten.

## Technischer Betrieb

Neue Tenant-Datenbanken erhalten die Collation `public.sva_de_numeric` beim
Schemaaufbau. Für bestehende Datenbanken installiert sie die versionierte
Waste-Tenant-Migration `20260824_01_add_german_numeric_collation`. Reguläre
Rollouts und Migrationen folgen ausschließlich dem
[Studio-Rollout-Prozess](../guides/studio-rollout-process.md).
Die Migration prüft auch die ICU-Version. Bei Versionsdrift gilt das in der
[Datenbankschema-Dokumentation](../development/studio-db-schema.md#datenbankweiter-sortiervertrag-für-waste-abholorte)
beschriebene Wartungsverfahren; ein automatisches Versions-Refresh findet nicht
statt.

## Ansichten und Bearbeitungsrückweg

Die **Abholpunktliste** sucht nach Ort und Straße über den Gesamtbestand. Region und
Ort grenzen die Treffer ein; Jahr und Tourstatus grenzen die angezeigten
Tourbezüge ein. Bereits zugeordnete Abholpunkte erhalten hier keine bevorzugte
Listenposition.

Unter **Stammdaten** wird nach Region, Ort, Straße oder Hausnummer gesucht.
Mehrere Buchstaben können zusammenhängend eingegeben werden; Enter oder das
Verlassen des Suchfelds übernimmt den Begriff. Die Sortierschaltflächen in den
vorgesehenen Spalten sortieren den vollständigen Trefferbestand vor dem Blättern.

Auf der Detailseite **Tour-Zuordnung** sucht die Freitextsuche nach Ort und
Straße. Die Filter für Region, Ort und Straße wirken gemeinsam und bieten
alphabetisch sortierte Optionen. Beim Wechsel eines übergeordneten Filters
bleiben die weiterhin passenden Auswahlen erhalten.
Die Spaltenüberschriften sortieren die vollständige Treffermenge vor dem
Blättern. Innerhalb der ausgewählten und der freien Abholpunkte gilt dieselbe
Reihenfolge, ausgewählte Abholpunkte stehen zuerst. **Alle gefilterten auswählen**
erfasst die Treffer auf sämtlichen Seiten und erhält Auswahlen außerhalb des Filters.
Ein Statusabruf behält Suchtext, Filter, Sortierung und ungespeicherte Haken für
die geöffnete Tour bei. Beim Abbrechen wird der Entwurf verworfen. Beim nächsten
Öffnen zeigt die Seite den gespeicherten Zuordnungsstand der gewählten Tour.
Während einer erneuten Berechtigungsprüfung pausiert die Bearbeitung. Nach
bestätigtem Schreibrecht im selben Konto, Mandanten und Organisationskontext
erscheint der Entwurf wieder. Bei einem Kontextwechsel oder bei Rechteentzug wird
er verworfen.

Die Abholpunktanzahl in der Tourenliste und **Abholpunkte zuordnen** in den
Tourdetails öffnen dieselbe Seite. **Zurück zur Tourenliste** führt zu den
bisherigen Listenfiltern. Sind Zuordnungen geändert, bietet der Rücksprung
**Weiter bearbeiten** und **Verwerfen und zurück** an. Nach erfolgreichem
Speichern öffnet sich die gefilterte Tourenliste automatisch.

Eine Straße wird auf der Zuordnungsseite auswählbar, sobald dafür ein Abholpunkt angelegt
ist. Die Ansichten **Touren** und **Abholpunkte** laden ihre Zuordnungen beim
Wechsel in den jeweiligen Tab erneut. In der Abholpunkt-Detailansicht steht der
Gültigkeitszeitraum direkt unter dem Tournamen, damit gleich benannte Touren
unterschiedlicher Jahrgänge unterscheidbar sind.

In der Detailansicht eines Abholpunkts markiert die Liste der Tour-Zuordnungen
offene Zuordnungen und Entfernungen. Die Filter grenzen die Touren nach Name und
Gültigkeitsjahr ein. Eine über den Jahreswechsel gültige Tour erscheint in beiden
Jahren. Standardmäßig stehen ausgewählte Touren zuerst. Eine Spaltensortierung
ordnet alle Treffer vor dem Blättern. **Alle gefilterten Touren auswählen**
erfasst die Treffer auf sämtlichen Seiten und erhält Auswahlen außerhalb des
Filters. **Zuordnungen speichern** bestätigt
Änderungen nach dem erneuten Lesen des gespeicherten Stands. Bei einem
unklaren Ergebnis liest **Zuordnungen erneut lesen** den Stand erneut.
Nach einem Teilerfolg bearbeitet der nächste Speichervorgang die noch offenen
Änderungen.

Wer aus der Abdeckungsprüfung einen Abholpunkt zur Bearbeitung öffnet und
abbricht, erhält die bisherigen Listeneinstellungen einschließlich Tourfilter
und Seite zurück. Fraktion, Jahr beziehungsweise Zeitraum und die Auswahl zum
Einbeziehen von Entwürfen bleiben während dieser Bearbeitung erhalten.
Das Prüfergebnis wird nach der Rückkehr erneut berechnet, sobald **Prüfen**
betätigt wird. Diese lokalen Prüfkriterien werden nicht über einen Seitenreload
oder einen Wechsel in andere Arbeitsbereiche hinweg gespeichert.

Lange Zuordnungsdialoge begrenzen ihre Höhe auf das Browserfenster. In der
Sammelzuordnung ist der Bereich **Ausgewählte Abholpunkte** mit Tab erreichbar;
Pfeiltasten sowie Bild auf/Bild ab scrollen die Zusammenfassung. Tourauswahl,
Abbrechen und Zuweisen bleiben über Tab erreichbar.
