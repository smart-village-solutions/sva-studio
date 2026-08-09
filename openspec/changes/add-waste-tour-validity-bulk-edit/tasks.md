## 1. Spezifikation und Vertrag

- [x] 1.1 OpenSpec-Change strikt validieren und freigeben lassen.
- [x] 1.2 Bulk-Request/-Response-Typen sowie die explizite `unchanged`-/`set`-/`clear`-Semantik in Core und Plugin-API ergänzen.

## 2. Serverseitige Umsetzung

- [x] 2.1 Validierung und framework-agnostische Zusammenführungslogik für Gültigkeitszeiträume implementieren und testen.
- [x] 2.2 Transaktionale Repository-/Loader-Methode ergänzen, die ausschließlich `first_date` und `end_date` aller ausgewählten Touren atomar aktualisiert.
- [x] 2.3 Auth-Runtime-Endpunkt mit Instanzbindung, `waste-management.tours.manage`, CSRF, Fehlerabbildung und Bulk-Audit implementieren.
- [x] 2.4 API-, Loader- und Repository-Tests für Erfolg, Rollback, ungültige Zeiträume, nicht anwendbare oder fehlende Touren und unveränderte Fremdfelder ergänzen.
- [x] 2.5 Für serverseitig betroffene Packages `pnpm check:server-runtime` früh ausführen.

## 3. Studio-Oberfläche

- [x] 3.1 Aktion `Gültigkeitszeitraum ändern` in die bestehende Mehrfachauswahl integrieren.
- [x] 3.2 Barrierefreien Dialog mit expliziter Patch-Semantik, Zusammenfassung und Hinweis auf nicht anwendbare Touren umsetzen.
- [x] 3.3 Erfolgs-, Lade- und Fehlerverhalten einschließlich Reload und Auswahlbehandlung implementieren.
- [x] 3.4 Deutsche und englische Übersetzungen sowie fokussierte React-Tests ergänzen.

## 4. Verifikation und Dokumentation

- [x] 4.1 Waste-E2E für atomaren Bulk-Erfolg und abgelehnte ungültige Auswahl ergänzen.
- [x] 4.2 Betroffene Unit-, Type-, ESLint- und Server-Runtime-Gates nach jedem Änderungsblock ausführen.
- [x] 4.3 Affected-Scope vor einem breiten Lauf messen und anschließend den kleinsten relevanten PR-Gate-Pfad ausführen.
- [x] 4.4 Relevante Waste-Bedienungsdokumentation und die arc42-Runtime-Sicht aktualisieren.
