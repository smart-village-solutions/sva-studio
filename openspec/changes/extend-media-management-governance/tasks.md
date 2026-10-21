## 1. Minimale Tags im vorhandenen Metadatenpfad

- [x] 1.1 Optionale Tag-Liste im bestehenden Metadatenvertrag ergänzen; höchstens 20 Tags mit je 1–64 Zeichen, Normalisierung, Duplikate und Patch-Semantik client- und serverseitig absichern, ohne eigene Taxonomietabellen
- [x] 1.2 Bestehende instanzbezogene Suche um Tags und einen einzelnen exakten Tag-Filter erweitern; Cursor-Bindung, Pagination und unregistrierte Dateien korrekt behandeln
- [x] 1.3 Tag-Pflege sowie Suche/Filter in Medienbibliothek und vorhandenem Picker mit bestehenden UI-Komponenten und Übersetzungen ergänzen; passende Unit-/Integrationstests sofort ausführen

## 2. Scan-Voraussetzungen vor der Implementierung festlegen

- [x] 2.1 Konkreten geschützten Storage-Eingang und Veröffentlichung derselben geprüften Bytes am bestehenden Storage-Port festlegen; direkte URLs, Listings, gültige Upload-URLs und Claim-Wechsel berücksichtigen; erforderliche Policy im bestehenden Betriebsmodell dokumentieren
- [x] 2.2 Nachweisquelle für die beschlossene Aktualitätsregel (24 Stunden Warnung / 72 Stunden Freigabesperre) und Zuordnung zu geladenen Signaturen konkretisieren; ClamAV-Ressourcen, Stream-/Scan-Limits und interne Erreichbarkeit festlegen

## 3. ClamAV im bestehenden Medienjob

- [x] 3.1 Einen internen `clamd`/`INSTREAM`-Aufruf gemäß ADR-068 vor Variantenverarbeitung ergänzen; Erfolg, Fund, Timeout, ungültige Antwort, Größenlimit und unvollständige Prüfung gezielt testen; keine Scanner-Auswahl oder neue Queue
- [x] 3.2 Geschützten Upload und bytegleiche Veröffentlichung implementieren; Scan-Erfolg mit den vorhandenen Claim-, Content-Save-, Quota- und Finalisierungsgarantien verbinden und vorhandene Bereinigung wiederverwenden
- [x] 3.3 Neuregistrierung unregistrierter Bucket-Dateien bei aktivem Scan sperren; vorhandene Medien erhalten, Bibliotheks-/Content-Save-Timeoutverhalten bewahren und verständliche übersetzte Fehler ausgeben
- [x] 3.4 Integration mit harmlosem Upload und EICAR-Testdatei sowie Ausfall, unvollständiger Prüfung, Austauschversuch nach Scan, direktem Storage-Abruf, konkurrierenden Claims, Abbruch und wiederholter Bereinigung belegen; keine doppelte/falsche Quotenbuchung

- [x] 3.5 Am 21.10.2026 freigegebene feste Sichtbarkeit neu gescannter Medien im bestehenden Prozessor und Änderungspfad absichern; Metadatenpflege und Bestandsvertrag erhalten, Ablehnung in beide Richtungen und UI-Hinweis mit Regressionstests nachweisen

## 4. Vorhandenen Betrieb und Audit ergänzen

- [x] 4.1 ClamAV-Container und persistente Signaturdaten im bestehenden Betriebs-/Deployment-Modell konfigurieren; automatische `freshclam`-Updates, Reload und vorhandene Diagnose für Erreichbarkeit und Aktualität absichern; die 24-/72-Stunden-Grenzen, fehlenden initialen Nachweis, Neustart und Wiederherstellung gezielt testen; Softwareupdates über regulären Rollout vorsehen
- [x] 4.2 Vorhandene Metadaten-/Medien-Auditpfade für Tag-Änderungen und Scanentscheidungen ergänzen; Mandantenbezug und redigierte Payloads testen, ohne eigenes Audit-Subsystem

## 5. Dokumentation und Abnahme

