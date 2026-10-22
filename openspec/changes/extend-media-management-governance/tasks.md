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

## 6. Manuell beauftragter Bestandsscan ohne Sperren

- [x] 6.1 Berichtvertrag und begrenzten lesenden Worker am bestehenden Medien-/Job-Pfad ergänzen; 25 Dateien/64 MiB und ausschließlich lesende Abhängigkeiten einschließlich Größenwechsel absichern
- [x] 6.2 Authentifizierten Start und Berichtabruf mit vorhandenen Rechten, CSRF, Instanzgrenze und atomarer Einplanung ergänzen; Runtime-Komposition in beiden Distributionen anschließen
- [x] 6.3 Manuellen Start, laufenden Status, übersetzten Bericht und manuelle Fortsetzung in vorhandener Medienbibliothek ergänzen; niemals Bestandsdateien oder Asset-Status sperren/ändern
- [x] 6.4 Direkte Unit-/Integrations-/UI-/Type-Nachweise für Ergebnisse, Limits, Fehler und unveränderten Bestand führen; Dokumentation, ADR und tatsächlichen finalen PR-Umfang aktualisieren

### Lokaler Nachweis des manuellen Bestandsscans (21.10.2026)

- Begrenzung, Größenwechsel, drei Ergebnisse, Scanner-Ausfall, atomare Einplanung, Instanzgrenze, CSRF und Report-Rechte gezielt geprüft. Zusätzliche Regressionen belegen begrenzte S3-Abrufe auch bei fehlender/falscher Größenangabe und die unveränderte private Eingangsgrenze.
- 32 UI-Tests, 57 API-Client-Tests, 39 Routing-Tests und 24 Runtime-Kompositionstests erfolgreich. Der neue Job ist in normaler und SSF-Distribution registriert; die Fortsetzung bleibt ausdrücklich manuell.
- Fünf echte ClamAV-/S3-Integrationsfälle erfolgreich. Der neue Bestandsfall meldet sauber und Fund bei deaktiviertem Upload-Scan-Schalter; beide Dateien bleiben danach bytegleich öffentlich abrufbar. Keine echten Zielbestände oder Benutzerkonten verwendet.
- App- und Auth-Typprüfung sowie vollständiger Server-Runtime-Check erfolgreich; nach der Report-Redaktion den Auth-Runtime-Check gezielt bestätigt. Generisches Job-Monitoring zeigt keinen Dateibericht, andere Jobs bleiben unverändert.
- Dokumentations-, OpenAPI-, OpenSpec-, Dateiplatzierungs- und Diff-Prüfungen erfolgreich; Komplexitäts-Gate ohne neue Findings. Die vier zuvor belegten direkten ESLint-Modulgrenzenfehler in der bestehenden Runtime-Komposition bleiben außerhalb dieser Änderung; zusätzliche Dateien sind ohne Lint-Fehler.
- Keine neue Tabelle, Queue, Worker-Plattform oder Scanner-Abstraktion. Neuer Worker und UI-Abschnitt liefern den manuellen Bericht; S3-Leseoperationen aus dem bisherigen großen Adapter in ein internes Modul verschoben und dort erweitert, ohne parallelen Lesepfad. Task 5.3 bleibt für den Zielbetrieb offen.


### Staging-Vorbereitung des gemeinsamen Scanners (22.10.2026)

- Gemeinsamer Scanner-Vertrag in PR #1943 vorbereitet; der erste Infrastruktur-Rollout wurde vor Stack-Erstellung wegen eines von Quantum abgelehnten `entrypoint: null` gestoppt. Der enge Folgefix verwendet den vorhandenen kanonischen Quantum-Renderer.
- Privaten Bucket `studio-media-private-staging` auf der bereits konfigurierten S3-Anbindung der Staging-Sandbox angelegt. `GetBucketPolicy` bestätigt keine Policy; die MinIO-ACL entspricht genau der privaten Platzhalterantwort ohne IDs. Die Runtime-Kompatibilität erhält Negativtests für fremde IDs, Gruppen, weitere Grants und Policies.
- Harmlosen Testinhalt authentifiziert geschrieben und bytegleich gelesen; anonymer GET wurde mit HTTP 403 abgewiesen. Das Testobjekt wurde gelöscht und der leere Testpräfix anschließend bestätigt. Vorhandene Medien wurden nicht verändert.
- Der Server unterstützt kein `PutBucketCors` pro Bucket (HTTP 501). Der vorhandene serverweite CORS-Pfad erlaubt den Staging-Upload: echter OPTIONS-Preflight mit Staging-Origin und PUT ergibt HTTP 200 mit passendem erlaubtem Origin und Methode. Keine globale CORS-Einstellung geändert.
- Upload-Scan bleibt bis erfolgreicher Scanner-Bereitschaft und abgeschlossener Zielprüfung ausgeschaltet. Task 5.3 ist weiterhin offen; diese Vorbereitung ist keine Production-Abnahme oder Production-App-Freigabe.


