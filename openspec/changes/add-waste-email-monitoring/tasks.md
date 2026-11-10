## Umsetzung

- [x] Datenvertrag und bereinigte Repository-Projektion mit Tests ergänzen.
- [x] Instanzgebundenen Lese-Endpunkt mit eigenem Recht einbinden und absichern.
- [x] Plugin-Ansicht und Monitoring-Navigation mit Zustands-/Bedienungstests ergänzen.
- [x] Dokumentation, Architektur und gezielte Gates abschließen.

## Lokale Nachweise

- Erste Umsetzung: 33 gezielte Tests erfolgreich: Maskierung/Projektion und Handler (18), Plugin-Vertrag (7), Ansicht (4), Navigation (3), PostgreSQL (1).
- Typechecks für Waste-Runtime, Plugin und Studio-App erfolgreich; Runtime-Build und Node-Runtime-Smokecheck erfolgreich. Vor PR-Erstellung zusätzlich `pnpm check:server-runtime` für alle 20 Serverprojekte einschließlich ihrer Abhängigkeiten erfolgreich.
- Lint für Waste-Runtime und Plugin sowie gezielt die zwei Sidebar-Dateien erfolgreich.
- i18n-, Dateiplatzierungs-, Dokumentations-, Dokumentationskatalog- und OpenSpec-Prüfung erfolgreich. Plugin-UI-Grenzprüfung erfolgreich; Architekturprüfung meldet ausschließlich bestehende review-pflichtige Pfadsignale.
- PostgreSQL nutzt die echte Waste-Schemaerzeugung, prüft getrennte Schemas sowie SQL/DMY mit abweichender Zeitzone. Es wurden ausschließlich synthetische lokale Testdaten verwendet.

Keine produktive Aktivierung, Rollenvergabe, Browser-Sichtprüfung oder fachliche Live-Abnahme vorgenommen. Der Runtime-Smokecheck wurde nach Abschluss der Abhängigkeits-Builds separat erfolgreich ausgeführt, um konkurrierende lokale Dist-Synchronisationen zu vermeiden.

## Review-Korrekturen

- [x] Tatsächlich gespeicherte Stornierungsgründe korrekt als Stornierung klassifizieren und testen.
- [x] Bestehenden Host-Bindings-Test auf 68 Handler und die konkrete neue Bindung aktualisieren.
- [x] Komponententests modulnah unter `src/` belassen und den ausschließenden `tests`-Filter der bestehenden Unit-/Coverage-Targets entfernen.
- [x] Seite entlang ihrer vorhandenen Spalten-, Tabellen- und Seitenlogik aufteilen; Complexity-Grenzen unverändert einhalten.
- [x] Tabellen beim Nachladen erhalten; Fokus gezielt in die Versanddetails beziehungsweise zurück in die Abo-Übersicht setzen. Erfolg, Fehler und Pagination mit verzögerten Antworten prüfen.

Gezielte Nachweise dieser Fixrunde: Repository-Test (11 Tests), Host-Bindings-Test (10 Tests), UI-Test (8 Tests), regulären Nx-Unit-Lauf und Testentdeckung anhand der bestehenden Vitest-Konfiguration, Plugin-Typecheck und unverändertes Complexity-Gate.

Die korrigierten Nx-Targets wurden zusätzlich über `nx show project` und den regulären Plugin-Unit-Lauf geprüft: 649 Tests in 110 Dateien erfolgreich, einschließlich aller acht Monitoring-UI-Tests. Plugin- und Skript-Typecheck sind grün.
