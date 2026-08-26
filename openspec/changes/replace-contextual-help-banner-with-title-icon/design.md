## Kontext

Die Shell rendert den kontextbezogenen Hilfeauslöser aktuell als flächiges Hinweisfeld vor dem eigentlichen Seiteninhalt. Die primären H1-Überschriften entstehen teils aus gemeinsamen Studio-Seitentemplates und teils aus individuellen Seitenkomponenten.

## Ziele / Nicht-Ziele

- Ziele:
  - Hilfe visuell zurückhaltend direkt an der primären Seitenüberschrift anbieten.
  - Das bestehende Overlay und seinen abgesicherten Laufzeitabruf unverändert weiterverwenden.
  - Eine mindestens 44 × 44 Pixel große, per Tastatur und assistiver Technologie bedienbare Trefferfläche erhalten.
- Nicht-Ziele:
  - Dokumentations-IDs, Katalog, Server-Fassade oder Markdown-Darstellung ändern.
  - Einen zweiten Hilfe-Einstieg oder zusätzliche sichtbare Erklärungstexte einführen.

## Entscheidungen

- Der Hilfeauslöser wird als Titel-Zusatz unmittelbar nach der H1 dargestellt, nicht als Bestandteil ihres zugänglichen Namens.
- Gemeinsame Seitentemplates konsumieren den Titel-Zusatz zentral. Individuelle H1-Varianten verwenden dieselbe Seitentitel-Primitve beziehungsweise denselben Titel-Zusatz.
- Der Auslöser verwendet den vorhandenen Fragezeichen-Kreis, den zugänglichen Namen „Hilfe öffnen“ und den bestehenden Fokus-Rückgabepfad.
- Der Overlay-Inhalt wird weiterhin erst nach dem Öffnen für die konkrete Dokumentations-ID geladen.

## Alternativen

- Automatische DOM-Injektion neben die erste H1: verworfen, weil sie React-Ownership und unterschiedliche Seitenkopfstrukturen fragil koppelt.
- Frei stehendes Icon oberhalb des Inhalts: verworfen, weil es nicht unmittelbar der H1 zugeordnet wäre.

## Risiken / Abwägungen

- Individuelle Seitenköpfe könnten den gemeinsamen Titel-Zusatz zunächst nicht konsumieren. Die Umsetzung erfasst deshalb alle dokumentierbaren Seitentypen mit Komponenten- und Browser-Tests.
- Das kleinere sichtbare Element ist weniger erklärend. Der etablierte Fragezeichen-Kreis und der zugängliche Name machen seine Funktion dennoch eindeutig.
