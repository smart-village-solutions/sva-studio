## 1. Characterization

- [x] 1.1 Bestehende App-Unit-Tests und Types gegen den Altcode ausführen
- [x] 1.2 Konfigurierte Statusseiten und vollständige DOI-Ergebnismatrix charakterisieren
- [x] 1.3 Abmeldetoken-Negativmatrix, Idempotenz, feste Zeit, Aufrufanzahl und Reihenfolge charakterisieren
- [x] 1.4 IP-vor-E-Mail-Rate-Limit und atomare Signup-Persistenz gegen den Altcode charakterisieren
- [x] 1.5 Neue Characterization nach dem Refactoring unverändert grün bestätigen

## 2. Implementierung

- [x] 2.1 DOI-Pfad in einen schmalen internen Handler extrahieren
- [x] 2.2 Abmeldepfad mit unveränderter Read-, Load-, Verify- und Mutationsreihenfolge extrahieren
- [x] 2.3 Öffentlichen Page-Handler auf Statusseiten- und Pfad-Orchestrierung begrenzen
- [x] 2.4 Signup-Rate-Limit, Pending-Wertaufbau und Persistenz ohne Reihenfolgeänderung trennen

## 3. Dokumentation und Qualität

- [x] 3.1 arc42 Abschnitt 08 um die fail-closed Reminder-Aktionsgrenze ergänzen
- [ ] 3.2 Studio-Changelog-Eintrag für die tatsächliche PR-Nummer ergänzen
- [ ] 3.3 Unit, Types, Lint, Build, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check` grün ausführen
- [ ] 3.4 Statischen und coveragegestützten New-only-Audit mit allen introduced Attributionen 0 ausführen
