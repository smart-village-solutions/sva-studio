# Design: OWASP-Grenzen im bestehenden Ausführungspfad

## Entscheidungen und verworfene Alternativen

Gewählt sind lokale Korrekturen an vorhandenen Auth-, HTTP-, Reminder- und Geocoding-Pfaden. Ein ausschließlich am Proxy angesetzter Schutz würde Kontostatus, DOI-Hashprüfung und Tenant-Budget nicht korrekt abbilden; eine neue zentrale Security-Schicht würde für diese konkreten Verbraucher zusätzliche Ownership und Umstellung erzeugen. Invarianten und Nachweise stehen hier zusammen; eine zusätzliche `assurance.md` ist nicht erforderlich.

## A – Kontosperre für persönliche Tokens (F01)

Der bestehende persönliche Authenticator behält Signatur-, Algorithmus-, Issuer-, Audience-, Client-, Subject- und Ablaufprüfung. Vor Freigabe von Rollen oder Fachhandlern werden zusätzlich der vorhandene benutzerbezogene `loginBlocked`-Zustand und der aktuelle Accountstatus im bereits vertrauenswürdig gebundenen Plattform-/Tenant-Scope geprüft. Fehlende oder widersprüchliche Account-/Membership-Zuordnung wird bei persönlichen Tokens abgewiesen; der Request erzeugt keinen neuen Account.

Der vorhandene Lifecycle-Guard erhält einen strikten Modus ausschließlich für den persönlichen Bearer-Einstieg vor Rollenhydration. Für persönliche Tenant-Tokens gilt: persistierter Account aktiv, passende Mitgliedschaft, nicht gesperrt, nicht soft-/permanent gelöscht, nicht deaktiviert und im fachlich zugelassenen Lösch-/Verarbeitungszustand. Plattformkonten haben keinen lokalen Account-Mirror: Ein gezielter Read des vorhandenen Keycloak-User-Endpunkts muss passendes Subject und ausdrücklich `enabled === true` nachweisen; 404 oder disabled verweigern, fehlende oder unprüfbare Statusdaten liefern 503. Dafür wird der bestehende Identity-Provider-Port und User-Read um eine schmale Statusmethode erweitert. Browser-/DSR-, Dev-/JIT- und Rechtstextpfade behalten ihren bisherigen Guard-Vertrag; insbesondere bleibt die bestehende DSR-Antwort 423 erhalten. Es gibt keinen künstlichen Plattform-Account oder Pseudo-Tenant.

Rollen- und Permission-Reads dürfen ein gesperrtes Konto nicht durch noch bestehende Zuweisungen erneut freigeben. Vorhandene Cache-Invalidierung bleibt erhalten; eine positive Rollen-/Permission-Cacheantwort ersetzt niemals die Account-Prüfung beim persönlichen Request. Eine fehlende Redis-Sperre ersetzt ebenfalls keinen aktiven DB-Status. Ein abgeschlossener DB-Deaktivierungscommit sperrt die erste danach beginnende persönliche Anfrage auch dann, wenn der anschließende Redis-/Keycloak-Schritt fehlschlägt.

**Fehlervertrag:** Gültiges Token mit fachlich gesperrtem/fehlendem Account wird über einen stabilen vorhandenen 403-Vertrag abgewiesen; ungültige Tokens bleiben 401. Nicht verifizierbare Redis-/DB-Abhängigkeit bleibt 503, ohne Freigabe. Fehlerantworten enthalten keine Kontodetails oder Tokenwerte. Bereits laufende, vor der Sperre autorisierte Transaktionen werden nicht nachträglich abgebrochen. Es entstehen keine neuen Tokenclaims, kein Online-Introspection-Zwang und kein zusätzlicher Sperrstore.

## B – Öffentliche Annahme und DOI (F02/F04)

### Body-Grenze

`readRequestBody` im vorhandenen Node-HTTP-Adapter erhält ein festes Limit von **65.536 Bytes**. Gültige Requests bis einschließlich dieser Grenze bleiben akzeptiert. Ein deklarierter größerer `Content-Length` wird früh verworfen; zusätzlich zählt der Reader tatsächlich empfangene Bytes für jede Übertragungsart und beendet das Puffern vor Übernahme des überschreitenden Chunks. Auch unbekannte Pfade und mutierende Methoden können dieses Limit nicht umgehen. Ein zusätzlicher Konfigurationsschalter ist nicht erforderlich.

