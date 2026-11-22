# Waste-Abholorte global sortieren und auswählen

Die Abholortliste unter **Abfallkalender → Abholorte** wird
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

Mit **Region berücksichtigen** wird die Region als erstes Kriterium ergänzt.
Die gemeinsame Richtung gilt für alle fachlichen Kriterien. Die technische ID
bleibt immer aufsteigend, damit ein Datensatz beim Blättern nicht zwischen
Seiten wandert. Fehlende Region, Straße oder Hausnummer stehen in beiden
Richtungen am Ende.

Die Datenbank verwendet eine feste deutsch-numerische ICU-Sortierung. Dadurch
stehen beispielsweise die Hausnummern `2`, `2a` und `10` in natürlicher Folge;
Groß-/Kleinschreibung und Umlaute werden nach demselben Vertrag auf jeder
Studio-Instanz verglichen.

## Filter, Seiten und URL-Zustand

Suche, Status, Region, Ort und Tour werden vor Sortierung und Pagination auf den
Gesamtbestand angewendet. Änderungen an einem Filter, an der Sortierung oder an
der Seitengröße springen auf Seite eins zurück. Ein reiner Seitenwechsel behält
alle anderen Einstellungen bei.

Paginierte Tabellen im Abfallmodul zeigen standardmäßig 100 Einträge pro Seite.
Wo die Seitengröße auswählbar ist, gilt die gewählte Größe.

Sortiermodus und Richtung liegen wie die übrigen Listenparameter in der URL.
Ein geteilter oder neu geladener Link stellt deshalb dieselbe Ansicht wieder
her. Ungültige UI-Werte werden auf die Defaults normalisiert; unbekannte oder
widersprüchliche Direktparameter weist der Server mit `400 invalid_request` ab.

## Auswahl über mehrere Seiten

Ausgewählte Abholorte werden anhand ihrer IDs gehalten. Sie bleiben bei
Sortier- und Seitenwechseln ausgewählt. **Alle gefilterten auswählen** verwendet
eine serverseitige Auflösung sämtlicher IDs des aktuellen Filters, nicht nur die
IDs der sichtbaren Seite.

Beim Abwählen werden nur die Einträge des aktuellen Filters entfernt. Bereits
ausgewählte Abholorte außerhalb dieses Filters bleiben erhalten. Der bestehende
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

Die **Abholortliste** sucht nach Ort und Straße über den Gesamtbestand. Region und
Ort grenzen die Treffer ein; Jahr und Tourstatus grenzen die angezeigten
Tourbezüge ein. Bereits zugeordnete Abholorte erhalten hier keine bevorzugte
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
Blättern. Innerhalb der ausgewählten und der freien Abholorte gilt dieselbe
Reihenfolge, ausgewählte Abholorte stehen zuerst. **Alle gefilterten auswählen**
erfasst die Treffer auf sämtlichen Seiten und erhält Auswahlen außerhalb des Filters.
Ein Statusabruf behält Suchtext, Filter, Sortierung und ungespeicherte Haken für
die geöffnete Tour bei. Beim Abbrechen wird der Entwurf verworfen. Beim nächsten
Öffnen zeigt die Seite den gespeicherten Zuordnungsstand der gewählten Tour.
Während einer erneuten Berechtigungsprüfung pausiert die Bearbeitung. Nach
bestätigtem Schreibrecht im selben Konto, Mandanten und Organisationskontext
erscheint der Entwurf wieder. Bei einem Kontextwechsel oder bei Rechteentzug wird
er verworfen.

Die Abholortanzahl in der Tourenliste und **Abholorte zuordnen** in den
Tourdetails öffnen dieselbe Seite. **Zurück zur Tourenliste** führt zu den
bisherigen Listenfiltern. Sind Zuordnungen geändert, bietet der Rücksprung
**Weiter bearbeiten** und **Verwerfen und zurück** an. Nach erfolgreichem
Speichern öffnet sich die gefilterte Tourenliste automatisch.

Eine Straße wird auf der Zuordnungsseite auswählbar, sobald dafür ein Abholort angelegt
ist. Die Ansichten **Touren** und **Abholorte** laden ihre Zuordnungen beim
Wechsel in den jeweiligen Tab erneut. In der Abholort-Detailansicht steht der
Gültigkeitszeitraum direkt unter dem Tournamen, damit gleich benannte Touren
unterschiedlicher Jahrgänge unterscheidbar sind.

In der Detailansicht eines Abholorts markiert die Liste der Tour-Zuordnungen
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

Wer aus der Abdeckungsprüfung einen Abholort zur Bearbeitung öffnet und
abbricht, erhält die bisherigen Listeneinstellungen einschließlich Tourfilter
und Seite zurück. Fraktion, Jahr beziehungsweise Zeitraum und die Auswahl zum
Einbeziehen von Entwürfen bleiben während dieser Bearbeitung erhalten.
Das Prüfergebnis wird nach der Rückkehr erneut berechnet, sobald **Prüfen**
betätigt wird. Diese lokalen Prüfkriterien werden nicht über einen Seitenreload
oder einen Wechsel in andere Arbeitsbereiche hinweg gespeichert.

Lange Zuordnungsdialoge begrenzen ihre Höhe auf das Browserfenster. In der
Sammelzuordnung ist der Bereich **Ausgewählte Abholorte** mit Tab erreichbar;
Pfeiltasten sowie Bild auf/Bild ab scrollen die Zusammenfassung. Tourauswahl,
Abbrechen und Zuweisen bleiben über Tab erreichbar.
