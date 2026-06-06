## Kontext
Die bestehende Waste-PDF-Erzeugung lebt aktuell im administrativen Studio-Kontext. Parallel existiert bereits eine öffentliche Abfallkalender-App, die dieselben Waste-Daten lesend nutzt, aber PDF-Ausgaben nur als statische Links behandelt.

## Entscheidung
Die PDF-Erzeugung wird fachlich und technisch in die öffentliche App verlagert. Studio bleibt allein für statische PDF-Inhalte zuständig, die nicht aus den Waste-Fachdaten stammen.

## Datenmodell
Für die PDF-Legende wird an Waste-Fraktionen ein optionales Kürzel ergänzt. Dieses Feld ist migrationspflichtig und wird in der bestehenden `waste_*`-Tabellenfamilie eingeführt.

## Laufzeitmodell
Die öffentliche App erhält einen serverseitigen PDF-Endpunkt. Er verarbeitet:
- vollständig aufgelösten Standort
- gewähltes Exportjahr
- ausgewählte Fraktionen
- vererbte Termine über übergeordnete Abholorte

Die Ausgabe wird direkt als PDF-Response geliefert. Persistente Artefakte oder stabile PDF-URLs entfallen.

## Auswirkungen
- Studio entfernt die operative PDF-Erzeugung und bestehende Link-/Artefaktanzeigen.
- Der öffentliche Kalender ersetzt statische PDF-Links durch eine echte Exportaktion.
- Die gemeinsame PDF-Kernlogik bleibt in Workspace-Packages wiederverwendbar.