Bei Überschreitung wird 413 ausgeliefert und die weitere Annahme begrenzt beendet; der Handler wird nicht aufgerufen. Socket-/Response-Reihenfolge muss die 413-Antwort zustellen können, ohne den Rest eines beliebig großen Bodys zu drainen. Abgebrochene Requests und konkurrierende Verbindungen hinterlassen keine dauerhaften Listener/Buffer. GET/HEAD und bisherige CORS-/Fehlerverträge bleiben funktional erhalten. Das Limit ist eine serverseitige Pflicht und hängt nicht vom Reverse Proxy ab.

### DOI-Eingabe

Die öffentliche DOI-Action hasht jeden übergebenen Rohwert genau einmal. Die Sonderbehandlung `sha256:<64 Hexzeichen>` entfällt an dieser Grenze; ein DB-Digest wird dadurch zum anderen Suchwert und aktiviert kein Abo. Existierende echte E-Mail-Tokens, Ablaufprüfung, Statusseitenvorrang, sichere Redirects und Idempotenz bleiben erhalten. Die signierte Abmeldung behält Signaturprüfung, Secretquelle und Repository-Vertrag. Weder Datenmigration noch Versand neuer Bestätigungsmails sind erforderlich.

## C – Geocoding-Transport und Budget (F03/F05)

### Transport

Das vorhandene Modul `packages/server-runtime/src/server/public-https-fetch.server.ts` bleibt zuständig für Adressklassifikation und Verbindung. Sein bestehender HTTPS-Export behält den restriktiven Vertrag. Für den aktuellen Geocoding-Verbraucher wird im selben Modul ein enger HTTP-/HTTPS-Einstieg mit gemeinsam genutzter Socket-Prüfung ergänzt; die belegte Lücke ist der bisherige HTTPS-only-Vertrag bei gleichzeitig bereits zulässigen HTTP-Providern. Keine neue Datei, Dependency, Transportfactory oder serviceübergreifende Migration.

Im Standardpfad werden direkte IP-Literale sowie alle für die konkrete Verbindung verwendeten DNS-Antworten auf nicht öffentliche Ziele geprüft. Die geprüften Antworten werden direkt dem Socket übergeben; die vorherige URL-Prüfung allein genügt nicht. Geocoding folgt Redirects weiter manuell innerhalb des bestehenden Hop-Limits und validiert Ziel/Protokoll/Verbindung bei jedem Hop. Automatisches unkontrolliertes Redirect-Following bleibt gesperrt. Credentials in URLs und unzulässige Protokolle bleiben abgelehnt.

Die vorhandene serverseitige Ausnahme `SVA_ALLOW_PRIVATE_MAP_GEOCODING_TARGETS` bleibt explizit auf den Geocoding-Aufrufer beschränkt; Browserinput kann sie nicht aktivieren. Andere Verbraucher von `fetchPublicHttps` bleiben gegen private IPs und HTTP abgesichert. Zulässige interne HTTP-Provider bleiben bei gesetzter Ausnahme funktionsfähig; ohne Ausnahme werden sie verweigert. Die bestehenden Timeouts und normierten Providerfehler bleiben erhalten.

### Gemeinsames Budget

Der vorhandene Redis-Client in `auth-runtime` liefert einen atomaren Verbrauch eines Geocoding-Budgets. Ein kleiner funktionsbezogener Einstieg im bestehenden Rate-Limit-Modul ist durch den aktuellen Verbraucher nötig: Der heutige synchrone Map-Limiter bietet weder ein konfiguriertes Tenant-Budget noch replikaübergreifende Atomarität. Andere Limiter werden nicht umgestellt.

**Semantik:** `rateLimitPerMinute = L` begrenzt die tatsächlichen serverseitigen Geocoding-HTTP-Versuche eines Tenants gemeinsam auf L in einem 60-Sekunden-Fenster ab dem ersten Verbrauch. Suggest, Geocode, Reverse-Geocode, HTTP-/Server-Function-Einstiege und vorhandene Batch-Geocoding-Verbraucher teilen denselben Tenant-Schlüssel. Vor jedem Netzwerkversuch einschließlich Redirect-Hop wird atomar Budget verbraucht; fehlgeschlagene Versuche werden nicht zurückgebucht. Der Konfigurations-Read und lokale Validierungsfehler verbrauchen nichts. Der Providerpfad ist die einzige Verbrauchsstelle, damit kein Aufruf doppelt zählt.

