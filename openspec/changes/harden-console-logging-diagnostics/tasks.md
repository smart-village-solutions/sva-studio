## 1. Ausgangslage und sichere Änderungsgrenzen

- [x] 1.1 Die produktive Ausgangsstichprobe mit Zeitraum, Gesamtmenge, Level-Verteilung, Request-Korrelationsquote, Top-Messages und bekannten Doppellogs in `docs/reports/` dokumentieren, ohne sensible Beispielwerte zu übernehmen
- [x] 1.2 Alle betroffenen Log-Aufrufer nach Ereignis, verantwortlicher Grenze, aktuellem Level, Ziel-Level und erlaubten Kontextfeldern inventarisieren und gegen die im Design festgelegte Ownership-Matrix prüfen; neue Boundary-Entscheidungen vor der ersten Produktionscode-Änderung im Design nachführen
- [x] 1.3 Den finalen Stand von `refactor-iam-content-list-projection` integrieren oder den Change vor Änderungen am Projection-Worker darauf aktualisieren
- [x] 1.4 Den finalen beziehungsweise aktuellen Stand von `refactor-cross-cutting-runtime-guardrails` integrieren, Transport- und Dokumentationsüberschneidungen auflösen und dessen normativen OTEL-Zielvertrag unverändert erhalten

## 2. Durchgängiger Request-Kontext

- [x] 2.1 Reproduktionstests ergänzen, die fehlenden Kontext in Sonder-, Auth-, Mainserver- und regulären Dispatchern sowie Isolation paralleler Requests zeigen
- [x] 2.2 Lebensdauertests ergänzen, die nach der Response weiterlaufende Arbeit sowie Worker-Bootstrap außerhalb beziehungsweise explizit losgelöst vom HTTP-Kontext absichern
- [x] 2.3 Die Request-Kontext-Grenze im Server-Einstieg vor alle fachlichen Dispatcher ziehen, von OTEL-/Diagnose-Schaltern entkoppeln und unabhängige Hintergrundarbeit außerhalb dieser Grenze halten
- [x] 2.4 Eine gültige eingehende Request-ID übernehmen oder eine sichere lokale Request-ID erzeugen, ihre rein diagnostische Semantik festhalten und die bestehende Response-Propagation absichern
- [x] 2.5 Trace-IDs ausschließlich aus einem gültigen eingehenden oder aktiven Tracing-Kontext übernehmen und ohne echten Trace-Kontext keine Trace-ID erzeugen
- [x] 2.6 Fokussierte Unit- und Type-Tests für `server-runtime` und `sva-studio-react` ausführen; bei serverseitigen Package-Änderungen früh `pnpm check:server-runtime` ausführen

## 3. Redaction und sichere Kontextfelder

- [x] 3.1 Schlüssel-Normalisierung und Alias-Redaction für Account-, Actor-, Subject-, User-, Session- und Credential-Identitäten mit Canary-Tests ergänzen
- [x] 3.2 Sichere Route-/Pfadmetadaten ohne Query-String zentralisieren oder bestehende Plattformmittel dafür verwenden
- [x] 3.3 Auth-Logs von vollständigen URLs und freien Provider-Fehlerbeschreibungen auf stabile Codes, Status und Retry-Klassen umstellen
- [x] 3.4 Identitätshaltige Verbundfelder wie `projection_scope_key` durch getrennte zulässige beziehungsweise redigierte Felder ersetzen
- [x] 3.5 Request-, Trace-, Job- und Execution-IDs als Log-Body-Felder erhalten und ihren Ausschluss aus frei skalierenden Loki-/OTEL-Labels vertraglich testen
- [x] 3.6 Fokussierte Tests für verschachtelte Metadaten, Alias-Schreibweisen, URL-Queries, Verbundwerte und weiterhin zulässige technische IDs ausführen

## 4. Fehlerownership und Schweregrade

