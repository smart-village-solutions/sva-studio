## 1. Vertrag und Datenintegrität nachweisen

- [ ] 1.1 Ziel-Mainserver-Vertrag gegen Schema-Snapshot und Quellen prüfen; POI-Update/Reset sowie separate Sichtbarkeit mit isolierten Testdaten nachweisen, keine schreibende Produktionsdiagnose.
- [x] 1.2 Vollständige Feld-/Beziehungsinventur für POI und Voucher erstellen; insbesondere öffentliche Reads für inaktive Kategorien und vergangene/undatierte Ankündigungen samt Rollen-/Globalfiltern und Pagination prüfen. Bekannte Schreibgrenzen aus `design.md` als lokale Checks im vorhandenen Adapter abbilden; Erhaltung oder Ablehnung belegen.
- [x] 1.3 Bestehende Writer inventarisieren: POI-Editor, Gutscheinpfad, GenericItem-Editor, Status/Bulk, Ownership und Projektionen. Bestehende Principal-/Bestätigungs-/History-Verträge konkret zuordnen.

## 2. Bestehenden Mainserver-/Host-Pfad erweitern

- [x] 2.1 Typisierte Voucher-Reads und vollständigen verschachtelten POI-Write im bestehenden `@sva/sva-mainserver` implementieren; kein paralleler Persistenzpfad. V2-Roundtrip-Fixtures sofort absichern.
- [x] 2.2 UUID-Erhalt/-Vergabe, eindeutige Auswahl und Rückzuordnung neuer Datenbank-IDs sowie Aktualisierung betroffener Projektionen/Referenzen implementieren. Erstellungsschlüssel vor dem Write an Browser und Save-Versuch binden und für Abgleich nach Tab-Reload erhalten; vorhandene Operationsverträge zuerst prüfen, keine neue Recovery-Plattform. Fehlende/doppelte Identitäten testen.
- [x] 2.3 Serverseitige Feldvalidierung und Autorisierung des gesamten betroffenen POI-/Gutscheinbestands ergänzen; fremde Mandanten, Anbieter und manipulierte Ortslisten ablehnen.
- [x] 2.4 Bestätigung für aktuellen Inhalt und alle betroffenen Gutscheine prüfen; erkennbare konkurrierende Inhaltsänderungen ablehnen. Nicht atomare externe Konkurrenzgrenze dokumentieren.
- [x] 2.5 Gewöhnliche POI-Saves auf denselben Erhaltungs-/Bestätigungspfad führen, auch bei deaktiviertem Plugin; destruktive GenericItem-/Bulk-Umgehungen sowie POI-Löschung mit Gutscheinen verhindern.
- [x] 2.6 Separate Sichtbarkeit, eindeutige Fehlerzustände und Readback nach unbestätigtem Ausgang umsetzen; kein automatischer destruktiver Retry. Früh `pnpm check:server-runtime` und gezielte Unit-/Type-Gates ausführen.

## 3. Gutschein-Plugin und Redaktion