Redis verbindet Zähler und Ablauf atomar, beispielsweise mit dem bereits verwendeten Lua-Mechanismus; ein abgelehnter Versuch verlängert die Fensterfrist nicht. Der Schlüssel enthält ein festes Namespace und die technische Tenant-Bindung, aber keine Adresse, Suchanfrage oder E-Mail. Ein Restart oder zweiter App-Prozess setzt das Budget nicht zurück. Bei Limitüberschreitung bleibt der Provider unberührt und HTTP 429 enthält ein aus der Restlaufzeit abgeleitetes `Retry-After`; bei nicht prüfbarem Redis-Budget folgt 503. Es gibt keinen prozesslokalen Fail-open-Fallback. Die normierte Server-Function-Fehlerdarstellung trägt dieselbe Bedeutung.

Batch-Aufrufer behalten ihr vorhandenes Pacing und Request-Gesamtbudget. Das gemeinsame Budget bleibt die harte Grenze; 429 führt über den vorhandenen begrenzten Retry-/Fehlerpfad, ohne eine neue Queue oder automatische Endlosschleife einzuführen. Eine zusätzliche Akteur-Fairnessquote ist kein Lieferziel.

## D – HTML-Header mit kontrollierter Aktivierung (F06)

F06 ist zunächst eine Nachweislücke, keine bestätigte produktive XSS-Lücke. Zuerst werden vorhandene Response-Erzeuger, bereits gesetzte Edge-Header und benötigte Ressourcen-/Frame-Beziehungen inventarisiert. Live-Reads erfolgen erst nach späterer konkreter Freigabe von Dienst, Konto, Zielhosts und Wirkung; ohne diese Freigabe bleiben Live-Ziele unangetastet. Die gesondert freigegebene lokale Browserprüfung ist unten dokumentiert. Unbekannte Edge-Policies werden weder überschrieben noch als ausreichender Schutz angenommen.

Der bestehende HTML-Auslieferungspfad jeder App ist der vorgesehene Owner einer fehlenden Policy; eine bereits nachweislich vollständige Edge-Policy wird als deren Owner dokumentiert statt doppelt ergänzt. Die Prüfung umfasst normale und eingeloggte Studio-Seiten, HTML-Fehlerseiten, Auth-/Silent-SSO-Antworten sowie öffentliche Kalender-/DOI-/Abmeldeseiten. Auch vorgeschaltete Fehler dürfen keinen ungewollt ungeschützten HTML-Pfad bilden. Vorhandene strengere Header auf Downloads oder MCP-Callbackseiten werden erhalten.

Geplant sind `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` für normale HTML-Seiten und `no-referrer` für tokenhaltige Auth-/Reminder-Seiten sowie CSP mit explizitem `frame-ancestors`. Studio erlaubt standardmäßig nur eigene Frame-Ancestors; legitim konfigurierte Builder-Dev-Flows bleiben profilgebunden. Für öffentliche HTML-Seiten wird die belegte Einbettungsanforderung berücksichtigt. Das vorhandene Kalender-Embed benutzt Shadow DOM, kein iframe; seine credential-freien API-/Asset-CORS-Verträge bleiben unverändert.

Die Script-Policy startet nach Inventar als Report-Only und wird erst nach bestandenen Browsernachweisen erzwungen. Feste Inline-Skripte erhalten Hashes, dynamische SSR-/Start-Skripte den vom installierten Framework unterstützten Request-Nonce. Vor Umsetzung genaue lokale Framework-API und sämtliche Skriptverbraucher prüfen; kein globales `unsafe-inline` oder `unsafe-eval`, kein nachträgliches Nonce-Anheften an alle Script-Tags. Bestehende Endpunkte, Browser-Konsole und lokale Testartefakte genügen zur Diagnose; kein CSP-Sammeldienst. Externe Ressourcen, Karten und Downloads werden aus dem Ist-Inventar konkret freigegeben, nicht per pauschaler Wildcard. Report-Only ist ein Zwischenstand und schließt F06 nicht ab.