- [x] 5.1 Relevante Medien-/Betriebsdokumentation und tatsächlich betroffene arc42-Abschnitte gemäß ADR-068 aktualisieren; vor erforderlichen Schema-/Indexänderungen kanonische Unterlagen prüfen und mit Migration/Snapshot/Schemadokumentation synchron halten
- [x] 5.2 Passende gezielte Unit-, Integrations- und Type-Gates sowie `pnpm check:server-runtime`, `pnpm check:docs`, `pnpm check:file-placement` und `git diff --check` ausführen; `openspec validate extend-media-management-governance --strict` ausführen
- [ ] 5.3 Vor produktiver Scan-Aktivierung tatsächlichen Storage-Zugriffsschutz, Scanentscheidungen und automatische Signaturpflege im freigegebenen Zielbetrieb abnehmen; Deployment gemäß regulärem Rollout-Prozess separat freigeben lassen

### Lokale Nachweise (20.10.2026)

- Gezielte Unit- und UI-Tests für Tags, Suche, Cursor-Bindung, Scanner-Protokoll, Fehlerdarstellung und wiederholte Finalisierung erfolgreich; App-, Auth- und Skript-Typprüfungen sowie Server-Runtime-Check erfolgreich.
- Vollständiges bestehendes Auth-Integrationsziel erfolgreich, einschließlich fünf PostgreSQL-Fällen und vier Fällen mit echtem ClamAV und S3-kompatiblem Storage: harmlose Datei, EICAR, Austauschversuch, geschützter Abruf und veralteter Signaturnachweis.
- Dokumentations-, Dateiplatzierungs-, OpenSpec- und Diff-Prüfungen erfolgreich; Compose-Konfiguration und 18 Prometheus-Regeln gültig.
- ESLint der geänderten TypeScript-Dateien meldet vier bereits am unveränderten Ausgangsstand reproduzierte Modulgrenzenfehler in den beiden App-Dateien `plugin-operation-runtime*.server.ts`; keine zusätzlichen Lint-Fehler durch diese Umsetzung.
- Keine Aktivierung und kein Rollout ausgeführt. Die Sichtbarkeitsentscheidung (3.5) wurde am 21.10.2026 umgesetzt; die Abnahme im tatsächlichen Zielbetrieb (5.3) bleibt offen.

### Ergänzender Nachweis der Sichtbarkeitsentscheidung (21.10.2026)

- 73 gezielte Auth-/Verarbeitungs-Tests erfolgreich: Wechsel in beide Richtungen abgewiesen, keine Metadatenteilspeicherung, zulässige Tag-Pflege, Bestandsvertrag und dauerhafter Scan-Nachweis.
- Vier erneut ausgeführte echte ClamAV-/Storage-Integrationsfälle erfolgreich; der erfolgreiche Scan-Nachweis ist für öffentliche und geschützte Ausgaben belegt und fehlt beim abgewiesenen EICAR-Upload.
- 13 Tests der Mediendetailansicht erfolgreich, einschließlich übersetztem Hinweis nur bei gescannten Medien. Der dabei aufgedeckte SDK-Unterpfadkonflikt ist in den vorhandenen Vite-/Vitest-Aliaslisten behoben.
- Auth- und App-Typprüfungen, Server-Runtime-Check sowie Dokumentations-, Dateiplatzierungs-, OpenSpec- und Diff-Prüfungen erneut erfolgreich. ESLint der ergänzend geänderten Dateien ohne Fehler; bekannte Warnungen bleiben bestehen. Keine zusätzlichen Packages, Services, Tabellen oder Ausführungspfade für die Sichtbarkeitssperre.

### Vorbereitung von PR #1937 (21.10.2026)

- Fachreviews für Code, Tests, System-Assurance, Security, Interoperabilität, Logging, Performance, Dokumentation, UI/i18n, Nutzerpfade und Betrieb durchgeführt. Drei kleine Befunde korrigiert: Asset-Bezug im Scan-Ablehnungs-Audit, sicherer übersetzter Cockpit-Fehlertext bei Malware-Fund und aktuelle ADR-Statusaussage.
- Bestehende lange Funktionen ohne Vertragsänderung innerhalb ihrer Dateien aufgeteilt; Komplexitäts-Gate gegen `origin/main` ohne neue Findings erfolgreich. Keine neue Baseline oder Ausnahme.
- SDK-Unterpfad in der vorhandenen gemeinsamen Plugin-Testkonfiguration und den bestehenden spezialisierten Aliaslisten ergänzt; tatsächliche Picker-/Cockpit-/SDK-Verbraucher erneut erfolgreich geprüft.
- `main` integriert; beide kollidierenden Ergänzungen in arc42-Abschnitt 08 vollständig erhalten. Zielbetriebsabnahme und Scan-Aktivierung bleiben unverändert ausstehend.
