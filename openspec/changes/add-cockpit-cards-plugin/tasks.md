## 1. Vertrag und Host-Anbindung

- [x] 1.1 `cockpit-cards.cockpit-card`, Admin-Ressource, Plugin-Registry und ausgeblendete direkte Navigation registrieren.
- [x] 1.2 Modul-IAM und Instanz-Bootstrap für die vier namespaceten Cockpit-Cards-Actions ergänzen.
- [x] 1.3 Host-Fassade und GenericItem-Routen mit `COCKPIT_CARD`-Abgrenzung, Autorisierung und CRUD ergänzen.
- [x] 1.4 Vollständiges Upstream-Paging, Filterung, Sortierung, lokale Pagination und Projektion ohne Doppelanzeige implementieren.

## 2. Fachplugin

- [x] 2.1 `@sva/plugin-cockpit-cards` mit Manifest, Nx-Konfiguration, Übersetzungen und öffentlichem API-Vertrag erstellen.
- [x] 2.2 Fachmodell, Mapper und Validierung für Überschrift, Nur-Text, Sprache, genau eine bestehende Kategorie, mindestens ein Bild, höchstens einen HTTPS-Link und Publikationsmetadaten implementieren.
- [x] 2.3 Liste sowie Create-/Edit-Seiten mit den Tabs `Basis`, `Inhalt`, `Einstellungen` und `Historie` umsetzen; Text und Bilder gemeinsam im Tab `Inhalt` platzieren.
- [x] 2.4 Vorhandene Kategorienauswahl, Medienbibliothek und Bild-Upload wiederverwenden und zugängliche Lade-, Fehler- und Leerzustände bereitstellen.

## 3. Qualität und Dokumentation

- [x] 3.1 Unit-, Komponenten- und Host-Tests für Fachvertrag, UI, IAM, Typabgrenzung, Projektion, Paging und CRUD ergänzen.
- [ ] 3.2 Einen E2E-Test für CRUD mit Kategorie, mehreren Bildern und Link ergänzen.
- [x] 3.3 Nach jedem Block die kleinsten relevanten Nx-Unit- und Type-Gates sowie bei Serveränderungen früh `pnpm check:server-runtime` ausführen.
- [x] 3.4 Relevante deutsche Fach- und arc42-Dokumentation aktualisieren und `pnpm check:file-placement` ausführen.
- [x] 3.5 `openspec validate add-cockpit-cards-plugin --strict` ausführen.
- [ ] 3.6 Vor PR-Freigabe nach Möglichkeit `pnpm test:pr` ausführen.
