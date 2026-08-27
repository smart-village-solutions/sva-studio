## 1. Entscheidung und Vertragsprüfung

- [x] 1.1 Bestehende Jobstart-, Kurzsicht-, Monitoring- und Detailpfade inventarisieren
- [x] 1.2 Waste-Import als Referenzjob festlegen; Cancel- und Ergebnisverträge bestätigen und manuellen Retry mangels Hostvertrag ausschließen
- [x] 1.3 Polling-, Invalidation- und Live-Region-Regeln festlegen: aktive Jobs pollen, Terminalstatus stoppt, nur Status- und Phasenwechsel werden angekündigt
- [x] 1.4 Change gemeinsam mit `standardize-destructive-action-feedback` freigeben lassen

## 2. Gemeinsame Darstellung und Referenzfluss

- [x] 2.1 Gemeinsame Jobstatus-, Progress-, Fehler- und Folgeaktionsprimitives in `@sva/studio-ui-react` implementieren
- [x] 2.2 Auslösenden Fachbereich mit Job-ID, initialem Status und Link zum dauerhaften Jobkontext migrieren
- [x] 2.3 Monitoring-Liste und Jobdetail auf konsistente Status-, Progress- und Terminaldarstellung prüfen und gezielt ergänzen
- [x] 2.4 Referenzjob ohne pluginlokale Toast-Kette oder zweiten fachlichen Statusautomaten migrieren

## 3. Tests, Dokumentation und Exit

- [x] 3.1 Tests für Start, Polling, Progress, Terminalstatus, Reload, Fehlerpersistenz, Retry, Cancel und Berechtigungen ergänzen
- [x] 3.2 Accessibility-Tests für gedrosselte Live-Region, Fokus und persistente Fehler ergänzen
- [x] 3.3 Plugin-Operations- und arc42-Dokumentation aktualisieren
- [x] 3.4 Kleinste relevante Unit-, Type-, ESLint-, Accessibility-, Runtime- und Plugin-UI-Boundary-Gates ausführen
- [x] 3.5 `openspec validate standardize-plugin-operation-feedback --strict` ausführen
