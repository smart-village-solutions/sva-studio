## 1. Gemeinsamen Editor absichern

- [x] 1.1 Echten TipTap-Regressionstest für markierten Linktext und Überschriftenformatierung ergänzen
- [x] 1.2 HTML-/WYSIWYG-Moduswechsel mit gemeinsamem kontrolliertem Wert implementieren
- [x] 1.3 Normalisierung beim Wechsel zurück in WYSIWYG sowie Accessibility-Zustände testen

## 2. Produktive Verwendungen migrieren und prüfen

- [x] 2.1 News-Browser-Repro für Link und Überschrift ergänzen und nur einen belegten Integrationsfehler korrigieren
- [x] 2.2 Rechtstext-Anlage und -Bearbeitung auf `RichTextHtmlEditor` umstellen
- [x] 2.3 Rechtstext-Sanitizing, Read-only-Verhalten und Übersetzungen anpassen
- [x] 2.4 Nicht mehr verwendeten lokalen `RichTextEditor` entfernen

## 3. Qualitätsnachweise

- [x] 3.1 Gezielte Komponenten-, Integrations- und Browser-Tests für `studio-ui-react`, News und Rechtstexte ausführen
- [x] 3.2 Betroffene Type- und Lint-Gates über Nx ausführen
- [x] 3.3 Relevante Nutzerdokumentation zum Moduswechsel aktualisieren
- [x] 3.4 `openspec validate improve-rich-text-editor-modes --strict` und `openspec show improve-rich-text-editor-modes` erfolgreich ausführen
