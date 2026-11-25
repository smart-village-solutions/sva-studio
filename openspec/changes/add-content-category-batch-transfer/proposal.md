# Kategorienfilter und Inhaberwechsel für mehrere Inhalte

## Anlass

Redakteure sollen Inhalte einer Kategorie in der Studio-Inhaltsübersicht finden und mehrere davon gemeinsam an einen Account oder eine Organisation übergeben können. Die Übersicht paginiert serverseitig. Die vorhandene Tabellenauswahl deckt die geladenen Zeilen ab. Der Einzeltransfer im Editor besitzt bereits Regeln für Autorisierung, Zielsuche, Mainserver-Mutation und Abgleich.

## Bedienung

1. Ein durchsuchbarer Kategorienfilter ergänzt die bestehende Inhaltsübersicht. Die Kategorie wird mit den übrigen Filtern kombiniert. Die erste Seite öffnet sich, wenn sich der Filter ändert.
2. Die Checkboxen erlauben eine individuelle Auswahl über mehrere Seiten. Eine gesonderte Aktion wählt alle Treffer der aktuellen Filter aus. Einzelne Treffer lassen sich ausschließen. Die Auswahl zeigt ihren Umfang an und wird bei einer Änderung der Filter zurückgesetzt.
3. Über **Inhalte übertragen** öffnet sich der Bestätigungsdialog. Er zeigt die festgeschriebene Anzahl und verwendet die bestehende Zielsuche für Accounts und Organisationen. Beim Bestätigen werden genau die angezeigte Auswahl und das gewählte Ziel verbindlich.
4. Die Ergebnisansicht zeigt den Status pro Inhalt, einschließlich Teilfehlern und noch offenen Abgleichen. Wenn der Inhaberwechsel den Zugriff entzieht, bleibt die Rückmeldung anhand der zuvor sichtbaren Auswahl verständlich.

## Datenfluss und Grenzen

- **Kategorien und Listen.** Die bestehende Listenabfrage filtert vor der Pagination anhand der tatsächlich zugeordneten Kategorien. Studio verwendet die stabilen Kategorie-IDs der Quelle und berücksichtigt deren Geltungsbereich. Wo ein Quellvertrag nur Namen liefert, ist eine eindeutige, zum Inhaltstyp und zur Instanz passende Zuordnung erforderlich. Gleichnamige oder nicht auflösbare Kategorien dürfen keine falschen Treffer erzeugen. Die erste Version filtert nach direkt zugeordneten Kategorien. Unterkategorien werden separat ausgewählt.
- **Auswahl.** Die Listenautorisierung gilt auch beim seitenübergreifenden Auflösen der Treffer. Studio friert die konkreten Inhaltsreferenzen für die Bestätigung ein. Ein unvollständiger Listenstand erlaubt die individuelle Auswahl sichtbarer Einträge. Die Aktion für alle Treffer ist verfügbar, sobald die Liste die Gesamtmenge zuverlässig bestimmen kann. Mehrere sichtbare Repräsentationen desselben Mainserver-Datensatzes zählen als ein Transfer. Beim Auflösen bleiben die für die jeweilige Repräsentation geltenden Rechte maßgeblich.
- **Transfer.** Vor jedem Schreibzugriff prüft der bestehende Einzeltransfer den aktuellen Inhalt, dessen Sichtbarkeit, `content.transferOwnership`, den Inhaber und das Ziel in derselben Instanz. Die Typmatrix des Einzeltransfers gilt auch hier. Ein zwischen Prüfung und Mutation geänderter Mainserver-Inhaber führt über den bestehenden erwarteten Quellinhaber zum Konflikt. Nur die dedizierte Inhabermutation darf den Mainserver-Inhaber ändern.
- **Teilerfolg und Abbruch.** Jeder bestätigte Einzeltransfer wirkt unabhängig. Die Ausführung ist begrenzt und verwendet stabile Schlüssel je Inhalt und bestätigtem Auftrag. Bei Unterbrechungen muss Studio den Stand anhand der vorhandenen Transfer- und Abgleichinformationen für die bestätigte Auswahl wieder ermitteln können. Ein unklarer Ausgang bleibt im Abgleich. Ein Wiederanlauf darf bestätigte Transfers nicht erneut auslösen. Eine sichere Wiederholung setzt einen belegten Einzelzustand voraus.
- **Umfang.** Die Arbeit betrifft die Studio-Inhaltsübersicht, ihre autorisierte Listenabfrage, die vorhandene Zielauswahl und den bestehenden Transferpfad. Die Kategorienverwaltung, Zuordnung von Kategorien im Editor und Mainserver-Mutation bleiben außerhalb des Lieferumfangs. Sollte der Abgleich für einen wiederaufnehmbaren Batch zusätzliche Speicherung erfordern, wird der konkrete Bedarf im vorhandenen Datenpfad vor der Implementierung belegt.

## Nachweis

Zuerst wird der Listenfilter mit autorisierten und paginierten Trefferlisten geprüft. Darauf baut die Transferaktion mit Tests für Auswahl und Ausschlüsse, parallele Änderungen, doppelte Repräsentationen, Mandantengrenzen, Berechtigungsverlust, Teilerfolg und unterbrochene Ausführung auf. Ein Test über Studio und den Mainserver-Transferadapter weist nach, dass der Batch nur den Inhaber ändert und verknüpfte Inhaltsdaten und IDs erhält.
