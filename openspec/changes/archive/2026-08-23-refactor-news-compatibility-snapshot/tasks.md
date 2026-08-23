## 1. Characterization

- [x] 1.1 Gezielte Unit-Baseline und Types gegen den Altcode ausführen
- [x] 1.2 Alle Compatibility-Felder für Touched true/false/fehlend und passende/falsche Laufzeittypen charakterisieren
- [x] 1.3 Publication-, Mehrfachänderungs-, Referenz-/Clone-, Push- und Create/Edit-Konfliktfälle charakterisieren
- [x] 1.4 Neue Characterization mit unveränderter Altcode-Source grün bestätigen

## 2. Implementierung

- [x] 2.1 Gleichförmige String- und Boolean-Feldübernahmen intern typisiert gruppieren
- [x] 2.2 Publication-, Push-, Address- und ContentBlocks-Sonderfälle getrennt erhalten
- [x] 2.3 Vollständige Characterization nach dem Refactoring unverändert grün bestätigen

## 3. Dokumentation und Qualität

- [x] 3.1 arc42 Abschnitt 08 um den snapshotbasierten Compatibility-Vertrag ergänzen
- [x] 3.2 Studio-Changelog-Eintrag für die tatsächliche PR-Nummer ergänzen
- [x] 3.3 Unit, Types, Lint, Build, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check` grün ausführen
- [x] 3.4 Statischen und coveragegestützten New-only-Audit mit allen introduced Attributionen 0 ausführen