## E – Sicherheitsrichtlinien (F08)

`DEVELOPMENT_RULES.md` benennt die tatsächlich implementierten Kontrollen und zuständigen Quellen: Keycloak/OIDC und explizite JWT-Prüfung; serverseitige Redis-Sessions; PostgreSQL-Parameterbindung und Scope-/RLS-Regeln; Custom-Header/Origin-Prüfung; gezielte Upload-/Budget-/Headernachweise. Aussagen über automatisch durch Supabase gewährleisteten CSRF- oder Auth-Schutz entfallen im zentralen Studio-Vertrag. Reale optionale Supabase-Integrationen bleiben als solche dokumentiert. Bestehende Sicherheitsanforderungen werden nicht abgeschwächt und es entsteht keine zweite Checkliste.

## Invarianten, Grenzen und direkte Nachweise

Alle folgenden Fix-Nachweise sind **geplant**, nicht bereits erbracht. Die Audit-Kommandos sind nur Ausgangsevidenz.

| ID | Invariante und Grenze | Fehler-/Konkurrenzfall | Geplanter unmittelbarer Nachweis |
| --- | --- | --- | --- |
| INV-01 | Nach abgeschlossenem Deaktivierungscommit wird ein danach beginnender persönlicher Zugriff vor Rollen-/Fachfreigabe gesperrt. | Alter gültiger JWT, warme Permission-Caches, DB-Commit vor fehlgeschlagenem Redis-/Keycloak-Schritt, fehlende DB/Redis, falscher Tenant. | Echte lokale JWT-Verifikation; Handler über bestehende gemeinsame Auth-Fixtures; PostgreSQL mit erhaltenen Rollen und aktiven/inaktiven Accounts; gültiger Plattform-/Browser-/DSR-Kontrollfall. |
| INV-02 | Kein öffentlicher Reader puffert mehr als 65.536 Body-Bytes. | Chunked, zu großes Content-Length, unbekannter Pfad, Verbindungsabbruch, parallele Clients. | Echte Loopback-HTTP-Tests für Grenze und Grenzwert+1; 413 beobachtbar, null Handleraufrufe, kein vollständiges Einlesen des Überhangs. |
| INV-03 | Standard-Geocoding verbindet sich nur mit für genau diesen Socket geprüften öffentlichen IPs. | DNS-Antwortwechsel, IPv4/IPv6/mapped IPv6, Redirect auf internes Ziel, HTTP-/private Opt-in-Ausnahme. | Vorhandene Transporttests mit kontrollierter Resolver-/Socketgrenze und Provider-Integration; alle bisherigen HTTPS-Verbraucher als Kontrollfälle. |
| INV-04 | Ein gespeicherter DOI-Hash ist kein öffentlich gültiger Roh-Token. | Reale SHA-256-Digestform, fehlender/falscher/abgelaufener Token, wiederholte Aktion. | Vollständiger öffentlicher Page-Handler gegen echte Repository-Hashsemantik; Roh-Token positiv, Digest negativ; signierte Abmeldung und Statusseitenvorrang positiv. |
| INV-05 | Höchstens L Geocoding-Netzwerkversuche je Tenant/Fenster über alle unterstützten App-Replikate. | Zwei Clients parallel, Moduswechsel, Redirect, Restart, Fensterwechsel, Redis-Ausfall, Batch neben interaktiven Aufrufen. | Echte Redis-Integration mit zwei unabhängigen Verbrauchern; gezählte Provideraufrufe; L zugelassen, weiterer Versuch 429, Retry-After korrekt, Redis-Fehler 503 ohne Netzwerk. |
| INV-06 | HTML-Schutzheader werden wirksam durch einen belegten Owner ausgeliefert, ohne zulässiges SSO/SSR/Embed zu brechen. | Doppelte Edge-Policy, fehlender Nonce, HTML-Fehler, fremdes Framing, Token-Referrer, dynamische Ressourcen. | Header-Vertragstests plus Browserfälle für Login/Logout/Silent-SSO, Navigation, Karten, Medien, Exporte und Shadow-DOM-Embed; nach Freigabe rohe Zielantworten ohne Cookies/Tokens sichern. |
| INV-08 | Die normative Checkliste beschreibt tatsächlich implementierte Schutzkontrollen. | Behaupteter automatischer Schutz, vermischte zentrale Auth-/optionale Integrationsmodelle. | Abgleich der geänderten Aussagen mit Codepfaden, Referenzlinks und vorhandenen Dokumentationschecks. |

