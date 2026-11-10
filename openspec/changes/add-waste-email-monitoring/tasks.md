## Umsetzung

- [x] Datenvertrag und bereinigte Repository-Projektion mit Tests ergänzen.
- [x] Instanzgebundenen Lese-Endpunkt mit eigenem Recht einbinden und absichern.
- [x] Plugin-Ansicht und Monitoring-Navigation mit Zustands-/Bedienungstests ergänzen.
- [x] Dokumentation, Architektur und gezielte Gates abschließen.

## Lokale Nachweise

- 33 gezielte Tests erfolgreich: Maskierung/Projektion und Handler (18), Plugin-Vertrag (7), Ansicht (4), Navigation (3), PostgreSQL (1).
- Typechecks für Waste-Runtime, Plugin und Studio-App erfolgreich; Runtime-Build und Node-Runtime-Smokecheck erfolgreich. Vor PR-Erstellung zusätzlich `pnpm check:server-runtime` für alle 20 Serverprojekte einschließlich ihrer Abhängigkeiten erfolgreich.
- Lint für Waste-Runtime und Plugin sowie gezielt die zwei Sidebar-Dateien erfolgreich.
- i18n-, Dateiplatzierungs-, Dokumentations-, Dokumentationskatalog- und OpenSpec-Prüfung erfolgreich. Plugin-UI-Grenzprüfung erfolgreich; Architekturprüfung meldet ausschließlich bestehende review-pflichtige Pfadsignale.
- PostgreSQL nutzt die echte Waste-Schemaerzeugung, prüft getrennte Schemas sowie SQL/DMY mit abweichender Zeitzone. Es wurden ausschließlich synthetische lokale Testdaten verwendet.

Keine produktive Aktivierung, Rollenvergabe, Browser-Sichtprüfung oder fachliche Live-Abnahme vorgenommen. Der Runtime-Smokecheck wurde nach Abschluss der Abhängigkeits-Builds separat erfolgreich ausgeführt, um konkurrierende lokale Dist-Synchronisationen zu vermeiden.
