# Gültigkeitszeiträume von Waste-Touren bearbeiten

Der Bereich `Touren` im Waste-Management-Plugin erlaubt, den tourweiten Gültigkeitszeitraum mehrerer Touren gemeinsam zu ändern. Der Zeitraum besteht aus `Gültig ab` und `Gültig bis` und beeinflusst den wiederkehrenden Turnus der Tour. Einzelne Abholtermine und Terminverschiebungen bleiben unverändert. Abholort-Zuordnungen besitzen keinen eigenen Gültigkeitszeitraum und übernehmen immer den Zeitraum ihrer Tour.

## Mehrere Touren bearbeiten

1. Wählen Sie in der Tourentabelle die gewünschten Touren aus.
2. Öffnen Sie `Gültigkeitszeitraum ändern`.
3. Legen Sie fest, ob `Gültig ab` unverändert bleiben oder durch ein neues Datum ersetzt werden soll. `Gültig bis` kann zusätzlich entfernt werden.
4. Prüfen Sie die Zusammenfassung und bestätigen Sie mit `Zeitraum ändern`.

Die Änderung wird für die gesamte Auswahl atomar gespeichert. Ist eine Tour nicht mehr vorhanden, nicht geeignet oder würde bei mindestens einer Tour ein Enddatum vor dem Startdatum entstehen, wird keine der ausgewählten Touren geändert. Der Dialog nennt bei einem Datumskonflikt jede betroffene Tour mit dem resultierenden Beginn und Ende.

## Unterstützte Touren

Die Mehrfachbearbeitung gilt für feste Wiederholungen wie wöchentlich, zweiwöchentlich, vierwöchentlich und jährlich sowie für Touren mit einem benutzerdefinierten Wiederholungsabstand. Individuelle Touren und bedarfsabhängige Touren besitzen keinen turnusbasierten Gültigkeitszeitraum. Der Dialog nennt solche Touren und blockiert das Speichern, bis sie aus der Auswahl entfernt wurden.

`Gültig ab` ist zugleich der Startanker für die Berechnung wiederkehrender Termine und kann deshalb nicht entfernt werden. Soll eine Tour vorübergehend keine Termine liefern, deaktivieren Sie stattdessen die Tour.

## Verschiebungen nachvollziehen

Die Spalte `Verschiebungen` der Tourentabelle zählt tourspezifische und globale Verschiebungen sowie tatsächlich berechnete Feiertagsverschiebungen. Ist mindestens eine Verschiebung vorhanden, öffnet der Zähler eine Detailansicht mit ursprünglichem und neuem Datum, Quelle und vorhandenem Grund. Zähler und Detailansicht basieren auf derselben chronologisch sortierten Datenmenge.