Eine spätere Implementierung muss für jeden gelieferten Abschnitt die Belege am exakten HEAD referenzieren. Frühere Requests können vor einer Sperre autorisiert worden sein; ein 64-KiB-Limit ersetzt keinen DDoS-Schutz; ein festes 60-Sekunden-Fenster erlaubt Grenzbursts; explizit erlaubte private Geocoding-Ziele besitzen bewusst einen weiteren Netzwerkzugang. Diese Grenzen bleiben dokumentiert und werden nicht als umfassende Security-Abnahme ausgegeben.

## Einführung und Rücknahme

Jeder Abschnitt liefert seine Tests und die betroffene aktuelle Dokumentation zusammen. A–C benötigen keine Datenmigration; DOI-Hashbestände und echte Bestätigungslinks bleiben verwendbar. Alte Replikate dürfen beim Abschluss von C nicht weiter am Provider-Budget vorbeilaufen; die Konvergenzprüfung gehört zur späteren Betriebsabnahme. Ein Rollback auf verwundbare Auth-/Body-/DOI-/Transportpfade öffnet die jeweilige Lücke erneut und gilt nicht als abgeschlossene Behebung.

Header-Enforcement wird getrennt von den lokalen Fixes eingeführt. Bei belegter Funktionsregression wird nur die neue Script-Enforcement-Stufe auf den vorher geprüften Report-Only-Stand zurückgenommen; bereits geprüfte kompatible Basisheader bleiben bestehen. F06 bleibt dann offen. Alle externen Änderungen folgen nach konkretem Auftrag den vorhandenen Betriebs-/Rollout-Verträgen; dieser Plan führt sie nicht aus.

## Lokaler Implementierungs- und Nachweisstand (8. November 2026)

Die lokalen Implementierungsnachweise stammen aus dem Worktree `owasp-security-hardening` auf Basis `f369f478aaca3c32f3e6bad4dba1f9fb22000130`. Die folgenden lokalen Belege sind keine produktive Auslieferung, Live-Abnahme oder Merge-Freigabe. Keine GitHub-Action-Datei wurde verändert.

