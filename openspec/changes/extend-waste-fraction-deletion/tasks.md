## 1. Entwurf prüfen

- [x] 1.1 Schriftlichen Vorschlag fachlich prüfen und freigeben.
- [x] 1.2 Bestehende Vorschau-, Tourlösch-, Kalender- und Reminderpfade einschließlich konkurrierender Schreibpfade prüfen; XERJ-Referenzen und aktuellen Indexstand prüfen, sofern verfügbar.
- [x] 1.3 Vollständige Termin-Konfliktprüfung und Transaktionsgrenze im bestehenden Pfad konkretisieren; bei nicht erfüllbaren Invarianten vor Codeänderungen Entwurf korrigieren.

## 2. Bestehenden Waste-Pfad erweitern

- [x] 2.1 Typsichere Vorschau- und Mutationsverträge sowie serverseitige Validierung im bestehenden Fraktionspfad ergänzen; einfache und Mehrfachlöschung ohne implizite Kaskade erhalten.
- [x] 2.2 Tenantlokale Vorschau und atomare Ausführung der drei Varianten mit Bestandsbindung, Serialisierung, Rollback und vollständiger Kollisionsprüfung implementieren; sofort mit kleinsten Unit-/Type-Gates absichern.
- [x] 2.3 Bestehenden Einzellöschdialog mit bedingter Optionsanzeige, Zielauswahl, Auswirkungen, Mehrfraktionswarnung und Konfliktdetails erweitern; gemeinsame Controls und DE-/EN-Texte verwenden.
- [x] 2.4 Audit, Status, Sync und Behandlung betroffener Reminder über bestehende Mechanismen absichern.

## 3. Prüfen und dokumentieren

- [x] 3.1 Unit- und UI-Nachweise für Optionen, Ersetzung, Reihenfolge, Dubletten, Fehler, Fokus und Tastaturbedienung erbringen.
- [x] 3.2 PostgreSQL-Nachweise für Kaskaden, Datenerhalt, Rollback, veraltete Vorschauen, konkurrierende Änderungen und Tenant-Isolation erbringen.
- [x] 3.3 Termin-Konflikttests mit Wiederholungen, Verschiebungen, mehreren Abholorten und Kollisionen außerhalb eines kurzen Vorschaufensters ergänzen.
- [x] 3.4 Benutzerhilfe und arc42-Abschnitte 05/08 aktualisieren; bei nachgewiesen notwendiger Schemaänderung vorab Schema-Snapshot und Übersicht prüfen und beide fortschreiben.
- [x] 3.5 Umfangsgerechte Pflicht-Gates, Dateiplatzierung und OpenSpec-Validierung prüfen; hinzugefügte und entfernte Pfade auf unnötige Ausdehnung prüfen.

## Lokaler Nachweis (13.11.2026)

- PostgreSQL: 12 Integrationstests mit isoliertem lokalem PostgreSQL; Kaskaden, Rollback,
  Reminder-Stornierung, Dispatch-Sperre, neue Referenzen während paralleler Planung und
  Anwendungsrolle ohne direkte Schreibrechte auf `waste_tour_fractions` geprüft.
- Fachlogik: 7 gezielte Tests für Ersetzungsreihenfolge, bestehende Zielzuordnung,
  Kollisionen einschließlich Zwischenjahren, jahresübergreifenden Einzelverschiebungen und Einsätzen.
- HTTP/Runtime: 150 gezielte bestehende und neue Tests für Handler, Terminmaterialisierung
  und Mutation-Guards; zusätzlich 20 Tests der bestehenden Erinnerungsoperationen.
- Plugin: 53 Tests für API, Plugin-Vertrag und Löschdialog einschließlich Fokus-Rückgabe;
  zusätzlich 12 bestehende Tests für Fraktionstabelle und Mutationen. Der Server-Einstieg wurde
  ebenfalls im gezielten Lauf geprüft.
- Typprüfung: Waste-Runtime und Waste-Plugin erfolgreich. Lint der drei betroffenen Packages,
  Server-Runtime-Guard, Dateiplatzierung, OpenSpec-Validierung und `git diff --check` geprüft.
- Keine Schemaänderung und keine zusätzliche Dependency; bestehende Normalisierungs- und
  Sync-Pfade bleiben erhalten. Der Nachweis beschreibt die lokale Umsetzung vor PR-Erstellung; kein Deployment
  oder Live-Nachweis. Die lokale UI-Prüfung erfolgt über die echten Dialogkomponenten im DOM-Test.
