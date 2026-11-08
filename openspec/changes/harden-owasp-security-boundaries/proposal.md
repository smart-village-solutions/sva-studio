# Change: Belegte OWASP-Schwächen in bestehenden Studio-Pfaden schließen

## Why

Der [OWASP-Prüfbericht vom 8. November 2026](../../../docs/reports/2026-11-08-owasp-cheat-sheet-review.md) beschreibt konkrete Lücken bei Kontosperren persönlicher API-Tokens, öffentlicher Body-Annahme, Geocoding-Transport, DOI-Tokenprüfung und Geocoding-Budgets sowie einen offenen Header-Nachweis und veraltete Sicherheitsrichtlinien. Ziel ist, diese Grenzen mit kleinen Änderungen an den jeweils zuständigen Pfaden und direkten Negativtests abzusichern.

Der Nutzer hat die lokale Umsetzung dieses Plans für **F01–F06 und F08** freigegeben. **F07/GitHub Actions ist ausdrücklich ausgeschlossen.** Die anschließende PR-Erstellung wurde ausdrücklich beauftragt. Externe Live- und Rollout-Aktionen bleiben gesondert freizugeben.

## What Changes

| Befund | Geplante Änderung | Bestehender zuständiger Pfad |
| --- | --- | --- |
| F01 | Persönliche Tokens gegen aktuellen Kontostatus und vorhandene Login-Sperren prüfen; inaktive Accounts erhalten auch nach Permission-Neuberechnung keine Freigabe. | `auth-runtime`: persönlicher Auth-Pfad, Lifecycle-Guard, Rollen-/Permission-Reads; `iam-admin`: vorhandene Actor-Auflösung bleibt zur Vermeidung von JIT-Fallthrough unverändert |
| F02 | Öffentliche Request-Bodies während des Lesens auf 64 KiB begrenzen und darüber mit 413 abbrechen. | HTTP-Adapter von `public-waste-calendar-web` |
| F03 | DNS-Prüfung an den tatsächlichen Socketaufbau binden und bei Redirects wiederholen; zulässiges HTTP und explizite private Zielausnahme erhalten. | Bestehendes Outbound-Transportmodul in `server-runtime` und Geocoding-Provider |
| F04 | Öffentliche DOI-Eingaben immer hashen; gespeicherte Hashes nicht als Token akzeptieren. | Vorhandene öffentliche Reminder-Actions |
| F05 | Tatsächliche Geocoding-Provideraufrufe über das vorhandene Redis pro Tenant gemeinsam begrenzen. | Geocoding-Provider und dessen bestehende Verbraucher, Redis-Zugriff in `auth-runtime` |
| F06 | Header-Verantwortung und reale Antworten zunächst belegen; fehlende HTML-Schutzheader im vorhandenen Auslieferungspfad ergänzen und CSP kontrolliert aktivieren. | Studio-Server/SSR, Auth-HTML und öffentlicher HTTP-/HTML-Pfad |
| F08 | Bestehende Security-Checkliste auf Keycloak/OIDC, Redis, PostgreSQL und explizite CSRF-/Permission-Prüfungen korrigieren. | `DEVELOPMENT_RULES.md` und unmittelbar betroffene aktuelle Referenzen |

## Scope und Nicht-Ziele

Der maximale Umsetzungsscope besteht aus den in der Tabelle genannten Quellen und ihren unmittelbar zugehörigen Tests, den vorhandenen API-/Runtime-Dokumentationen und betroffenen arc42-/ADR-Dateien. Die Planung verwendet fünf vorhandene Spec-Capabilities; es entsteht keine neue Capability oder allgemeine Security-Plattform.