| Invariante | Direkter lokaler Beleg | Ergebnis |
| --- | --- | --- |
| INV-01 | Mit synthetischem Schlüssel signierte RS256-JWTs und lokale PostgreSQL-Tabellen aus dem aktuellen Schema-Snapshot: sieben Sperrvarianten, organisationsbezogene und globale Permission-Reads, erhaltene Rollen, fremde Membership, fehlender Account und explizite Reaktivierung | 9 Integrationstests bestanden; Rollen und Grants bleiben gespeichert, geben aber keine Sperre frei |
| INV-01 / bestehende Auth-Verträge | `auth-runtime:test:unit --maxWorkers=2` mit isolierter PostgreSQL-/Redis-Testinstanz | 237 Dateien / 2.553 Tests bestanden; 86 vorgesehene externe/opt-in Tests übersprungen |
| INV-02/04 | Echter Loopback-HTTP-Adapter an beiden Grenzseiten, deklarierte und Chunked-Bodies einschließlich nicht fertig sendender Clients, parallele Verbindung/Abbruch; Reminder-Rohsecret gegen gestohlenen SHA-256-Verifier; Runtime und Shadow-DOM-Embed | 60 Tests in 4 Dateien bestanden; zusätzlich 10 Adaptertests nach Ergänzung der 413-Basisheader bestanden |
| INV-03 | Vorhandener Transporttest einschließlich echter Undici-Verbindungen für HTTPS und HTTP-Geocoding, nicht öffentliche DNS-Antworten, IP-Literale, Redirect- und private Opt-in-Regeln | 34 Tests bestanden |
| INV-05 | Atomare Redis-Ausführung mit zwei unabhängigen Verbindungen, 30 konkurrierenden Versuchen bei Limit 7, Tenant-Isolation, unveränderter Restfrist und Fensterwechsel | Integration plus bestehende Rate-Limit-Tests: 5 Tests bestanden |
| INV-05 | REST, Server Functions mit echter installierter Seroval-Runde, Redis-Ausfall ohne Providerzugriff, Redirect-Versuche und Postleitzahl-Batch | 24 App-Tests bestanden; 429 samt Wartezeit und 503 bleiben fachlich erhalten |
| INV-06, lokal | Router-Nonce und Themehash, bestehende Studio-Serverantworten und öffentliche Headerverträge | 23 Router- und 46 Servertests bestanden; nach Silent-SSO-Hash-Ergänzung 67 gezielte Auth-/Cookie-Tests bestanden; Script-Policy bleibt Report-Only |
| INV-06, Chromium lokal | SSR/Hydration, tatsächlicher Script-Nonce/-Hash, Theme-Persistenz und UI-Umschaltung, Framing beider Apps, DOI/Referrer und Mock-Login/-Logout an freigegebenen Loopback-Zielen | bestanden; synthetische Daten, keine echte Keycloak-/Tenant-Abnahme |
| Runtime / Types | Frühes vollständiges `check:server-runtime`; gezielte finale Runtime-Gates für Auth-/Server-Runtime; Typechecks für Auth-/Server-Runtime und beide Apps | bestanden; Workspace-Abhängigkeiten wurden lokal gebaut, keine Package-/Lockfileänderung |
| Studio-Build | Vollständiger `sva-studio-react:build` einschließlich 36 abhängiger Tasks, Toolchain-, i18n- und Import-Protection-Prüfung; keine CSP-Erzeugungslogik im öffentlichen JS gefunden | bestanden; vorhandene Bundlerhinweise bleiben sichtbar, kein Browsernachweis |
| Lint | Alle geänderten TypeScript-Dateien über vorhandenes Nx-Linttarget | 0 Fehler; 6 bereits im Ausgangsstand vorhandene Warnungen in bestehenden Fixtures/ungenutzter Konstante |
| INV-08 / Spezifikation | Dokumentations-, Dateiplatzierungs-, IAM-OpenAPI- und strikte OpenSpec-Prüfung | bestanden; nach finaler Nachweispflege erneut geprüft |

Der erste breit parallel ausgeführte Auth-Lauf hatte Zeitüberschreitungen unter gleichzeitigen Builds. Die zwei betroffenen Dateien bestanden isoliert alle 121 Fälle; anschließend bestand der gesamte Auth-Lauf mit zwei Workern. Es wurden keine Timeouts erhöht und keine Assertions entfernt.

### Headerinventar und ausstehende Abnahme

- Studio-Dokument: festes Theme-Bootstrap-Skript aus `createThemeBootstrapScript()` erhält denselben berechneten SHA-256-Hash; der installierte TanStack-SSR-Pfad verwendet `router.options.ssr.nonce` für Start-/Streaming-Skripte. Eigene Module bleiben über `script-src 'self'` erlaubt. Es gibt keine pauschalen Inline-/Eval- oder Ressourcen-Wildcards.
- Silent SSO: eigene feste Status-Skriptantwort; ihr exakter Scriptinhalt erhält einen eigenen Hash. Ziel des bestehenden `postMessage` bleibt `window.location.origin`.
- Öffentlicher Kalender: HTML enthält ein eigenes Modulskript; Reminder-Statusseiten enthalten keine Skripte. Shadow-DOM-Einbettung lädt weiterhin die vorhandenen credential-freien Assets/APIs. MIME-/Referrer-Basisheader gelten auch für direkte Adapterfehler.
- Lokaler Builder: nur das bestehende Profil `local-builder` außerhalb von Production darf Builder-Frame-Origins verwenden. Bestehende App-Policies bleiben erhalten. Eine bereits vorgeschaltete Edge-Policy kann lokal nicht erkannt oder abgenommen werden.
- Die lokale Chromium-/Playwright-Prüfung ohne reales Konto auf `127.0.0.1:17645` und `:17646` wurde ausdrücklich freigegeben und durchgeführt. Ein isoliertes Browserprofil und eine Origin-Allowlist blockierten externe Browseranfragen. Beide App-Builds bestanden.
- Im Browser bestätigt: Studio-SSR und Hydration; passender Nonce auf Framework-Skripten und frischer Nonce je Antwort; SHA-256-Abgleich des tatsächlichen Theme-Skripts; persistierter Dark Mode sowie Umschalten über die UI; blockiertes Framing beider Apps aus der jeweils anderen Origin; funktionsfähige synthetische Kalenderauswahl; DOI-Rohsecret positiv und gespeicherter Digest negativ; Entfernung des Tokens aus dem Redirect und kein ausgehender Referrer beim Linkklick. Die Mock-Anmeldung setzte den lokalen Dev-Cookie, die vorhandene POST-Abmeldung entfernte ihn wieder.
- Die isolierte IAM-Testdatenbank besitzt keine fachlich eingerichtete Studio-Instanz. Der Mock-Workspace zeigte deshalb die vorgesehene Meldung für nicht ladbare Berechtigungen/Rechtstexte; dieser Shell-/Header-Test ist keine Fachabnahme. Erwartete 401/503-Diagnosen und die absichtlich ausgelösten Framing-Verweigerungen sind keine bestandene vollständige Auth-/Modulmatrix. Lokale Browserartefakte liegen ignoriert unter `output/playwright/`; die Test-Fixtures liegen ausschließlich im ignorierten Cache.
- Für tatsächliche Zielhosts und Edge-Ownership, echte Keycloak-/Silent-SSO-Flows sowie Karten-/Medien-/PDF-/iCal- und vollständige Embed-Browserfälle besteht weiterhin eine gesonderte Betriebsabnahme. Script-Enforcement bleibt bis dahin aus; Report-Only schließt F06 nicht.