- [x] 3.1 Optionales Plugin `vouchers`, Inhaltstyp `vouchers.voucher`, hostgeführte Routen, Content-Projektion, Actions und deklarierte Historie nach vorhandenen Verträgen registrieren.
- [x] 3.2 Übersicht/Detail mit Suche, Ort-/Kategorie-/Sichtbarkeitsfiltern, Kontingent und Links zum Ort implementieren.
- [x] 3.3 Erstellung als Onepager gemäß `design.md` und Inhaltsbearbeitung mit vorhandenen Formular-/Medienbausteinen, genau einem Ort und clientseitiger Validierung implementieren; Grunddaten → Einlöseort → Vorteil → Kontingent → Gültigkeit → Sichtbarkeit und Speichern. Keine eingebettete POI-Neuanlage und kein Ortswechsel bestehender Gutscheine.
- [x] 3.4 Rabattmoduswechsel, Kalender-/Mengenbeispiele, optionale Gültigkeitsgrenzen und Zusammenfassung mit Korrekturlinks umsetzen; Sichtbarkeit bei Create zunächst ausgeblendet, bei Edit als getrennte Aktion. Kein destruktiver No-op-Save.
- [x] 3.5 Reset-Dialog samt Geschwistergutscheinen, expliziter destruktiver Aktion, sicherem initialem Fokus und Abbruch umsetzen; Ort ohne Gutscheine ohne unnötigen Dialog, serverseitige Nachprüfung bleibt verpflichtend. De/en, Tastaturbedienung, Fehlerfokus, Lade-/Konfliktzustände und gesperrte Doppelsubmits prüfen.
- [ ] 3.6 POI-Ansicht zeigt verlinkte Gutscheine ohne zweiten Gutschein-Editor; Firmeninhaber-/Redakteur-Rechte und Plugin-Deaktivierung abnehmen.
- [x] 3.7 Nutzungsdarstellung gemäß Design in Übersicht und Detail umsetzen: registrierte Einlösungen, Rest, Maximum, Auslastung, Kalenderzeitraum, Einlöseregel und erfolgreicher Abrufzeitpunkt; vorhandenen Balken-/UI-Baustein verwenden, reinen Read aktualisieren können.
- [x] 3.8 Nutzung frisch und autorisiert laden, Cache-/Periodenvertrag prüfen und nach Aggregat-Save neu lesen; unbekannte/widersprüchliche Werte, Überziehung, Fehler und gespeicherten gegenüber ungespeichertem Stand unterscheiden. Keine Personenanalyse oder lokale Statistikdatenhaltung.

## 4. Abnahme und Dokumentation

- [x] 4.1 V1–V5 aus `design.md` gezielt testen: zwei Gutscheine, unsichtbare Geschwister, Einlösungsreset, Inhalts-/Ownership-Erhalt, gewöhnliches POI-Update, Visibility ohne Reset, Konflikt, Timeout und neue IDs.
- [ ] 4.2 Kontrollierte Mainserver-/App-Akzeptanz mit isolierten Testdaten durchführen: erstellter Gutschein wird angezeigt und eingelöst; nach bestätigtem Edit ist der erwartete Reset sichtbar. Offene Gültigkeitsgrenzen und veraltete IDs/Offline-Requests prüfen und Ergebnisse festhalten.
- [ ] 4.2a Redaktionelle UX-Abnahme gemäß Design durchführen: monatlicher Gutschein bei zwei vorhandenen Gutscheinen, Rabattkorrektur und ausgeblendetes Erstellen; zusätzlich Firmeninhaber mit einem zulässigen Ort. Verständlichkeit der Mengen-, Sichtbarkeits- und Reset-Wirkung beobachten; automatisierte Nachweise separat ausweisen.
- [ ] 4.2b Nutzungsdaten gezielt testen: 37/100, 0/100, 100/100, 102/100, fehlende und widersprüchliche Werte, unbekannter Rhythmus, Abruffehler, Kalenderwechsel und Reset. Isoliert nachweisen, dass eine Mengen-Einlösung von drei als drei registrierte Einlösungen erscheint; keine Personen-/Umsatzstatistik behaupten.
- [ ] 4.2c Konkrete Review-Fälle absichern: inaktive Kategorien, vergangene/undatierte Ankündigung trotz leerem Detailfeld, wirksame Business-Account-Ausnahme sowie erfolgreicher Create vor Response-Verlust/Prozessabbruch mit Tab-Reload und zwei inhaltsgleichen Gutscheinen. UI-Hauptfelder „Überschrift“/„Einleitung“ prüfen.
- [x] 4.3 Bestehende Anwender-/Entwicklerdokumentation und arc42 03/05/06/08/10/11 aktualisieren; Reset, externe Konkurrenz, Ortswechselgrenze und Backend-Follow-up erklären.
- [ ] 4.4 Passende finale Qualitätsgates nach `DEVELOPMENT_RULES.md` einschließlich spezieller Auth-/Datenintegritäts-/Server-Runtime-Gates ausführen; vor breitem affected-Unit-Run Scope messen, sonst gezielte Tests nutzen.
- [x] 4.5 `openspec validate add-vouchers-plugin --strict`, `pnpm check:file-placement` und Diff-Prüfung ausführen; keine neue Infrastruktur oder ungenutzten Zukunftspfade hinterlassen.