- Keine Änderungen an `.github/workflows/**`, `.github/actions/**`, Action-Versionen, CI-Orchestrierung oder GitHub-Berechtigungen; bestehende Gates werden lediglich ausgeführt.
- Keine neuen Packages, Services, Worker, Datenbanktabellen, Migrationen, Tokenclaims, globale Token-Denylist oder zusätzliche Konfigurationsoberfläche. Das vorhandene Redis genügt für F05.
- Keine allgemeine Migration aller IAM-/Reminder-Rate-Limiter. Deren prozesslokale Grenzen bleiben als gesondertes Restrisiko sichtbar; dieser Change liefert das replikaübergreifende Geocoding-Budget.
- Keine neue Session-Timeout-Policy, MFA-Umstellung, vollständige Secret-/CVE-Prüfung oder generelle URL-Transportmigration. Die im Bericht genannten weiteren Stichprobenlücken werden nicht stillschweigend zu neuen Lieferzielen.
- Keine Änderungen am externen SVA Mainserver oder an Keycloak-/Proxy-Konten. Keine automatischen E-Mails, Live-Kontodeaktivierungen, Uploads, Veröffentlichungen oder Rollouts durch diesen Plan.

Die Entfernung der DOI-Hash-Sonderbehandlung ist eine beabsichtigte Sicherheitskorrektur des öffentlichen Eingabevertrags. Regulär ausgestellte E-Mail-Links und gespeicherte Hashwerte behalten ihr Format; die signierte Abmeldung bleibt bestehen.

## Lieferabschnitte und Abhängigkeiten

Ein gemeinsamer Plan, fünf eigenständig prüfbare Lieferabschnitte; kein künstlicher Branch-Stack. Bei späterem PR-Auftrag erhält jeder Abschnitt ein eigenes Ziel, Nicht-Ziele, Tests und aktuelle Dokumentation. Vorhandene Sicherheitslücken dürfen nicht bis zum Header-Abschluss zurückgehalten werden.

| Abschnitt | Verbindliches Ziel | Maximale Codebereiche | Abhängigkeit und Nachweis |
| --- | --- | --- | --- |
| A | F01: Ein deaktivierter Account wird mit einem vorher gültigen persönlichen Token abgewiesen. | `auth-runtime`, unmittelbar nötige Actor-Reads in `iam-admin`; Tests/Doku | Zuerst; echte JWT-Verifikation plus PostgreSQL- und Sperrfehler-Tests |
| B | F02/F04: Öffentliche Bodies bleiben begrenzt, DOI-Hashes ersetzen keine E-Mail-Tokens. | `public-waste-calendar-web`; zugehörige Repository-Tests ohne Vertragsänderung | Von A unabhängig; echter lokaler HTTP-Adapter und Reminder-Aktionspfad |
| C | F03/F05: Geocoding bindet Verbindungen an zulässige IPs und erzwingt ein gemeinsames Budget. | `server-runtime`-Transport, bestehender Redis-Zugriff in `auth-runtime`, Geocoding und dessen Batch-Verbraucher | Von A/B unabhängig; Socket-/Redirecttests und zwei Redis-Verbraucher |
| D | F06: Header werden nach Inventar im zuständigen Pfad wirksam und kompatibel durchgesetzt. | Studio-Server/SSR/Auth-HTML und öffentliche HTML-Auslieferung; bestehende Proxy-Definition nur bei belegter Notwendigkeit | B als Basis für öffentliche 413-Antworten; Live-Teil erst mit benannten und freigegebenen Zielen |
| E | F08: Sicherheitsrichtlinien benennen die wirklich vorhandenen Schutzmechanismen. | `DEVELOPMENT_RULES.md`, betroffene aktuelle Doku/ADRs | Grundkorrektur unabhängig; endgültige Beschreibung nach A–D abgleichen |

## Coordination and Impact