Es wurden zwei spezialisierte Integrationstestdateien ergänzt, vorhandene Runtime-Pfade und aktuelle Dokumentation erweitert und der DOI-Digest-Passthrough entfernt. Keine neuen Packages, Provider, Services, Workflows oder generischen Security-Schichten. Historischer Auditbericht und freigegebene OpenSpec-Deltas bleiben der Ausgangskontext.

### PR-Bindung und abschließender Zuschnitt

PR-Ziel ist die lokale OWASP-Härtung der bestehenden Auth-, Public-Waste-, Geocoding- und HTML-Auslieferungspfade samt Tests und Dokumentation. Maximale Bereiche sind `auth-runtime`, `server-runtime`, die beiden bestehenden Apps sowie die zugehörigen OpenSpec-/Architektur-/API-/Entwicklungsdokumente. Nicht-Ziele sind GitHub-Action-Änderungen, Dependency-Upgrades als eigener PR-Inhalt, Schemaänderungen, Rollout, Merge und die produktive F06-Abnahme.

Die abschließende Komplexitätsprüfung führte zur engeren Zuständigkeit bestehender Module: gemeinsame Account-Prädikate im vorhandenen SQL-Join, Header im vorhandenen Response-Finalizer, Server-Function-Fehleranpassung am API-Einstieg und separate Hostklassifikation im bestehenden Transportmodul. Der Exportbarrel bleibt zusammenhängend. Keine Grenzwerte oder Baselines wurden geändert. Die direkten betroffenen Tests wurden danach gezielt wiederholt; die zentrale PostgreSQL-Prüfung deckt nun auch den Permission-Verzeichnis-Read ab.

Quellfingerabdruck der 32 geänderten TypeScript-Dateien einschließlich der neuen Integrationstests: `5b7f57562861dd4c8d92b97c2839fff36bd3ca9d79ae6631fe06fa73c28ef490`. Berechnung: lexikalisch sortierte relative Pfade, je Pfad `Pfad + NUL + SHA256(Dateiinhalt) + LF`, anschließend SHA-256 über diese UTF-8-Liste. Der PR-Commit und seine GitHub-Gates binden diesen Quellstand; zwischenzeitliche Änderungen an `main` werden vor dem Push auf Überschneidungen geprüft. Die fünf seit der Planungsbasis hinzugekommenen Main-Commits betreffen ausschließlich drei Dependency-Manifest-/Lockdateien.

CI, Coverage sowie Sonar-/Codecov-Ergebnisse werden am finalen PR-HEAD gesichtet und im PR dokumentiert. Die produktiven F06- und Rollout-Abnahmen bleiben davon getrennt offen.

