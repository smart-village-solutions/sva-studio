## 1. Bestand und Vertrag

- [ ] 1.1 Alle aktiven Plugin-Contributions aus dem kanonischen Registry-Snapshot inventarisieren und als historienpflichtig, fachhistorienpflichtig oder nicht historienpflichtig klassifizieren.
- [ ] 1.2 Den host-owned History-Contract für Herkunft, Abdeckung, Actor, Aktion, Zeit, Zusammenfassung, stabile Feld-IDs und Statusübergänge typisieren.
- [ ] 1.3 Den gemeinsamen History-Read-Client und normalisierte Fehlerverträge im passenden Host-/SDK-Boundary bereitstellen.
- [ ] 1.4 Die Plugin-Registry um eine fail-closed History-Capability-Validierung mit stabilen Diagnosecodes erweitern.
- [ ] 1.5 Contract-Tests für gültige Contributions, fehlendes History-Binding und zulässige Nicht-History-Klassifikationen ergänzen.

## 2. Host-Runtime und Autorisierung

- [ ] 2.1 History-Lesezugriffe einheitlich über `content.readHistory`, Instance-Scope und Ownership-Scope autorisieren.
- [ ] 2.2 Lokale IAM-History-Einträge über den gemeinsamen Contract ausgeben, ohne `snapshot_json` offenzulegen.
- [ ] 2.3 Für Mainserver-Mutationen korrelierbare, idempotent finalisierbare Studio-History-Einträge erzeugen.
- [ ] 2.4 Erfolg, Providerfehler, Autorisierungsablehnung und Wiederholung so testen, dass nur erfolgreiche fachliche Änderungen in der sichtbaren Historie erscheinen.
- [ ] 2.5 Actor-Fallback, PII-Redaktion, Tenant-Isolation und gelöschte Accounts in Integrations- und Negativtests abdecken.

## 3. Vorhandene Plugins

- [ ] 3.1 `plugin-news` auf Herkunftskennzeichnung und den gemeinsamen History-Vertrag migrieren.
- [ ] 3.2 Platzhalter in `plugin-events` und `plugin-poi` durch die Studio-Mutationshistorie ersetzen.
- [ ] 3.3 Platzhalter in `plugin-generic-items` ersetzen und FAQ sowie Cockpit Cards auf denselben IAM-History-Pfad vereinheitlichen.
- [ ] 3.4 `plugin-surveys` gegen den gemeinsamen Vertrag migrieren und bestehende History-Tests angleichen.
- [ ] 3.5 `plugin-waste-management` gegen die gemeinsamen Rechte-, Scope-, Herkunfts-, Fehler- und Accessibility-Invarianten härten.
- [ ] 3.6 `plugin-categories`, `plugin-sdk` und alle weiteren nicht historienpflichtigen Contributions explizit klassifizieren und diese Entscheidung testen.

## 4. Gemeinsame UI und Qualität

- [ ] 4.1 Gemeinsame, lokalisierbare History-Primitiven für Lade-, Leer-, Fehler- und Erfolgszustände bereitstellen beziehungsweise bestehende Studio-UI-Mittel wiederverwenden.
- [ ] 4.2 Zeitpunkt, Aktion, Actor, Zusammenfassung, geänderte Felder, Herkunft und Abdeckungsgrenze konsistent und barrierefrei darstellen.
- [ ] 4.3 Sicherstellen, dass History-Panels schreibgeschützt bleiben und keine Editor-Speicheraktionen enthalten.
- [ ] 4.4 Pluginbezogene Unit-Tests sowie Host-/Runtime-Integrationstests nach jedem Änderungsblock ausführen.
- [ ] 4.5 Den betroffenen Scope messen und anschließend die relevanten Type-, ESLint-, Server-Runtime-, Coverage- und PR-Gates ausführen.

## 5. Zukunftssicherung und Dokumentation

- [ ] 5.1 Plugin-Authoring-Dokumentation und vorhandene Templates beziehungsweise Generatoren um den verbindlichen History-Vertrag ergänzen.
- [ ] 5.2 Einen blockierenden Test ergänzen, der neue historienpflichtige Content-Plugins ohne gültige History-Capability ablehnt.
- [ ] 5.3 `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md` und `docs/architecture/08-cross-cutting-concepts.md` um Ownership, Studio-only-Abdeckung und Audit-/History-Datenfluss ergänzen.
- [ ] 5.4 Relevante Content-, Plugin- und IAM-Entwicklerdokumentation auf Deutsch aktualisieren.
- [ ] 5.5 Falls Persistenzstruktur oder Constraints geändert werden, `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` synchron aktualisieren.
