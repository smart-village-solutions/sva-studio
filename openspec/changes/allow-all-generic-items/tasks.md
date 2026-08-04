## 1. GenericItem-Projektion

- [x] 1.1 Fachtyp-Ausschlüsse aus dem schlanken GenericItem-Projektionsadapter entfernen
- [x] 1.2 Fachtyp-Ausschlüsse aus dem Legacy-GenericItem-Projektionsadapter entfernen
- [x] 1.3 Positivtests für `FeaturedProject`, `FAQ`, `COCKPIT_CARD` und einen unbekannten `genericType` ergänzen
- [x] 1.4 Gemeinsame Projektion bei gleichzeitig sichtbarer generischer und fachlicher Repräsentation absichern

## 2. Berechtigungen und Mutationen

- [x] 2.1 Bestehende generische List-, Detail-, Update- und Delete-Tests auf fachlich spezialisierte GenericItems erweitern
- [x] 2.2 Nachweisen, dass generische Pfade ausschließlich `generic-items.*` prüfen
- [x] 2.3 Nachweisen, dass Fachpfade weiterhin ihre eigenen Actions und Diskriminatoren erzwingen

## 3. Dokumentation

- [x] 3.1 `docs/architecture/05-building-block-view.md` und `docs/architecture/package-gesamtuebersicht.md` um den technischen Vollzugriff ergänzen
- [x] 3.2 Projektions- und Berechtigungsverhalten in `docs/architecture/06-runtime-view.md` und `docs/architecture/08-cross-cutting-concepts.md` aktualisieren
- [x] 3.3 Betriebsgrenze und mögliche Mehrfachdarstellung in `docs/architecture/10-quality-requirements.md` dokumentieren
- [x] 3.4 Relevante Nutzer- oder Administrationsdokumentation für die restriktive Live-Rollenvergabe aktualisieren

## 4. Validierung

- [x] 4.1 Betroffene Unit-Tests über Nx ausführen
- [x] 4.2 Betroffene Type- und Server-Runtime-Gates ausführen
- [x] 4.3 `pnpm check:file-placement` ausführen
- [x] 4.4 `openspec validate allow-all-generic-items --strict` ausführen