### Freigegebene Staging-Aktivierung mit manueller Kontrolle (22.10.2026)

- Gemeinsamer Scanner mit einer Replik bereit; die konkreten Zielnachweise einschließlich Lauf-IDs, Prüfzeitpunkten, Probeumfang und Grenzen stehen in [PR #1949](https://github.com/smart-village-solutions/sva-studio/pull/1949).
- Der automatische 24-Stunden-Warnalarm ist noch nicht wirksam, weil die Scan-Metriken nicht in Prometheus ankommen. Der Nutzer hat Staging vorläufig mit täglicher manueller Kontrolle gemäß Medienreferenz freigegeben; die automatische Sperre ohne Nachweis beziehungsweise ab 72 Stunden bleibt unverändert. Production und Dev bleiben deaktiviert.
- Das Staging-Profil setzt `MEDIA_SCAN_ENABLED=true`; die tatsächliche Aktivierung und Abnahme erfolgt erst durch den regulären quellgebundenen Build-/Promote-Pfad. Task 5.3 bleibt für den vollständigen Zielbetriebsnachweis einschließlich automatischem Alarm offen. Kein Bestandsscan ist freigegeben.


### Regulärer Staging-Rollout mit freigegebenem Übergang (22.10.2026)

- Der Nutzer hat den regulären Rollout ohne Wartungsfenster, App-Pause, Bucket-Sperre oder feste Übergangsfrist freigegeben. Nach der Aktivierung neu initialisierte Uploads verwenden den privaten Eingang und die Prüfung. Zuvor ausgestellte öffentliche Upload-URLs behalten ihre bisherige Gültigkeit; dieser vorübergehende Altpfad wird bewusst akzeptiert und blockiert die Aktivierung nicht.
- Bereits begonnene Uploads werden nicht eigens abgebrochen, gesperrt oder gelöscht. Der bestehende Lebenszyklus bleibt maßgeblich; ein neuer Scan-Nachweis wird nicht allein durch die Aktivierung behauptet. Production bleibt unverändert.
- Für den Merge-Commit von PR #1949 wurden zwei getrennte Main-Push-E2E-Runs registriert (`39817079641`, `39817338791`). Der vorhandene Quellenvertrag lehnt mehrere Run-IDs für denselben Commit ab. Die vorliegende Anpassung erhält deshalb einen neuen, vollständig regulär zu prüfenden Quellstand; Gate, Nachweisauswahl und vorhandene Run-Historie bleiben unverändert. Kein aus diesem mehrdeutigen Quellstand gebautes Image wird nach Staging promotet.

- Beim vorausgehenden Dev-Deploy wurden über die veränderlichen Infrastruktur-Tags neue Postgres-/Redis-Images gezogen. Die initiale Provisioner-Schema-Prüfung scheiterte während des Datenbank-Neustarts mit `ENOTFOUND` beziehungsweise `ECONNREFUSED`; anschließend lief wieder eine Replik, Swarm blieb aber pausiert. Das Staging-Overlay hält deshalb ausschließlich die dort bereits laufenden Digests fest (`postgres:16-alpine@sha256:deb28ee471183cb0c303113dac9b2433c51eeeeb678def7af9a9ec5820367815`, `redis:7-alpine@sha256:892022f9f18c26c92c30e15194d132f90044af87b94a491a75429bbc3982eab1`). Die Medienfreischaltung enthält kein Datenbank-/Redis-Softwareupdate und keine zusätzliche Start-/Retry-Logik.
- Endbedingung der beiden Cutover-Pins: Vor dem nächsten Postgres-/Redis-Infrastruktur-Rollout die Zieldigests in Staging prüfen und identisch im gemeinsamen `compose.yaml` festlegen; beide Staging-Overrides im selben Change entfernen. Bis dahin kein Production-Update dieser Images ohne den passenden Staging-Nachweis. Die Staging-Pins werden nicht stillschweigend als dauerhaft unabhängige Versionslinie fortgeführt.
