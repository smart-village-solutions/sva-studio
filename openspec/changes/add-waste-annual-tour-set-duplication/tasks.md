## 1. Fachliche Kernlogik

- [x] 1.1 Frameworkunabhängige Typen für Quelljahr, abgeleitetes Folgejahr, Tourklassifikation, Vorschau-Fingerprint, Ersatzdaten, Konflikte und Ergebnis ergänzen
- [x] 1.2 Quelleingabe auf aktuelles oder vorheriges Jahr begrenzen und `targetYear = sourceYear + 1` ausschließlich serverseitig ableiten und testen
- [x] 1.3 Quelltouren testgetrieben als `wird übernommen`, `gilt bereits im Folgejahr` oder `blockiert` klassifizieren
- [x] 1.4 Unterbrechungsfreie Taktfortführung für 7-/14-/28-Tage- und Abstandspreset-Touren testgetrieben implementieren
- [x] 1.5 Feste Folgejahrabbildung für jährliche und konkrete Termine einschließlich Jahresgrenzen, Schalttag, Kollisionen und pro Quellressource erfasster Ersatzdaten implementieren und testen
- [x] 1.6 Kanonischen Vorschau-Fingerprint aus allen kopierrelevanten fachlichen Daten und Änderungsständen implementieren und testen
- [x] 1.7 Stabile Ziel-Tour- und Beziehungs-IDs sowie mögliche fachliche Konflikte ohne Namensvergleich implementieren und testen

## 2. Server und Persistenz

- [x] 2.1 Read-only Vorschauoperation mit Mandanten-, Eingabe- und beiden Berechtigungsprüfungen ergänzen
- [x] 2.2 Freigegebene Grenzwerte von 1.000 Touren und 100.000 kopierrelevanten Beziehungen zentral dokumentieren und in Vorschau sowie Erstellung identisch durchsetzen
- [x] 2.3 Repository-Transaktionsgrenze mit mandanten- und folgejahrbezogenem Advisory Lock für die atomare inaktive Tourensatz-Erstellung ergänzen
- [x] 2.4 Quellbestand, Fingerprint und Konflikte innerhalb der gesperrten Transaktion unmittelbar vor dem Schreiben erneut prüfen
- [x] 2.5 Vollständigen Übernahmevertrag für Touren, Abholorte, konkrete Termine, Einsätze und tourbezogene Verschiebungen innerhalb derselben Transaktion umsetzen
- [x] 2.6 Zentralen Request-Idempotenzvertrag mit gespeicherter Antwort und Recovery über stabile Ziel-IDs für Commit-/Response-Abbrüche umsetzen und testen
- [x] 2.7 Zusammenfassendes, datensparsames Audit-Ereignis für die bestätigte Erstellung ergänzen
- [x] 2.8 `preview_stale`, `target_identity_conflict`, `batch_limit_exceeded`, neue fachliche Konflikte und vollständigen Rollback durch Repository- und Integrationstests absichern

## 3. Assistent und Tourenliste

- [x] 3.1 Mehrstufigen Assistenten mit Quelljahr und unveränderlich angezeigtem Folgejahr auf vorhandenen Studio-UI-Primitiven aufbauen
- [x] 3.2 Vorschau mit konkreten Mengen, `Quelle → Folgejahr`-Beispielen und den Gruppen `wird übernommen`, `gilt bereits im Folgejahr` und `blockiert` umsetzen
- [x] 3.3 Auswahl übernehmbarer Touren, ausdrückliche Kenntnisnahme möglicher Konflikte und zugängliche Ersatzdatumseingaben umsetzen
- [x] 3.4 Inaktive atomare Erstellung mit eindeutiger Bestätigung, Ergebnislink zur gefilterten Tourenliste und stabiler Fehler-/Fokusführung anbinden
- [x] 3.5 Deutsche und englische Übersetzungen mit verständlichen Auswirkungstexten ohne interne Fachbegriffe ergänzen
- [x] 3.6 Tastaturbedienung, Screenreader-Beschriftung, nicht-farbliche Statusdarstellung und Fokusführung automatisiert sowie manuell prüfen

## 4. Qualität und Dokumentation

- [x] 4.1 Unit-, Typ-, Server-Runtime-, PostgreSQL-Integrations- und fokussierte E2E-Gates für die betroffenen Projekte ausführen
- [x] 4.2 Waste-Management-Anleitung um Folgejahrübernahme, Tourklassifikation, Datumsregeln, Konflikte und inaktive Nachbearbeitung ergänzen
- [x] 4.3 `docs/architecture/05-building-block-view.md` um die Verantwortungsgrenze zwischen UI-Assistent, Fachlogik und atomarer Repository-Operation ergänzen
- [x] 4.4 `docs/architecture/06-runtime-view.md` um Vorschau, Fingerprint-Prüfung, Advisory Lock, atomare Erstellung und Idempotenz-Recovery ergänzen
- [x] 4.5 `docs/architecture/08-cross-cutting-concepts.md` um Idempotenz-, Audit-, Berechtigungs- und Fehlervertrag des Batch-Vorgangs ergänzen
- [x] 4.6 Bestätigen, dass keine Schemaänderung erforderlich ist; andernfalls den Change vor Implementierung neu bewerten und Schema-Snapshot sowie Schema-Dokumentation aktualisieren
- [x] 4.7 `pnpm check:file-placement` und `pnpm exec openspec validate add-waste-annual-tour-set-duplication --strict` ausführen
