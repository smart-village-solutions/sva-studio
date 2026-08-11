## Context

`waste_location_tour_links` verbindet eine Tour mit ihren Abholorten. Die Tour besitzt mit `first_date` und `end_date` bereits ihren zentralen Gültigkeitszeitraum. Die Zuordnung enthält derzeit zusätzlich nullable Spalten `start_date` und `end_date`, die die Terminmaterialisierung pro Abholort weiter einschränken können. Dieses abweichende Verhalten ist fachlich nicht mehr zulässig.

Der Zuordnungsdialog gruppiert ausgewählte Einträge bereits vor nicht ausgewählten Einträgen. Innerhalb beider Gruppen bleibt jedoch die vom Repository gelieferte Reihenfolge erhalten, die nach Erstellungszeitpunkt und ID bestimmt wird.

## Goals / Non-Goals

- Goals:
  - eine einzige Gültigkeitsquelle je Tour,
  - Entfernung des ortsspezifischen Zeitfensters aus allen aktiven Verträgen und Persistenzpfaden,
  - deterministische, fachliche Sortierung des Zuordnungsdialogs,
  - Erhalt der bestehenden Auswahl-, Filter- und Mehrfachzuordnungsfunktionen.
- Non-Goals:
  - Änderung der Tourfelder `firstDate` und `endDate`,
  - Änderung expliziter Tour-Einsätze oder datumsspezifischer Abholort-Zuordnungen,
  - frei konfigurierbare Sortierregeln oder neue Tabellendarstellung.

## Decisions

### Gültigkeit liegt ausschließlich an der Tour

Die Link-Spalten und zugehörigen API-Felder werden vollständig entfernt. Ein bloßes Ausblenden in der Oberfläche genügt nicht, weil bestehende Werte sonst weiterhin die Terminmaterialisierung beeinflussen könnten.

### Vorhandene Link-Zeiträume werden nicht in Tour-Zeiträume überführt

Vorhandene Werte werden ersatzlos verworfen. Eine Zusammenführung mehrerer abweichender Link-Zeiträume zu einem Tour-Zeitraum wäre fachlich nicht eindeutig und könnte den Zeitraum anderer Abholorte verändern. Die bereits an der Tour gespeicherten Werte bleiben unverändert maßgeblich.

### Feste Mehrfachsortierung statt interaktiver Tabellensortierung

Die Auswahlliste verwendet folgende aufsteigende Sortierschlüssel:

1. ausgewählt vor nicht ausgewählt,
2. Region, sofern vorhanden,
3. Ort,
4. Straße,
5. Bezeichnung und ID als stabile Tie-Breaker.

Für Textwerte wird eine deutschsprachige, numerisch vergleichende Sortierung verwendet. Dadurch bleiben beispielsweise Hausnummernanteile in Bezeichnungen nachvollziehbar geordnet. Die Sortierung wird nach dem Filtern angewendet und verändert den Auswahlzustand nicht.

## Risks / Trade-offs

- Ortsspezifische Zeitgrenzen gehen bewusst verloren. Die Migration entfernt nur diese beiden Felder und lässt Touren sowie Zuordnungen unverändert bestehen.
- Externe Aufrufer, die die Link-Datumsfelder noch senden, müssen auf den neuen Vertrag umgestellt werden. Runtime-Validierung und Typen werden gemeinsam angepasst, damit kein stiller Teilvertrag bestehen bleibt.
- Die Sortierung kann die bisher gewohnte Erstellungsreihenfolge verändern. Das ist beabsichtigt und wird mit Unit- und UI-Tests abgesichert.

## Migration Plan

1. Aktive Verträge, Mapper und Schreibpfade auf `id`, `locationId` und `tourId` reduzieren.
2. Runtime-Schema so aktualisieren, dass neue Tabellen keine Link-Datumsspalten enthalten und vorhandene Tabellen beide Spalten idempotent entfernen.
3. Materialisierung, Import, Duplizierung und Dokumentation von den entfernten Feldern bereinigen.
4. Sortierlogik und Dialogtests ergänzen.
5. Relevante Unit-, Typ- und Server-Runtime-Gates ausführen.

Rollback würde die nullable Spalten und Vertragsfelder erneut einführen. Die früheren ortsspezifischen Werte sind nach der Migration nicht rekonstruierbar; dies entspricht der bestätigten fachlichen Entscheidung.

## Open Questions

Keine.
