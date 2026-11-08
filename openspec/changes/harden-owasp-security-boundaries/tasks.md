# Umsetzungsplan

Status: **A–C und E lokal implementiert; D bis zur kontrollierten Report-Only-Vorbereitung umgesetzt.** Produktive Browser-/Live-/Enforcement-Abnahme bleibt separat offen; lokale Browserfälle sind im Design nachgewiesen. Nachweise stehen im Design; finale Build-/Dokumentationsgates werden nach ihrem tatsächlichen Ergebnis gepflegt. F07/GitHub Actions ist ausgeschlossen; keine Aufgabe verlangt eine Änderung an `.github/workflows/` oder `.github/actions/`.

## 1. Gemeinsamer Einstieg je Lieferabschnitt

- [x] 1.1 Ziel, Nicht-Ziele und maximale Bereiche des Abschnitts aus `proposal.md` vor dessen Codeänderung festhalten; aktuellen HEAD und Überschneidungen offener Changes prüfen.
- [x] 1.2 Bestehende Mechanismen und gemeinsame Test-Fixtures lesen; vor nichttrivialen Codeänderungen verfügbaren XERJ-Index mit aktuellem Quellstand und Lizenz prüfen. Keine neue gemeinsame Schicht ohne belegte Lücke.
- [x] 1.3 Kleinsten echten Unit-/Type-Pfad und spezielle Security-/Auth-/Runtime-Gates aus `DEVELOPMENT_RULES.md` bestimmen. Nx-Projekte/Targets aktuell abfragen; Dateifilter ausschließlich als `--testFiles=...`.
- [x] 1.4 Invarianten des Abschnitts gegenprüfen; vor dessen erstem risikobehafteten Block den erforderlichen Proposal-/Security-/Testreview gemäß vorhandener Trigger-Matrix abschließen. Keine Tests oder früheren Auditbelege als ausgeführte Fix-Evidenz markieren.

## 2. Abschnitt A – Persönliche API-Tokens und Kontosperren (F01 / INV-01)

- [x] 2.1 `personal-api-auth.ts`, `middleware.ts`, `middleware-guards.ts`, Rollen-/Permission-Queries und Actor-Auflösung gemeinsam prüfen; Plattform-/Tenant-, Browser-JIT-, Dev-, Rechtstext- und DSR-Ausnahmen ausdrücklich abgrenzen.
- [x] 2.2 Negativfall zunächst mit vorhandenem Auth-Fixture und echter JWT-Verifikation reproduzieren: gültiges Token, Account deaktiviert, Rollen und Permission-Snapshot weiter vorhanden.
- [x] 2.3 Vorhandenen persönlichen Auth-/Lifecycle-Pfad um aktuellen Account-/Membership- und `loginBlocked`-Read erweitern; fachliche Sperre 403, ungültiges Token 401, nicht prüfbare Abhängigkeit 503. Keine Accountanlage aus Bearer-Requests.
- [x] 2.4 Zuständige Rollen-/Permission-/Actor-Reads so absichern, dass erhaltene Zuweisungen eine fachliche Sperre nicht umgehen. Keine fachlichen Rechte allein aus Token-/Rollennamen ableiten.
- [x] 2.5 PostgreSQL-Nachweis ergänzen: Token vor Deaktivierung, erfolgreiche DB-Sperre, anschließender Request ohne Freigabe; warme Caches und Redis-/Keycloak-Teilfehler nach DB-Commit. Aktive Tenant-/Plattform-Kontrollfälle und Tenant-Konflikte prüfen.
- [x] 2.6 Browser-Sessions, zulässige Dev-/JIT-/DSR-Pfade, Login-Sperre und Reaktivierung regressionsprüfen; komplette betroffene Guard-/Handler-Fixtures verwenden. Keine neue Session- oder Token-Laufzeitsemantik.
- [x] 2.7 Früh `pnpm check:server-runtime` ausführen; kleinsten projektweiten Auth-Unit-Pfad vor Push sowie gezielte Types/Integration gemäß Pflicht-Gates abschließen. Aktuelle Zielkonfiguration prüfen, keine pauschale Vollsuite.
- [x] 2.8 Betroffene API-Fehlerdokumentation, arc42 04/05/06/08, ADR-023/ADR-067 und bei deren Fortschreibung 09/ADR-Index aktualisieren; keine neue ADR-Schicht.

## 3. Abschnitt B – Öffentlicher HTTP-Adapter und DOI (F02/F04 / INV-02/04)

