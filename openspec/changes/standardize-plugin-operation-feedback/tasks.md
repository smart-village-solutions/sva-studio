## 1. Entscheidung und Vertragsprüfung

- [ ] 1.1 Bestehende Jobstart-, Kurzsicht-, Monitoring- und Detailpfade inventarisieren
- [ ] 1.2 Referenzjob sowie Start-, Retry-, Cancel-, Ergebnis- und Berechtigungsverträge bestätigen
- [ ] 1.3 Polling-, Invalidation- und Live-Region-Regeln festlegen
- [ ] 1.4 Change vor Implementierung separat freigeben lassen

## 2. Gemeinsame Darstellung und Referenzfluss

- [ ] 2.1 Gemeinsame Jobstatus-, Progress-, Fehler- und Folgeaktionsprimitives in `@sva/studio-ui-react` implementieren
- [ ] 2.2 Auslösenden Fachbereich mit Job-ID, initialem Status und Link zum dauerhaften Jobkontext migrieren
- [ ] 2.3 Monitoring-Liste und Jobdetail auf konsistente Status-, Progress- und Terminaldarstellung prüfen und gezielt ergänzen
- [ ] 2.4 Referenzjob ohne pluginlokale Toast-Kette oder zweiten fachlichen Statusautomaten migrieren

## 3. Tests, Dokumentation und Exit

- [ ] 3.1 Tests für Start, Polling, Progress, Terminalstatus, Reload, Fehlerpersistenz, Retry, Cancel und Berechtigungen ergänzen
- [ ] 3.2 Accessibility-Tests für gedrosselte Live-Region, Fokus und persistente Fehler ergänzen
- [ ] 3.3 Plugin-Operations- und arc42-Dokumentation aktualisieren
- [ ] 3.4 Kleinste relevante Unit-, Type-, ESLint-, Accessibility-, Runtime- und Plugin-UI-Boundary-Gates ausführen
- [ ] 3.5 `openspec validate standardize-plugin-operation-feedback --strict` ausführen