## Lokaler Umsetzungsstand am 24.10.2026

Die Implementierung liegt für den PR auf `feature/vouchers-plugin-pr`. Mainserver und mobile App wurden nicht verändert; die Mainserver-Anbindung hier bezeichnet ausschließlich das Studio-Package. Es wurden keine externen Testdaten angelegt und kein Rollout ausgelöst.

- **1.1 teilweise:** GraphQL-Dokumente und vollständige Schreibinventur sind gegen den eingecheckten Schema-Snapshot geprüft; Reset-/Visibility-Verhalten wurde anhand der Mainserver-Quellen und lokaler Fixtures abgesichert. Der isolierte Live-Nachweis steht aus.
- **3.6 teilweise:** Die POI-Detailansicht verlinkt die berechtigte Gutscheinübersicht. Plugin-Registrierung, Actions, serverseitige Rechte und Schutz bei deaktiviertem Plugin sind lokal implementiert und getestet. Die beobachtete Rollen-/Deaktivierungsabnahme steht aus.
- **4.1 lokal:** Roundtrip mit zwei Gutscheinen und unsichtbaren Geschwistern, Erhalt unbekannter Payload-/Medien-/POI-Felder, UUIDs und neue IDs, gewöhnliche Ortsänderung, getrennte Visibility, konkurrierender Inhalt sowie unklarer Write-Ausgang sind durch Adapter-/Routen-/UI-Tests abgedeckt. Lokale Fixtures ersetzen keinen echten Reset-/Einlösungsnachweis.
- **4.2/4.2a ausstehend:** Echte App-Einlösung, Offline-/Alt-ID-Verhalten und beobachtete redaktionelle UX-Abnahme sind nicht durchgeführt.
- **4.2b teilweise:** Lokale Tests prüfen 37/100, 0/100, 100/100, 102/100, fehlende/widersprüchliche Werte, unbekannten Rhythmus, reine Aktualisierung, Abruffehler und Reset-/Reload-Verhalten. Mengen-Einlösung von drei und Kalenderwechsel müssen noch an isolierten Mainserver-Daten nachgewiesen werden.
- **4.2c teilweise:** Unvollständige Reads, inaktive Kategorien, Business-Account-Grenze, erhaltene Zusatzfelder, doppelte Identitäten, Response-Verlust und Wiederaufnahme im neuen Editor-Mount ohne erneutem Write sind lokal geprüft. Ein echter Prozessabbruch sowie die Wirksamkeit der Business-Account-Ausnahme gegen eine konkrete Instanz bleiben ausstehend.

### Lokale Qualitätsnachweise