- [x] 4.1 Den effektiven Server-Log-Schwellwert zentralisieren und einen expliziten Development-Diagnosemodus für tatsächlich sichtbare `debug`-Ereignisse ergänzen; Production bleibt standardmäßig bei mindestens `info`
- [x] 4.2 Auth-Konfigurations- und Tenant-Auflösungsfehler auf genau ein kanonisches Ereignis an der verantwortlichen Routengrenze umstellen
- [x] 4.3 Mainserver-Routen so klassifizieren, dass unerwartete interne beziehungsweise 5xx-Ergebnisse `error` und erwartbare Ablehnungen höchstens `warn` sind
- [x] 4.4 Routinemäßige GraphQL-Leseerfolge, Cache-Treffer, Pagination-, Konfigurations- und Health-Ereignisse von `info` auf `debug` verschieben oder als Einzelereignis entfernen
- [x] 4.5 Fachlich relevante Mutation-, administrative Sicherheits- und Jobabschlussereignisse als strukturierte `info`-Signale erhalten
- [x] 4.6 Begrenzte Retry-, Circuit-Breaker-, Recovery- und Sekundärereignisse über eigene stabile Event-Codes von kanonischen Endereignissen unterscheidbar halten
- [x] 4.7 Logger-Vertragstests für genau ein kanonisches Endereignis je Operation, stabilem Fehlercode und Ergebnis sowie tabellarische Level- und Schwellwerttests ergänzen

## 5. Worker-Nebendiagnostik

- [x] 5.1 Fehlgeschlagene Abbruchabfragen mit Execution-Korrelation, stabilem Fehlercode und begrenzter Wiederholung sichtbar machen
- [x] 5.2 Fehler beim Persistieren eines Job- oder Provisioning-Fehlerzustands als sekundäres Ereignis protokollieren
- [x] 5.3 Sicherstellen, dass neue Nebendiagnostik weder Retry-, Abbruch-, Lease- noch Zustandsübergangsverträge verändert
- [x] 5.4 Worker-Tests für Fehler, Deduplizierung beziehungsweise Begrenzung, Recovery und unveränderten Hauptkontrollfluss ergänzen

## 6. Dokumentation und Validierung

- [x] 6.1 `docs/architecture/06-runtime-view.md`, `08-cross-cutting-concepts.md`, `10-quality-requirements.md` und `docs/architecture/logging-architecture.md` auf verpflichtende Request-ID, optionale echte Trace-ID, Background-Detachment, zentralen Debug-Schwellwert und transportneutralen Diagnosevertrag aktualisieren, ohne den OTEL-Zielvertrag umzudefinieren
- [ ] 6.2 Einen deutschen Changelog-Eintrag unter `docs/changelog/entries/` ergänzen und OTEL sowie Browser-Tracking ausdrücklich als separate Folgearbeit kennzeichnen
- [x] 6.3 Vor breiten lokalen Runs den affected Unit-Scope mit `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main` messen
- [x] 6.4 Nach jedem Änderungsblock die kleinsten relevanten Nx-Unit-/Type-Gates und `pnpm check:server-runtime` ausführen; auf bekannt rotem Teststand nicht weiterimplementieren
- [x] 6.5 Abschließend `pnpm check:file-placement`, `openspec validate harden-console-logging-diagnostics --strict` und `git diff --check` ausführen
- [x] 6.6 Vor dem initialen Push des vollständigen cross-cutting Scopes bevorzugt `pnpm test:pr` ausführen oder ausgelassene breite Gates transparent dokumentieren
- [ ] 6.7 Nach dem Rollout dieselbe Abfrageklasse wie in der Ausgangsstichprobe gegen den tatsächlich aktiven Transport auswerten und belegen, dass alle inventarisierten HTTP-Ereignisse eine Request-ID besitzen, vorhandene Trace-IDs valide sind, repräsentative Fehlerketten genau ein kanonisches Endereignis erzeugen, inventarisierte Hochvolumen-Erfolge nicht auf `info` erscheinen und Mutation-, Audit- sowie Jobabschlussereignisse erhalten bleiben
- [ ] 6.8 Die Canary-Redactionstests als primären Leck-Nachweis auswerten und die Laufzeitprüfung auf bekannte verbotene Feldformen begrenzen, ohne sensible Rohwerte zu exportieren
- [ ] 6.9 Bei fehlender Request-Korrelation, verlorenen kanonischen Ereignissen oder unredigierten sensiblen Werten den betroffenen Delivery-Slice zurückrollen und die nachfolgenden Slices stoppen
