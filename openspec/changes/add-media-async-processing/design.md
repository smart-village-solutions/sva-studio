# Design: Asynchrone Medienverarbeitung

## Zielbild

Der Folge-Change löst teure oder fehleranfällige Bildverarbeitung aus dem synchronen Request-Pfad. Upload-Abschluss bestätigt nur Validierung, Annahme und die spätere Einplanung eines Verarbeitungsjobs; Varianten und nachgelagerte technische Prüfungen laufen später über die generische Studio-Job-Fähigkeit.

## Leitplanken

- Medien definieren keine eigene Job-Plattform neben der generischen Studio-Job-Fähigkeit
- Upload-, Asset- und Job-Status bleiben sauber getrennt und fail-closed nachvollziehbar
- `MediaReference` bleibt unmittelbar nach erfolgreicher Annahme stabil referenzierbar
- Delivery degradiert bis `ready` kontrolliert über Originalmedium oder Placeholder
- bestehende `MediaReference`-Verträge und Delivery-Pfade bleiben kompatibel

## Abhängigkeiten

- Die Umsetzung setzt die generische Studio-Job-Fähigkeit voraus, wie sie im Change `add-waste-management-plugin` als plattformweite Grundlage beschrieben ist.
- Solange diese Plattformfähigkeit nicht existiert, bleibt dieser Change bewusst auf fachliche Medienverträge und deren spätere Andockstelle beschränkt.

## Festgezogene Entscheidungen

- regulärer Produktpfad ist async-first, nicht Hybrid-Sync-für-kleine-Fälle
- angenommene Assets sind sofort referenzierbar, auch wenn Varianten noch laufen
- bis zur Fertigstellung darf Delivery kontrolliert auf Originalmedium oder Placeholder degradieren
- die erste Ausbaustufe zieht keine media-spezifische Auto-Retry-Logik vor

## Weiterhin offen

- konkrete technische Realisierung der späteren Job-Ausführung innerhalb der Plattform
- genaue Zuordnung, welche Delivery-Pfade Original-Fallback erlauben und welche Placeholder erzwingen