- Typechecks für Gutschein-Plugin, POI-Plugin, Studio-App und die geänderten Server-Packages; serverseitige Builds und Runtime-Checks für `auth-runtime` und `sva-mainserver` erfolgreich. Der vollständige Server-Runtime-Lauf war zuvor ebenfalls erfolgreich.
- Gutschein-Plugin: 46 Tests grün; Coverage 94,65 % Zeilen, 93,08 % Statements, 89,01 % Funktionen und 85,07 % Branches. Finale gezielte Folgeprüfungen: Auth 83 Tests, POI 44 Tests, Host-Projektion/Adapter/Registry 25 Tests und Medien-Dialog 21 Tests grün. Die Adapter-Suite war zuvor mit 269 Tests grün; nach den abschließenden Konflikt-/Roundtrip-Änderungen waren die drei unmittelbar betroffenen Testdateien mit 26 Tests erneut grün.
- Gezielte Adapter-, Auth-, POI-, Projektions- und UI-Tests erfolgreich. Die einzelnen Testdateien liegen unmittelbar bei den geänderten Pfaden; Tests verwenden bestehende Vitest-Targets.
- Plugin-UI-Boundary grün. Plugin-Architekturprüfung erfolgreich mit bereits vorhandenen Review-Signalen für SSF und Abfallmodul; kein neuer Voucher-Befund.
- Neue Voucher-Quelldateien wurden zusätzlich direkt mit den bestehenden Komplexitätsmetriken geprüft, weil ungetrackte Dateien im Git-basierten Gesamtgate noch nicht vollständig berücksichtigt werden. Keine Schwellenwerte oder Baselines wurden gelockert.
- Das globale Komplexitätsgate bleibt durch bestehende Befunde in anderen Plugins rot. Die sechs statischen Nx-Importfehler in vier berührten Host-Dateien lassen sich unverändert auch auf deren HEAD-Version reproduzieren. Der fokussierte Lint der neuen Gutscheinpfade hat keine Fehler.
- Strikte OpenSpec-Validierung, Dateiplatzierung, Dokumentationsprüfung und `git diff --check` erfolgreich.

**4.4 bleibt offen**, bis die vollständigen finalen CI-/Coverage-Gates und die dafür erforderlichen Nachweise vorliegen. Ein grüner lokaler Unit-Lauf wird nicht als bestandene Live-Abnahme oder als Freigabe für Production gewertet.

### PR #1972 auf aktuellem main

Der isolierte PR-Worktree basiert auf `58dafeba5` und enthält keine fremden Keycloak-/Smoke-Änderungen. Auf dieser Basis wurden `nx run plugin-vouchers:test:coverage` (46 Tests, identische Coverage) sowie `complexity-gate --base=origin/main` erneut erfolgreich ausgeführt. Das diffbezogene Komplexitätsgate prüft jetzt 66 Dateien: keine neuen Findings, ein bestehender getrackter Export-Befund in `service.ts`. Die weiter oben genannten roten globalen Befunde beziehen sich auf den früheren, vollständigen Lauf vor der Aktualisierung der Basis und sind kein aktueller PR-Gatestatus. Vollständige GitHub-CI und Live-Abnahmen bleiben gesondert offen.

### Review-Korrekturen am 25.10.2026

- Recovery prüft den vollständigen vorbereiteten Sollzustand einschließlich POI, Geschwistergutscheinen, Kontingent, Medien und opaken Payload-Feldern. Der Sollzustand bleibt im bestehenden serverseitigen Idempotenzdatensatz; nur frisch generierte technische Update-Metadaten sind ausgenommen. Gezielte Routenprüfung: 18 Tests grün.
- Inhaltskorrekturen erhalten Wochentags- und Uhrzeitregeln auch ohne Datumsgrenzen. Der Adaptertest prüft sowohl den zurückgegebenen Datumsbereich als auch die tatsächlich gespeicherten Zeitmetadaten.
- Bekannte Ablehnungen vor dem Write entfernen den Pending-Marker und erlauben Korrekturen samt Reload. Tatsächlich unklare Ausgänge bleiben gesperrt. Der Ortsfilter lädt weitere Ergebnisseiten auch nach einer leeren autorisierten Seite. Gezielte UI-Regressionen: 10 Tests grün.
- Plugin-Typecheck und Mainserver-Server-Runtime-Prüfung erfolgreich. Der GraphQL-Specifier im Lockfile entspricht der exakten Manifestversion; unbeabsichtigte Importer- und Workspace-Auflösungsänderungen wurden verworfen. Installation mit `--frozen-lockfile --ignore-scripts` erfolgreich.
- Die vollständige CI am neuen PR-HEAD und die bereits dokumentierten isolierten Mainserver-/App-/UX-Abnahmen bleiben gesonderte Nachweise. Keine externen Testdaten und kein Rollout.