- [x] 3.1 64-KiB-Grenze im vorhandenen Reader implementieren: Content-Length früh prüfen, empfangene Bytes unabhängig davon zählen, übergroße Bodies vor Handleraufruf mit 413 beenden.
- [x] 3.2 Echten Adapter über Loopback mit 65.535, 65.536 und 65.537 Bytes prüfen; Chunked-Encoding, unbekannte Route, fehlender Content-Length, Abbruch und parallele Verbindungen abdecken. Sicherstellen, dass die 413-Antwort zustellbar bleibt und kein vollständiger Überhang gepuffert wird.
- [x] 3.3 DOI-Eingaben im vorhandenen Page-Handler immer hashen; Digest-Passthrough entfernen. Vor jeder Entfernung andere Verbraucher der Hilfsfunktion prüfen und den ersetzten öffentlichen Zweig im selben Abschnitt löschen.
- [x] 3.4 Mit echten SHA-256-Werten testen: ausgestellter Roh-Token aktiviert; gespeicherter Digest aktiviert nicht; falsche/abgelaufene/fehlende Tokens, Statusseitenvorrang und wiederholte Aktionen bleiben sicher.
- [x] 3.5 Signierte Abmeldung, bestehende Links/Redirects, GET/HEAD, CORS für API/Assets und Reminder-Persistenz regressionsprüfen. Keine Bestandsmigration und kein Versand echter E-Mails.
- [x] 3.6 Gezielt `public-waste-calendar-web`-Tests, bei berührter Repository-Grenze deren Integration, passende Types sowie betroffene öffentliche API-/Betriebsdoku und arc42 05/06/08 aktualisieren.

## 4. Abschnitt C – Geocoding-Transport und gemeinsames Budget (F03/F05 / INV-03/05)

- [x] 4.1 Alle aktuellen Verbraucher von `fetchPublicHttps`, Geocoding-Operationen, HTTP-/Server-Function-Einstiege und Batch-Resolver inventarisieren; erlaubtes HTTP und vorhandene private Opt-ins als Regression festhalten.
- [x] 4.2 Im bestehenden Transportmodul gemeinsamen Resolver-/Socketmechanismus für den engen HTTP-/HTTPS-Geocoding-Einstieg nutzen; bestehender HTTPS-Export bleibt restriktiv. Normales ungeprüftes Fetch im betroffenen Geocoding-Pfad ersetzen.
- [x] 4.3 Verbindungsbezogene DNS-/IP-Prüfung, IPv4/IPv6/mapped IPv6, DNS-Antwortwechsel, unzulässige Protokolle, URL-Credentials, jeden Redirect-Hop und Hop-Limit testen. Explizite interne HTTP-Ausnahme positiv und Standardverweigerung negativ prüfen.
- [x] 4.4 Im vorhandenen Rate-Limit-Modul ein atomar befristetes Redis-Budget je Tenant ergänzen; bestehendes Redis verwenden. Limit, 60-Sekunden-Fenster, Restfrist und Fehlervertrag aus `design.md` umsetzen.
- [x] 4.5 Tenant-Bindung durch alle vorhandenen Geocoding-Verbraucher bis zum Providerpfad führen; Budget genau dort vor jedem tatsächlichen Netzwerkversuch einschließlich Redirects verbrauchen. Keine Doppelzählung in Route und Provider.
- [x] 4.6 HTTP 429 mit `Retry-After`, gleichbedeutenden Server-Function-Fehler und 503 bei Redis-Ausfall ohne Providerzugriff testen. Fehlerdetails enthalten keine Suchadressen, Tokens oder API-Keys.
- [x] 4.7 Echte Redis-Integration mit zwei unabhängigen Verbrauchern/Verbindungen: konkurrierend höchstens L Erfolge, Tenant-Isolation, Modus-/Prozesswechsel, TTL/Fensterwechsel und abgelehnte Versuche ohne TTL-Verlängerung.
- [x] 4.8 Batch-Pacing und Request-Gesamtbudget erhalten; interaktive und Batch-Aufrufe teilen trotzdem die harte Tenant-Grenze. 429-/503-Verhalten am vorhandenen Batch-Fehler-/Retrypfad prüfen.
- [x] 4.9 Früh Server-Runtime-Gate und kleinste relevante `server-runtime`-/`auth-runtime`-/App-Tests und Types ausführen; API-/Interface-Dokumentation, arc42 05/06/07/08 und verbleibende Risiken in 11 aktualisieren.

## 5. Abschnitt D – Headernachweis und kontrollierte Durchsetzung (F06 / INV-06)

