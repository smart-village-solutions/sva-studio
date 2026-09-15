## 1. Statusvertrag und Datenmigration

- [x] 1.1 Den geteilten Tourvertrag und Listenfilter auf `draft | published | archived` umstellen;
      alle regulären Erstellungswege verwenden `draft` als Default.
- [x] 1.2 Das tenantbezogene Waste-Schema um `status` mit Check-Constraint und Index erweitern und
      Bestandswerte deterministisch von `active` migrieren.
- [x] 1.3 Für den getrennten Studio-/Public-Waste-Rollout eine befristete, getestete
      `active`-Kompatibilität mit eindeutigem Konfliktverhalten bereitstellen.
- [x] 1.4 JSON-Import und -Export auf `status` umstellen, Legacy-`active` beim Lesen unterstützen und
      fehlende Statuswerte als `draft` behandeln.
- [x] 1.5 Schema- und Datenaustauschtests für Default, Backfill, alle drei Werte, ungültige Werte und
      Roundtrip ergänzen.

## 2. Atomare Servermutationen

- [x] 2.1 Einzelmutation und bestehenden Bulk-Statusvertrag auf einen expliziten Zielstatus statt
      Boolean/Toggle umstellen.
- [x] 2.2 Repository-Updates mit begrenzter ID-Menge, Sperr-, Existenz- und Anzahlprüfung in einer
      Waste-Datenbanktransaktion ausführen.
- [x] 2.3 Instanzkontext, `waste-management.tours.manage`, CSRF, Audit und Fehlerabbildung für Einzel-
      und Sammeländerung konsistent durchsetzen.
- [x] 2.4 Route, API-Client und Plugin-SDK-Vertrag anpassen und Vertrag, SQL, Rollback, Guards sowie
      Idempotenz fokussiert testen.

## 3. Tourenliste und Bedienoberfläche

- [x] 3.1 Statusfilter, Status-Badge und Einzeldialog mit `Entwurf`, `Veröffentlicht` und `Archiviert`
      umsetzen.
- [x] 3.2 Auswahl an Tour-IDs binden, über Filterwechsel erhalten und die vollständige gefilterte
      Ergebnismenge über Seitengrenzen hinweg auswählbar machen.
- [x] 3.3 Einzelne Abwahlen, Gesamt-/Außerhalb-Filter-Zähler und vollständiges Aufheben der Auswahl
      konsistent erhalten.
- [x] 3.4 Zugänglichen Bulk-Dialog mit Zielstatus, Anzahl, Bestätigung, Pending- und Fehlerzustand
      umsetzen; nach Erfolg Liste und Auswahl konsistent aktualisieren.
- [x] 3.5 Deutsche und englische UI- sowie Audit-Texte und fokussierte Komponenten-/E2E-Tests für
      Filter, Auswahl, alle Statusübergänge, Abbruch und Fehler ergänzen.

## 4. Operative Verbraucher

- [x] 4.1 Mainserver-Materialisierung und -Reconciliation so umstellen, dass ausschließlich
      `published` materialisiert und zuvor veröffentlichte Daten nach Statuswechsel entfernt werden.
- [x] 4.2 Public-Waste-Kalender, PDF/iCal und Reminderprojektionen auf ausschließlich `published`
      begrenzen.
- [x] 4.3 Abdeckungsprüfung und Folgejahr-Quellauswahl auf ausschließlich `published` umstellen;
      übernommene Zieltouren als `draft` anlegen.
- [x] 4.4 Für jeden Verbraucher Negativtests ergänzen, die sowohl `draft` als auch `archived`
      ausdrücklich von öffentlicher beziehungsweise operativer Ausgabe ausschließen.

## 5. Dokumentation, Rollout und Abschluss

- [x] 5.1 `docs/reference/waste-management-tour-gueltigkeit.md` und die betroffenen arc42-Abschnitte
      05, 06 und 08 um Statussemantik, Verbraucher und Migrationsablauf ergänzen.
- [ ] 5.2 Den Expand-/Migrate-Schritt ausführen und sowohl Studio als auch Public-Waste am exakten
      Stand mit allen drei Status verifizieren.
- [ ] 5.3 Nach nachgewiesener Verbraucherumstellung die befristete Synchronisierung, Spalte und den
      Index für `active` entfernen und den Contract-Zustand erneut verifizieren.
- [x] 5.4 Relevante Unit-/Type-Gates, `check:server-runtime`, Public-Waste-Integration/E2E,
      Dateiplatzierung und `openspec validate add-waste-tour-status-bulk-update --strict` ausführen.
- [ ] 5.5 Vor Abschluss prüfen, dass kein produktiver Tourpfad weiterhin `active` verwendet und kein
      permanenter paralleler Statuspfad verbleibt.