- Auditbasis: `47d82417c2dc7182fc52dc94a0aa71ba4be9bf30`; Planungsbasis: lokales `main` bei `f369f478aaca3c32f3e6bad4dba1f9fb22000130`. Die im Bericht konkret benannten Quellpfade waren beim Anlegen unverändert. Vor jedem Implementierungsabschnitt Befund und aktuellen HEAD erneut prüfen.
- Betroffene bestehende Specs: `iam-core`, `public-waste-calendar`, `sva-mainserver-integration`, `routing`, `architecture-documentation`.
- `harden-studio-access-resilience` bleibt Owner der laufenden Session-/Organisations-/UI-Recovery-Arbeit. F01 ergänzt den persönlichen Bearer-/Kontostatus-Vertrag, verändert aber keine Refresh-, Organisations- oder Browser-Recovery-Semantik. Gemeinsame Auth-Dateien vor A gegen dessen aktuellen Stand prüfen.
- `add-personal-mcp-mainserver-settings` und `add-personal-mcp-keychain-sessions` behalten API-Allowlist und lokalen Token-Lebenszyklus. Der Server prüft F01 unabhängig davon, ob ein Token aus Speicher oder Keychain stammt.
- `add-public-waste-calendar-embed` bleibt Owner des Shadow-DOM-Embeds. D erhält credential-freie CORS-Verträge für öffentliche API/Assets; Framing-Schutz ist keine CORS-Änderung.
- Bestehende Specs enthalten noch Formulierungen zur unveränderten DOI-Tokenverarbeitung. Das Delta ersetzt die betroffene Requirement vollständig und benennt die eng begrenzte Korrektur ausdrücklich.
- Arc42: 04/05/06/08 für A prüfen und betroffene Aussagen aktualisieren, 05/06/08 für B/C/D, 07 für Redis-/Header-Verantwortung und 11 für geschlossene beziehungsweise verbleibende Risiken. ADR-023 und ADR-067 gezielt fortschreiben, soweit ihre Auth-Verträge betroffen sind, und dann 09/ADR-Index aktualisieren. Keine neue ADR-Serie.
- Keine Schemaänderung geplant. Wird sie dennoch nötig, Abschnitt stoppen, Scope neu zuschneiden und vor weiterer Arbeit Schemaübersicht/Snapshot prüfen.
- Maßgeblich für spätere Studio-Rollouts bleibt ausschließlich [studio-rollout-process.md](../../../docs/guides/studio-rollout-process.md); der vorhandene öffentliche Kalender-Releasevertrag bleibt separat erhalten. Keine Action-Datei wird dafür geändert.

## Freigabe- und Nachweisstand

Status: **A–C und E lokal implementiert; D mit vorbereiteter Report-Only-Policy. Lokale Browserfälle sind nachgewiesen; produktive Browser-/Live-/Enforcement-Abnahme steht aus.** Die [Designentscheidungen und Invarianten](./design.md), [Tasks](./tasks.md) und Spec-Deltas beschreiben die geplanten Belege. Audit-Nachweise sind historische Ausgangsevidenz, keine Fix-Verifikation. Formale OpenSpec-Validierung ist eine Planprüfung; spätere Merge-Reife benötigt bestandene direkte Nachweise am exakten Implementierungs-HEAD.

Der vorgeschriebene Proposal-Review durch Security/Architecture, Testqualität/System-Assurance/Operations und Documentation ist abgeschlossen. Notwendige Präzisierung: Tenant-Konten werden persistiert geprüft, Plattformkonten über den gezielten vorhandenen Keycloak-User-Read; es gibt keinen Plattform-Account-Mirror. Der strikte Lifecycle-Modus wird ausschließlich am persönlichen Bearer-Einstieg aufgerufen, um bestehende Browser-/DSR-Semantik einschließlich 423 bei eingeschränkter optionaler Verarbeitung zu erhalten. Die Implementierung muss Redis-503 und 429/Retry-After durch den bestehenden Geocoding-Fehlertransport tragen. Alle übrigen Reviewhinweise sind durch die vorgesehenen direkten Nachweise abgedeckt; keine zusätzliche Kontrollschicht.

Planprüfung am 8. November 2026: `openspec validate harden-owasp-security-boundaries --strict` erfolgreich; sechs Requirements mit 24 Szenarien in fünf bestehenden Capabilities. Relative Links, Erhalt sämtlicher bisherigen Szenarien der modifizierten Requirements und Whitespace wurden geprüft. Die vorhandene Dateiplatzierungsprüfung wurde mit Node-Type-Stripping ausgeführt und zusätzlich um die neun noch unversionierten Plan-/Belegdateien erweitert; keine Platzierungsverletzung. Dies beschreibt ausschließlich den damaligen Planungsstand; die Implementierungsnachweise folgen im Design.
