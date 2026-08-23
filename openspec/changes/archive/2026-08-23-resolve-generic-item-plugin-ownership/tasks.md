## 1. Plugin-Vertrag

- [x] 1.1 Content-Type-Metadaten für einen übernommenen Mainserver-`genericType` ergänzen und exportieren.
- [x] 1.2 Build-time-Validierung für leere und doppelte Diskriminatoren implementieren.
- [x] 1.3 FAQ, Kacheln und Projekte mit ihren bestehenden exakten Diskriminatoren registrieren.
- [x] 1.4 Registry- und Typ-Tests für gültige, unbekannte, case-abweichende und kollidierende Werte ergänzen.

## 2. Zentrale Klassifikation

- [x] 2.1 Framework-agnostischen Resolver aus dem Registry-Snapshot ableiten.
- [x] 2.2 Fest codierte GenericItem-Fachtyp-Zuordnungen in Host und Mainserver-Projektion durch den Resolver-Vertrag ersetzen.
- [x] 2.3 Slim- und Legacy-Adapter auf identische Klassifikationssemantik umstellen.
- [x] 2.4 Tests für registrierten Fachtyp, unbekannten Fallback und Adapterparität ergänzen.

## 3. Projektion und Autorisierung

- [x] 3.1 Vollständige und mutationsbezogene Refreshes auf genau eine Repräsentation je GenericItem umstellen.
- [x] 3.2 Reconciliation für vorhandene generische oder fachliche Geschwisterzeilen ergänzen.
- [x] 3.3 Typwechsel zwischen generisch, FAQ, Kachel und Projekt sowie Delete testen.
- [x] 3.4 Verifizieren, dass fehlende Fachrechte in `/admin/content` keinen generischen Fallback erzeugen.
- [x] 3.5 Verifizieren, dass das eigenständige Generic-Items-Modul mit `generic-items.*` weiterhin alle GenericItems anbietet.
- [x] 3.6 Gefilterte GenericItem-Pagination über Upstream-Seitengrenzen hinweg und den server-sicheren Registry-Aufbau verifizieren.

## 4. Dokumentation und Gates

- [x] 4.1 GenericItems-Betriebsvertrag und relevante arc42-Abschnitte 05, 06 und 08 aktualisieren; ADR-Bedarf für Abschnitt 09 prüfen.
- [x] 4.2 Betroffene Unit-, Type- und Server-Runtime-Gates nach jedem Änderungsblock ausführen.
- [x] 4.3 Affected-Scope messen und vor PR-Freigabe den kleinsten vollständigen PR-Gate-Pfad ausführen.
- [x] 4.4 OpenSpec strikt validieren und alle Aufgaben nach nachgewiesener Umsetzung abschließen.
