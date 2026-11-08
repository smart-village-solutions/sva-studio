# OWASP-Abgleich des Studios am 8. November 2026

## Ergebnis

Die Prüfung findet zwei hoch priorisierte Sicherheitslücken, drei weitere konkrete Schwächen mittlerer Priorität, eine im Zielbetrieb zu verifizierende Header-Lücke und zwei nachrangige Härtungs-/Dokumentationsthemen. Vorrang haben die Kontosperre für persönliche API-Tokens und die unbegrenzte Annahme von Request-Bodies im öffentlichen Abfallkalender. Es gibt keinen Nachweis eines Angriffs oder Datenabflusses.

Geprüfter Quellstand: `main`, Commit `47d82417c2dc7182fc52dc94a0aa71ba4be9bf30`. Der Arbeitsbaum war zu Beginn sauber. Grundlage sind der [OWASP-Index](https://cheatsheetseries.owasp.org/index.html) und die unten jeweils verlinkten, für die tatsächlichen Studio-Angriffsflächen relevanten Cheat Sheets.

Die Prüfung umfasst ausgewählte zentrale Pfade von React/TanStack Start, Auth-Runtime/IAM, Medienverarbeitung, Geocoding, persönlichem MCP-Zugang, öffentlichem Abfallkalender und Repository-Workflows. Sie ist eine risikoorientierte Codeprüfung mit begrenzten lokalen Nachweisen, keine vollständige Prüfung sämtlicher Cheat Sheets, kein ASVS-Zertifikat und kein Penetrationstest. Produktive Hosts, Keycloak-Einstellungen, Reverse-Proxy-Konfiguration außerhalb des Repositories, aktuelle Scanner-Dashboards und aktuelle Dependency-Advisories wurden nicht abgefragt. Insbesondere werden aus fehlender Repository-Konfiguration keine bestätigten Produktionszustände abgeleitet.

## Prioritäten

| ID | Priorität | Bereich | Ergebnis und Evidenzstatus |
| --- | --- | --- | --- |
| F01 | Hoch | Studio: persönliche API/MCP | Kontosperre wird beim bereits ausgestellten Bearer-Token nicht geprüft; Codepfad und isolierter Nachweis |
| F02 | Hoch | Öffentlicher Abfallkalender | Request-Body wird ohne Byte-Limit gepuffert; realer lokaler HTTP-Nachweis |
| F03 | Mittel | Studio: benutzerdefiniertes Geocoding | DNS-Prüfung und Verbindungsaufbau sind getrennt; Code und kontrollierte DNS-/Fetch-Simulation |
| F04 | Mittel | Öffentlicher Abfallkalender: DOI | Gespeicherter Token-Hash wird als Bearer-Token akzeptiert; direkte Ausführung der Originalfunktion |
| F05 | Mittel | Studio: Geocoding | Konfigurierte Anfragenrate wird im interaktiven Serverpfad nicht durchgesetzt; isolierter Nachweis |
| F06 | Mittel, vorläufig | Studio-Weboberfläche | CSP/Framing-Schutz fehlen im untersuchten Repository-Pfad; tatsächliche Edge-Header offen |
| F07 | Niedrig | Build und Rollout | Externe Actions an veränderlichen Tags statt Commit-SHAs |
| F08 | Niedrig | Entwicklungsrichtlinien | Security-Checkliste beschreibt teilweise das falsche Auth-/Datenmodell |

Die Prioritäten berücksichtigen Angreifervoraussetzungen und Auswirkungen. Sie sind keine berechneten CVSS-Werte. Die externe Erreichbarkeit und konkrete Restlaufzeit produktiver Tokens sind unbestätigt.

## Hoch priorisierte Befunde

### F01: Persönliche API-Tokens umgehen die vorhandene Kontosperre

**Auswirkung:** Ein deaktivierter Benutzer mit einem zuvor ausgestellten, noch gültigen persönlichen API-Token kann weiterhin für seine erhaltenen IAM-Rechte zugelassen werden; dies betrifft potenziell auch Benutzer- und Rollenverwaltung.

**Belege:**

- `packages/auth-runtime/src/personal-api-auth.ts:36–60` verifiziert Signatur, Issuer, Audience, Client, Subject und Ablauf und gibt anschließend den Benutzer zurück. Der Session-Control-State wird nicht gelesen.
- `packages/auth-runtime/src/middleware.ts:101–121` übernimmt diesen Bearer-Pfad mit der künstlichen Session-ID `personal-api-token`. Die Browser-Session-Auflösung mit Sperrprüfung wird dabei nicht ausgeführt.
- `packages/auth-runtime/src/middleware-guards.ts:54–62`: `ensureAccountLifecycleAllowsAccess` ist ein No-op und liefert immer `null`.
- `packages/auth-runtime/src/effective-session-roles.ts:35–76` lädt Rollen ohne Prüfung des Account-Status. Auch die regulären Permission-Abfragen in `packages/auth-runtime/src/iam-authorization/permission-store.queries.ts:214–216` und `:291–293` prüfen den Lebenszyklus nicht. Die strengeren Bedingungen des separaten Directory-Exports bei `:119–127` gelten hier nicht.
- `packages/iam-admin/src/actor-resolution-query.ts:10–17` prüft die Mitgliedschaft, aber ebenfalls keinen aktiven Kontostatus.
- `packages/iam-admin/src/user-deactivate-handler.ts:170–179` setzt `status = 'inactive'`, erhält die Rollenzuordnungen und sperrt anschließend bei `:226` die Browser-Sessions. Ein Permission-Cache-Refresh allein beseitigt den Befund deshalb nicht.
- `packages/auth-runtime/src/iam-account-management/core.ts:39–46`, `:94–106` erlaubt persönliche Tokens ausdrücklich auf mehreren IAM-Routen. `user-read-shared.ts:28–64` im selben Ordner verwendet die genannten Berechtigungs- und Mitgliedschaftspfade.

**Voraussetzungen und Grenzen:** Der persönliche MCP-Client muss in der Umgebung aktiviert sein; ein Benutzer oder Tokenbesitzer muss ein bereits gültiges Token besitzen. Ein neuer Login nach Deaktivierung ist hierfür nicht erforderlich. Das Fenster endet spätestens mit dem Tokenablauf. Die aktuelle produktive Token-Laufzeit und Client-Aktivierung wurden nicht ausgelesen. Ein realer deaktivierter Account wurde nicht verwendet.

**Lokaler Nachweis:** Original-Authenticator und originale Rollenhydration wurden speicherintern mit echter `jose`-JWT-Verifikation ausgeführt. Issuer/JWKS und DB-/Host-Abhängigkeiten waren synthetisch; die Account-Fixture repräsentierte ein inaktives Konto mit erhaltener Rolle. Ergebnis: authentifiziert, Rolle `system_admin`, null Aufrufe der bereitgestellten gesperrten Session-Control-Abhängigkeit, keine aktive Statusbedingung in der Rollenabfrage. Dies bestätigt den Kontrollfluss, ersetzt aber keinen vollständigen Test mit Keycloak und PostgreSQL.

**Kleinste sinnvolle Behebung:** Im bestehenden persönlichen Auth-Pfad Kontosperre und aktuellen Account-Lebenszyklus verbindlich prüfen und bei nicht verifizierbarem Zustand verweigern. Rollen-/Permission-Pfade auf dieselbe Invariante prüfen. Keine zweite Auth-Infrastruktur aufbauen. Als Nachweis einen Test „Token ausstellen → Account deaktivieren → dasselbe Token auf erlaubter IAM-Route ablehnen“ einschließlich Datenbankpfad ergänzen.

OWASP verlangt durchgängige aktuelle Autorisierung und beschreibt die Entkopplung gültiger JWTs vom inzwischen beendeten Sessionzustand ausdrücklich. Siehe [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#validate-the-permissions-on-every-request) und [REST Security: JWT](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#jwt).

### F02: Unbegrenztes Puffern öffentlicher Request-Bodies

**Auswirkung:** Anonyme Clients können den Arbeitsspeicher des öffentlichen Kalenderprozesses durch große oder mehrere gleichzeitige Requests erschöpfen.

**Beleg:** `apps/public-waste-calendar-web/src/server/public-waste-http-server.ts:17–24` sammelt alle Chunks in einem Array und erstellt danach einen weiteren zusammenhängenden Buffer. `:49–54` liest den vollständigen Body vor der fachlichen Route und erzeugt weitere Bytes für den Web-Request. Es gibt weder ein kumulatives Byte-Limit noch eine frühe Ablehnung übergroßer Bodies; unbekannte Pfade durchlaufen dieselbe Annahme.

**Lokaler Nachweis:** Der unveränderte HTTP-Server wurde an einen kurzlebigen Loopback-Port gebunden. Ein begrenzter POST mit 1.048.576 Bytes und Chunked-Encoding auf einen synthetischen unbekannten Pfad erreichte den Runtime-Handler vollständig vor dessen 404-Antwort. Kein Lasttest und kein Speicherabsturz wurden ausgelöst. Zusammen mit der offenen Leseschleife belegt dies die fehlende anwendungsseitige Grenze; der Nachweis behauptet keine gemessene Absturzschwelle.

**Voraussetzungen und Grenzen:** Der Prozess muss erreichbar sein und ein vorgelagerter Proxy darf den Body nicht bereits wirksam begrenzen. Eine solche Grenze war in den untersuchten Deployment-Dateien für diesen Pfad nicht belegt; externe Edge-Konfiguration wurde nicht gelesen.

**Behebung:** Im vorhandenen `readRequestBody` die tatsächlich empfangenen Bytes zählen, früh abbrechen und HTTP 413 liefern. Ein `Content-Length`-Check allein genügt für Chunked-Encoding nicht. Methoden-/Routenprüfung möglichst vor dem Puffern. Tests für Grenzwert, Überschreitung und Chunked-Encoding ergänzen.

Siehe [OWASP Denial of Service](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html#software-design-concepts) und [REST Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#input-validation).

## Weitere konkrete Schwächen

### F03: DNS-Rebinding-Lücke im benutzerdefinierten Geocoding

`packages/auth-runtime/src/upstream-url-validation.ts:144–159` löst den Host auf und prüft die IPs. Die Funktion gibt anschließend nur eine URL zurück. `apps/sva-studio-react/src/lib/map-geocoding-api.provider.ts:29–41` nutzt diese Vorprüfung; `:55–58` ruft danach normales `fetch` mit erneuter, ungebundener DNS-Auflösung auf. Auch das erneute Prüfen manueller Redirects bindet die nachfolgende Verbindung nicht an die geprüften Adressen.

**Auswirkung/Voraussetzung:** Wer eine benutzerdefinierte Provider-Domain konfigurieren oder deren DNS kontrollieren kann, kann zwischen Prüfung und Verbindung eine interne Zieladresse liefern. Die Auswirkung hängt von Netzwerkzugang und intern erreichbaren Diensten ab. Die normalen Provider verwenden keine frei durch Benutzer eingegebene Ziel-URL; dieser Befund ist deshalb kein allgemeiner anonymer URL-Proxy.

**Nachweis:** Original-URL-Prüfung und Original-Providerfunktion akzeptierten eine kontrollierte Sequenz aus öffentlicher Prüfadresse und Loopback-Verbindungsadresse. DNS und Fetch waren vollständig simuliert; es gab keinen realen internen Netzwerkzugriff. Die Simulation zeigt die fehlende Bindung und ist kein Live-Exploit.

**Behebung:** Den bestehenden Transport mit IP-Prüfung beim Socketaufbau verwenden beziehungsweise passend erweitern. `packages/server-runtime/src/server/public-https-fetch.server.ts:30–45` implementiert diese Bindung bereits für öffentliche HTTPS-Ziele. Der Geocoding-Pfad erlaubt gegenwärtig auch HTTP und bewusste private Zielausnahmen; deren Vertragsverträglichkeit ist vor Wiederverwendung zu klären. [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

### F04: DOI-Hash kann als Bestätigungstoken wiederverwendet werden

`apps/public-waste-calendar-web/src/server/public-waste-email-reminders-signup-support.server.ts:75–78` reicht Eingaben im Format `sha256:<64 Hexzeichen>` ungehasht weiter. `public-waste-email-reminders-pages.server.ts:58–60` im selben Ordner verwendet dies für die öffentliche DOI-Bestätigung. `packages/waste-management-runtime/src/repositories/email-reminders.tokens.ts:19–26` sucht exakt nach diesem gespeicherten Hash.

**Auswirkung/Voraussetzung:** Wer einen gespeicherten DOI-Hash aus einem lesenden Datenbankzugang oder einer Sicherung erhält, kann ihn ohne ursprünglichen E-Mail-Token zur Aktivierung verwenden. Damit entfällt der vorgesehene Schutz der Hashspeicherung. Ein Hash-Abfluss wurde nicht gefunden; die Token sind kryptografisch zufällig und nicht praktisch erratbar. Die signierte Abmeldung ist ein anderer Pfad und wird durch diesen Befund nicht als umgehbar behauptet.

**Nachweis:** Direkte Ausführung der Originalfunktion mit einem synthetischen Token ergab sowohl für den Originaltoken als auch für dessen gespeicherten Hash denselben Suchwert. Nochmaliges Hashen des Hashes ergab erwartungsgemäß einen anderen Wert.

**Behebung:** Öffentliche Token-Eingaben immer hashen; die Unterstützung bereits gehashter Eingaben an dieser Vertrauensgrenze entfernen. Regressionstest mit einem echten 64-stelligen SHA-256-Hash ergänzen. Die OWASP-Grundsätze sicherer URL-Token werden hier auf DOI übertragen; das verlinkte Cheat Sheet behandelt selbst Passwort-Reset: [Forgot Password: URL Tokens](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens).

### F05: Geocoding-Limit ist konfigurierbar, wird aber interaktiv nicht durchgesetzt

`apps/sva-studio-react/src/lib/map-geocoding-api.operations.ts:73` übernimmt `rateLimitPerMinute`. Der interaktive Ablauf bei `:214–246` authentifiziert und autorisiert, lädt die Konfiguration und führt die Operation aus, ohne einen Rate-Limiter zu konsumieren. `:277` protokolliert den Wert nur. Die direkten Provideraufrufe bei `:315`, `:330` und `:348` setzen das Limit ebenfalls nicht um. Der gesonderte Postleitzahl-Batchpfad gibt ein Limit an seinen Verbraucher weiter; das ersetzt kein Limit auf dem interaktiven API-Pfad.

**Auswirkung/Voraussetzung:** Ein angemeldeter Benutzer mit passenden Bearbeitungsrechten kann Providerkontingente/Kosten und Serverressourcen über das angezeigte Limit hinaus beanspruchen. Ein vom Provider geliefertes 429 wird zwar behandelt, stellt aber keine Studio-seitige Durchsetzung dar.

**Nachweis:** Der originale `runSuggestOperation`-Ablauf ließ bei synthetischer Konfiguration `rateLimitPerMinute = 1` drei unmittelbare Anfragen durch; alle drei erreichten den simulierten Provider. Auth, Konfiguration und Provider wurden lokal ersetzt, keine kostenpflichtigen Aufrufe ausgeführt.

**Behebung:** Im bestehenden gemeinsamen Operationspfad vor dem Providerzugriff mandanten-/akteurbezogen begrenzen und 429 liefern. Für mehrere Replikate muss das Budget gemeinsam gelten. Die anderen untersuchten IAM- und Reminder-Limiter nutzen ebenfalls prozesslokale Maps (`packages/auth-runtime/src/shared/rate-limit.ts:65` und `apps/public-waste-calendar-web/src/server/public-waste-email-reminders-signup-support.server.ts:94`); sie sind daher keine installationsweite Rate-Garantie. [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html#api-keys), [Denial of Service](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html).

## Im Zielbetrieb zu prüfen

### F06: Kein belegter zentraler CSP- und Framing-Schutz für Studio-HTML

`apps/sva-studio-react/src/server.ts:333–364` und die dort verwendete Response-Finalisierung setzen keine zentrale CSP oder Framing-Policy. `src/routes/__root.tsx:219–223` derselben App rendert ein festes Inline-Theme-Skript ohne Nonce. Die Repository-Suche fand entsprechende Header vor allem auf den gesonderten MCP-Loginseiten und einzelnen Downloadantworten. Auch die statische HTML-Auslieferung des öffentlichen Kalenders setzt bei `apps/public-waste-calendar-web/src/server/public-waste-runtime-http.server.ts:118–124` nur den Content-Type.

**Bewertung:** Belegte Lücke der untersuchten App-/Deployment-Konfiguration, aber kein bestätigter fehlender Produktionsheader und kein nachgewiesenes XSS. Der Reverse Proxy kann Header außerhalb des Repositories hinzufügen. SameSite-Cookies und SSO-Verhalten beeinflussen zusätzlich reale Framing-Angriffe.

**Nächster Nachweis:** Mit freigegebenem Zielhost die tatsächlichen HTML-Antworten einschließlich eingeloggter Seiten, Fehlerseiten und Redirect-Zielen auf CSP, `frame-ancestors`, `nosniff` und Referrer-Policy prüfen. Falls die Policy tatsächlich fehlt, im bestehenden Response-/Proxy-Pfad ergänzen und benötigte Inline-Skripte gezielt über Nonces oder Hashes zulassen. Eine pauschale Freigabe aller Inline-Skripte würde den Schutz schwächen. [OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).

## Nachrangige Härtung

### F07: Veränderliche Action-Tags im Build und Rollout

`.github/workflows/build.yml:131–142` nutzt etwa `docker/login-action@v4`, `docker/setup-buildx-action@v4` und `docker/build-push-action@v5`. `.github/workflows/promote.yml:422` nutzt `hostwithquantum/setup-quantum-cli@v2.0.0` mit Deployment-Berechtigung. Auch ein vollständiger Versionstag ist veränderlich.

Ein kompromittiertes Action-Repository oder verschobener Tag kann dadurch bei unverändertem Studio-Commit anderen Code ausführen. Es gibt keinen Nachweis einer kompromittierten Action. Bestehende Workflowdateien auf verifizierte vollständige Commit-SHAs pinnen und Updates weiterhin über die vorhandene Dependency-Pflege führen. Kein zusätzlicher Workflow erforderlich. [OWASP GitHub Actions Security](https://cheatsheetseries.owasp.org/cheatsheets/GitHub_Actions_Security_Cheat_Sheet.html#always-pin-all-action-and-reusable-workflow-versions-with-a-commit-hash-and-check-for-impostor-commits).

### F08: Security-Richtlinien enthalten überholte Supabase-Annahmen

`DEVELOPMENT_RULES.md:938` behauptet automatische CSRF-Absicherung durch Supabase; `:944` und `:954` beschreiben Supabase-Client beziehungsweise Supabase Auth als maßgebliche Implementierung. Der geprüfte zentrale Pfad verwendet jedoch Keycloak/OIDC, Redis-Sessions und eigene PostgreSQL-Abfragen.

Das ist ein Dokumentationsrisiko: Die Checkliste kann einen Schutz suggerieren, der in der tatsächlichen Runtime explizit implementiert und getestet werden muss. Es ist kein Beleg fehlenden CSRF-Schutzes: `packages/auth-runtime/src/shared/request-security.ts` enthält reale Header- und Origin-Prüfungen. Die bestehenden Regeln gezielt auf die implementierten Kontrollpunkte aktualisieren. [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Bereits vorhandene Schutzmaßnahmen und verbleibende Prüflücken

| Themenfeld | Beobachtung im untersuchten Pfad | Grenze der Aussage |
| --- | --- | --- |
| OAuth/OIDC | `auth-server/login.ts:29–63`: PKCE S256, zufälliger State und Nonce; Callback prüft den Scope. | Keycloak-MFA, aktive Flows und produktive Clientkonfiguration nicht live geprüft. [OWASP OAuth2](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html) |
| Browser-Sessions | HttpOnly, produktiv Secure und SameSite=Lax in `auth-route-cookies.ts:6–14`; absolute Laufzeit in `auth-server/shared.ts:66–79`; Redis-Sperre im Browserpfad. | F01 betrifft den persönlichen Bearer-Pfad. Ein eigener serverseitiger Inaktivitäts-Timer war in der Stichprobe nicht erkennbar; mit Keycloak-Timeouts abgleichen. [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) |
| CSRF | Custom-Header plus Origin-/Referer-Prüfung; zentrale Prüfung bei mutierenden Plugin-Handlern. | Keine vollständige Matrix aller REST- und Server-Function-Routen; insbesondere kostenverursachende Leseoperationen gesondert betrachten. |
| Mandantentrennung/Autorisierung | Hostprüfung, instanzgebundene DB-Pfade, RLS im Schema, zentraler Plugin-Dispatcher; Permission-Auflösungsfehler verweigern Zugriff. | Stichprobe; keine vollständige horizontale IDOR-/Organisationsmatrix und kein aktueller DB-Rollenaudit. [Multi Tenant Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) |
| SQL-Injection | Untersuchte Permission- und Reminderwerte sind parametrisiert; dynamische Schemanamen werden validiert/quotiert. | Keine pauschale Freigabe aller Queries. Frühere Scanner-Hinweise wurden nicht als aktuelle bestätigte Findings übernommen. [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) |
| HTML/XSS | Rich-Text verwendet `sanitize-html`/DOMPurify; Rechtstexte werden zusätzlich gefiltert. Kein belegter unkontrollierter HTML-Sink in der Stichprobe. | Der eigene Browser-Rechtstextfilter wurde nicht mit einem vollständigen mXSS-Korpus geprüft. F06 bleibt offen. |
| Medienuploads | `iam-media/processing.ts`: Größenvergleich, Dateityperkennung, Bildparser und Quarantäne-Scan; private Storage-Pfade vorhanden. | Scanner ist konfigurationsabhängig; Aktivierung, Signaturaktualität und anonyme Bucket-Sperren nicht live geprüft. [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) |
| Kryptografie/Secrets | `core/src/security/field-encryption.ts`: AES-256-GCM, zufällige IVs, Tag, Key-ID und optionale AAD. Persönliche MCP-Sessions sind über den macOS-Keychain-Adapter vorgesehen. | Kein Zugriff auf reale Schlüssel, keine Schlüsselrotation und kein vollständiger Secret-Scan der Git-Historie. |
| Logging/Fehler | Zentraler Serverlogger und abstrahierte API-Fehler; Request-Finalisierung reduziert variable Pfade. | Einige Debugpfade enthalten Personenkennungen/rohe Fehlertexte; produktive Flags und redigierte reale Logbeispiele nicht geprüft. [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) |
| Supply Chain | CodeQL-Workflow und vorhandene Dependency-/CI-Prozesse sind im Repository vorhanden. | Kein aktueller erfolgreicher Scan oder CVE-freier Dependency-Stand behauptet; F07 bleibt bestehen. |

## Durchgeführte Nachweise

- F01: speicherinterne Ausführung mit synthetischen JWT-/DB-/Host-Abhängigkeiten; keine Konten oder Dienste verändert.
- F02: eine begrenzte 1-MiB-Anfrage an den echten lokalen HTTP-Adapter; Server danach geschlossen.
- F03: Originalfunktionen mit simulierter zweiter DNS-Antwort; kein Netzwerkverkehr.
- F04: direkte Originalfunktion mit synthetischem Token und dessen Hash.
- F05: drei Aufrufe im Original-Operationspfad bei synthetischem Limit 1/min; Provider simuliert.
- Gezielte vorhandene Tests: Auth-Runtime 38/38; öffentlicher Kalender 34/34; Geocoding 21/21. Insgesamt 93 erfolgreiche Tests in sieben Dateien.

Auth-Testbefehl:

```sh
pnpm nx run auth-runtime:test:unit --testFiles=src/personal-api-auth.test.ts --testFiles=src/iam-account-management/csrf.test.ts --testFiles=src/auth-server/session.test.ts --testFiles=src/upstream-url-validation.test.ts
```

Öffentliche Adapter-/Reminder-Tests wurden über das bestehende Nx-Target mit dem vorhandenen `run-vitest-target.ts` als Command-Override ausgeführt, damit die vorgeschriebenen `--testFiles`-Argumente auch für diesen sonst direkt an Vitest delegierenden Target präzise umgesetzt werden. Abhängigkeits-Builds wurden ausgelassen; Quellcode und Testdateien blieben unverändert:

```sh
pnpm nx run public-waste-calendar-web:test:unit --excludeTaskDependencies --command='pnpm exec tsx ../../scripts/ci/run-vitest-target.ts --config vitest.config.ts' --testFiles=src/server/public-waste-http-server.test.ts --testFiles=src/server/public-waste-email-reminders.server.test.ts
```

Ein erster Geocoding-Dateifilter im UI-Target fand wegen dessen enger Include-Liste keine Tests und zählt nicht als Nachweis; dafür wird das zuständige Hooks/Lib-Target verwendet. Grüne Bestandstests widerlegen die Befunde nicht: Die neuen Negativfälle sind darin nicht abgedeckt. Die isolierten In-Memory-Prüfungen wurden als einmalige lokale Kommandos ausgeführt; es wurden keine neuen Test-, Skript- oder Infrastrukturpfade angelegt.

Erfolgreicher Geocoding-Testbefehl:

```sh
pnpm nx run sva-studio-react:test:unit:hooks --excludeTaskDependencies --testFiles=src/lib/map-geocoding-api.test.ts
```

## Empfohlene Reihenfolge

1. F01 im bestehenden Auth-/IAM-Pfad beheben und mit Kontodeaktivierung plus realem Permission-Read nachweisen.
2. F02 im vorhandenen HTTP-Adapter begrenzen; anschließend F03, F04 und F05 jeweils eng abgegrenzt beheben.
3. F06 durch freigegebene Runtime-/Edge-Prüfung entscheiden; keine vorsorgliche CSP ausrollen, die SSO oder SSR-Skripte blockiert.
4. F07 und F08 in den bestehenden Dateien pflegen.

Zum Zeitpunkt der ursprünglichen Prüfung war dieser Bericht lokal und unveröffentlicht. Zu diesem Prüfstand waren keine Produktionsänderungen, Branch-Pushes, Issues oder Advisories erstellt und keine Codekorrekturen vorgenommen worden. Der spätere Implementierungsstand ist im OpenSpec-Change `harden-owasp-security-boundaries` dokumentiert.