Integrationsbasis vor PR-Push: `d6eb5958d881b6f924a5d8275100391aab84d194`. Die insgesamt zehn seit der lokalen Prüfungsbasis hinzugekommenen Main-Commits betreffen ausschließlich vier Manifest-/Lockdateien (Dependency-Patches/-Minors), ohne Überschneidung mit den geänderten Quellen. Der Quellfingerabdruck blieb beim Rebase unverändert; die PR-Pipeline prüft den Commit mit dieser Integrationsbasis.

Die Integrationsbasis `d6eb5958d881b6f924a5d8275100391aab84d194` enthält bereits einen doppelten YAML-Snapshot-Schlüssel für `react-konva-utils@1.1.0` in `pnpm-lock.yaml`. Der Paketmanager hat beim lokalen Hook-Aufruf automatisch eine Neuauflösung versucht; diese nicht zum Security-Scope gehörende Lockfileänderung wurde verworfen. Der PR enthält keine Lockfilekorrektur. Die Auswirkungen auf die unveränderte CI-Installation werden am PR geprüft und im PR-Status eingeordnet; dies ist keine neue Sicherheits- oder Gate-Ausnahme.

### PR-Folgekorrekturen nach CI und Review

Der defekte Installationsstand wurde durch Übernahme von `main` bis `1e2caaa1d38a5079137bca4597583a401241da16` behoben. `pnpm install --lockfile-only --frozen-lockfile --ignore-scripts --offline` und die anschließende unveränderte Offline-Installation bestehen; der PR führt keine eigene Dependency-Neuauflösung oder Workflowänderung ein.

Der Review zeigte zwei Kompatibilitätsregressionen im ersten lokalen Stand: Eine DSGVO-Verarbeitungseinschränkung ist keine Browserkontosperre, und die bestehende öffentliche iframe-Einbettung darf nicht durch Same-Origin-Header blockiert werden. Die gemeinsamen Browserrollen-/Permission-Reads enthalten deshalb kein `processing_restricted_at`-Prädikat mehr. Die strengeren persönlichen Tokenprüfungen und der bereits vor diesem PR bestehende Ausschluss aus Claims-/Service-Verzeichnissen bleiben erhalten. Der PostgreSQL-Regressionsfall prüft direkte und ausschließlich gruppenbasierte Grants, beide Permission-Scopes, gesperrte persönliche Tokens und die unverändert leere Verzeichnisprojektion; bestehende DSR-Tests sichern weiterhin die 423-Antwort nur für optionale Verarbeitung.

Öffentliches Kalender-HTML erlaubt mit `frame-ancestors *` weiterhin fremde iframe-Origins; es erhält keinen pauschalen X-Frame-Options-Header. Explizite Runtime-Policies werden erhalten. Die frühere lokale Verweigerung des Kalender-Framings war eine Regression und ist kein positiver Kompatibilitätsnachweis; Studio-Framing bleibt geschützt. Der bestehende HTTP-Vertragstest prüft nun den öffentlichen Standard und den Erhalt einer expliziten strengeren Policy. Die vollständige produktive Browserabnahme bleibt offen. Im Silent-SSO-Test erkennt die Script-Extraktion außerdem HTML-Tag-Schreibweisen unabhängig von Groß-/Kleinschreibung; die reale SHA-256-Prüfung bleibt erhalten.

Gezielte Folgefix-Nachweise: Auth-Server-Runtime-Gate samt Build-Abhängigkeiten, Dokumentationscheck und strikte OpenSpec-Prüfung bestanden. 85 Auth-Tests einschließlich 9 echter PostgreSQL-Fälle und der bestehenden DSR-423-Fälle sowie 12 HTTP-Adaptertests bestanden. Die beiden Regressionen waren zuvor mit gezielten Gegenbeispielen rot reproduziert. Der neue Quellfingerabdruck nach diesen Korrekturen lautet `5179e932355e1bf3e1fc4f269ff97924149370a80df1f1b08b2225daa1461191` für 32 geänderte TypeScript-Dateien; die oben beschriebene Berechnung bleibt gleich. Der frühere Fingerabdruck gehört zum ursprünglichen PR-Stand. Die finale GitHub-Auswertung wird an den neuen PR-HEAD gebunden.
