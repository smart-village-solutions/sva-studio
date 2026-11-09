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

Im Dialog **Tour-Zuordnung bearbeiten** beziehen sich Suche, Orts-/Straßenfilter
und die bevorzugte Anzeige ausgewählter Abholorte auf die bearbeitete Tour.
Die Adresssortierung wird über die Steuerelemente für Region und Richtung
bedient; die Spaltenüberschriften dieses Dialogs sind keine Sortierschaltflächen.

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