- [x] 5.1 Lokales Inventar für HTML-Antworten, Framework-Nonce-Unterstützung, feste Inline-Skripte, Ressourcenquellen, Frames, Fehlerpfade und bereits vorhandene Policies erstellen; keinen neuen Telemetriedienst einführen.
- [ ] 5.2 Für spätere Live-Reads konkrete Dienste/Konten/Zielhosts und rein lesende Wirkung benennen und gemäß `AGENTS.md` freigeben lassen. Ohne Freigabe nur lokal weiterarbeiten und F06 nicht als produktiv geschlossen markieren.
- [ ] 5.3 Nach Freigabe tatsächliche Header an Studio-/Tenant- und öffentlichen HTML-Zielen prüfen; Owner App oder bereits vollständige Edge-Policy festhalten. Keine doppelten/widersprüchlichen CSP-Header und keine pauschale Proxy-Neukonfiguration.
- [x] 5.4 Fehlende kompatible `nosniff`-/Referrer-/Framing-Header im zuständigen vorhandenen Pfad ergänzen; tokenhaltige Seiten `no-referrer`; strengere bestehende Download-/MCP-Policies erhalten. Öffentliche credential-freie CORS-Verträge nicht erweitern oder entfernen.
- [x] 5.5 Bei fehlender Script-CSP diese zunächst als Report-Only vorbereiten: feste Skripthashes, dynamische SSR-/Start-Nonces und konkrete Quellen aus dem Inventar. Keine pauschalen `unsafe-inline`-/`unsafe-eval`-Freigaben; eine bereits vollständig belegte Policy nicht duplizieren.
- [ ] 5.6 Header-Vertragstests und gezielte Browserfälle für Login/Logout/Silent-SSO, SSR/Hydration/Navigation, Theme, Karten, Medien, PDF/iCal und Shadow-DOM-Embed ohne Regression nachweisen; unerlaubtes Framing und Token-Referrer negativ prüfen.
- [ ] 5.7 Erst mit bestandener Evidenz Enforcement aktivieren, an denselben Zielen verifizieren und Owner/Policy/Buildstand dokumentieren. Report-Only bleibt andernfalls offener Zwischenstand; Rücknahme nur der neuen Script-Enforcement-Stufe ist beschrieben.
- [x] 5.8 Aktuelle Sicherheits-/Betriebsreferenzen und arc42 05/06/07/08/11 fortschreiben; keine zweite Rollout-Anleitung und keine Workflowänderung.

## 6. Abschnitt E – Security-Richtlinien (F08 / INV-08)

- [x] 6.1 Bestehenden Abschnitt 6 von `DEVELOPMENT_RULES.md` gezielt korrigieren: tatsächliche Keycloak-/Redis-/PostgreSQL-/CSRF-Verantwortung mit Quellen statt automatischer Supabase-Annahmen.
- [x] 6.2 Normative Querverweise auf betroffene Aussagen prüfen; optionale Supabase-Schnittstelle sauber vom zentralen Studio-Auth-Modell unterscheiden. Keine neue Checkliste, keine Herabsetzung vorhandener Anforderungen.
- [x] 6.3 Nach A–D tatsächliche Sperr-, Body-, DOI-, Transport-, Budget- und Headerverträge mit der Checkliste abgleichen. Reine Textkorrekturen benötigen keine Unit-Tests; vorhandene Dokumentationschecks ausführen.

## 7. Abschnittsabschluss und spätere Betriebsabnahme

- [ ] 7.1 Je geliefertem Abschnitt direkte Evidenz für dessen Invarianten am exakten HEAD festhalten; erst danach zugehörige Tasks abschließen. Offene Header-Liveprüfung und nicht bearbeitete Map-Limiter bleiben transparent.
- [x] 7.2 `openspec validate harden-owasp-security-boundaries --strict`, `pnpm check:file-placement`, betroffene Dokumentationschecks und `git diff --check` ausführen. Vor breitem affected-Unit-Lauf Scope messen; bei mehr als sechs Projekten gezielte Projektgates wählen und finales CI-Gate verwenden.
- [ ] 7.3 Bei späterem PR-Auftrag bestehende CI-/Review-Gates für den exakten finalen HEAD abwarten. Keine CI-Implementierung oder GitHub-Action-Änderung als Nebenarbeit aufnehmen.
- [ ] 7.4 Nach gesondertem Rollout-Auftrag den bestehenden kanonischen Prozess verwenden; Konvergenz aller Geocoding-Verbraucher und aktive Header-/Kontosperren im freigegebenen Zielbetrieb nachweisen. Technische Auslieferung, Live-Verifikation und fachliche Abnahme getrennt berichten.
- [x] 7.5 Vor Abschluss Oberfläche bilanzieren: ausschließlich bestehende Packages und Pfade erweitert, ersetzte unsichere Zweige entfernt, keine Shadow-Pfade, neuen Services oder allgemeinen Security-Frameworks eingeführt.

## Verbleibende Freigabegrenzen

- 5.2/5.3/5.6/5.7: Die lokale Browserprüfung wurde ausdrücklich freigegeben und durchgeführt. Zielbetrieb, echte Keycloak-Flows und vollständige Browsermatrix sowie Edge-Owner sind nicht geprüft; keine Script-CSP-Durchsetzung aktivieren oder F06 als geschlossen behandeln.
- 7.1: Lokale Belege und reproduzierbarer Quellfingerabdruck stehen im Design. Der jetzt beauftragte PR ordnet den Commit und dessen finale CI-Evidenz diesem Stand zu; die Bewertung wird im PR geführt.
- 7.3: PR-Erstellung ist ausdrücklich beauftragt; finale CI-/Review-Evidenz wird am tatsächlichen PR-HEAD bewertet.
- 7.4: Rollout/Betriebsabnahme bleibt ein gesonderter Folgeauftrag; kein Deployment aus dieser lokalen Umsetzung.
