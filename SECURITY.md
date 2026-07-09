# Sicherheitsrichtlinie

Diese Richtlinie beschreibt den verbindlichen Melde- und Bearbeitungsprozess für Sicherheitslücken in SVA Studio.

## Zweck und Geltungsbereich

- Sie gilt für den aktiv gepflegten Stand auf `main`.
- Sie deckt Anwendungscode, Infrastrukturdefinitionen im Repository, Build-Konfiguration und dokumentierte Betriebsprofile ab.
- Sie ersetzt keine Incident-Kommunikation für laufende Ausfälle. Dafür gilt [`docs/guides/incident-response.md`](./docs/guides/incident-response.md).

## Unterstützte Stände

SVA Studio befindet sich laut [README.md](./README.md) im Status `early development`.

| Stand | Security-Fixes |
| --- | --- |
| `main` | Ja |
| aktive Pull Requests vor Merge | nach bestem Aufwand |
| ältere Branches, lokale Forks, historische Tags oder experimentelle Stände | Nein, nur nach separater Entscheidung |

Sicherheitskorrekturen werden primär für den aktuellen Stand auf `main` umgesetzt.

## Schwachstellen melden

Bitte keine öffentlichen GitHub Issues für Sicherheitslücken anlegen.

Bevorzugte Meldewege:

1. GitHub Private Vulnerability Reporting bzw. Security Advisory dieses Repositories
2. Fallback per E-Mail an `security@smart-village.app`

Die Meldung sollte möglichst enthalten:

- betroffene Komponente, Datei, Route oder Betriebsfunktion
- betroffenen Commit, Branch oder Image-Tag
- reproduzierbare Schritte, Beispiel-Request oder Proof of Concept
- erwartetes und tatsächliches Verhalten
- Auswirkungen auf Vertraulichkeit, Integrität oder Verfügbarkeit
- bekannte Mitigations oder einen möglichen Fix-Vorschlag
- betroffene Konfiguration oder Betriebsumgebung

Bitte keine produktiven Geheimnisse, Zugangsdaten oder personenbezogenen Daten ungeschützt mitsenden.

## Reaktionszeiten

| Schritt | Zielwert |
| --- | --- |
| Eingangsbestätigung | innerhalb von 3 Werktagen |
| Erste Triage | innerhalb von 7 Kalendertagen |
| Status-Update bei längerer Bearbeitung | mindestens alle 14 Kalendertage |

Die Zielwerte sind Service-Ziele, keine Garantien für einen Fix innerhalb eines festen Zeitraums.

## Bearbeitungsablauf

### 1. Eingang und Validierung

- Neue Meldungen werden vertraulich erfasst.
- Wir prüfen Reproduzierbarkeit, betroffene Versionen und Schweregrad.
- Offensichtliche Duplikate werden zusammengeführt.

### 2. Triage

- Kritische Auswirkungen auf Authentisierung, Autorisierung, Geheimnisse, PII oder Produktionsverfügbarkeit werden priorisiert.
- Falls die Meldung auch Datenschutz oder Incident-Kommunikation betrifft, wird zusätzlich `operations@smart-village.app` eingebunden.

### 3. Behebung und Mitigation

- Fixes werden bevorzugt außerhalb öffentlicher Diskussionen vorbereitet.
- Wenn kein sofortiger Fix möglich ist, dokumentieren wir eine Mitigation oder einen Workaround.
- Nicht-sensitive Folgearbeiten dürfen nach der ersten Absicherung als normale GitHub Issues nachgezogen werden.

### 4. Veröffentlichung

- Nach Freigabe veröffentlichen wir eine abgestimmte Offenlegung über GitHub Security Advisories oder Release Notes.
- Credits für meldende Personen werden nur nach ausdrücklicher Zustimmung genannt.

## Advisory-, CVE- und Disclosure-Policy

- GitHub Security Advisories sind der Standardkanal für koordinierte Offenlegung.
- Eine CVE wird dann beantragt oder referenziert, wenn Reichweite, Nachnutzbarkeit oder externe Kommunikation das sinnvoll machen.
- Vor der Veröffentlichung stimmen wir einen Disclosure-Zeitpunkt ab, sofern die meldende Person erreichbar ist.
- Öffentliche Details sollen erst erscheinen, wenn ein Fix oder mindestens eine belastbare Mitigation verfügbar ist.

## Sicherheitsgrenzen des Produkts

Diese Datei definiert die maßgebliche Trust Boundary für dieses Repository.

### Als untrusted Input behandeln wir insbesondere

- anonyme oder authentisierte HTTP-Requests aus produktiven oder produktionsnahen Oberflächen
- Request-Body, Query-Parameter, Path-Parameter, Header und Cookie-Inhalte
- Inhalte aus externen Systemen, Schnittstellen, Webhooks und Imports
- von Endnutzer:innen hochgeladene Dateien und Inhalte
- tenant-lokale Daten, sofern sie in sicherheitsrelevante Entscheidungen einfließen

### Als privilegierte oder trusted Operator-/Admin-Eingaben behandeln wir insbesondere

- Deployment- und Laufzeit-Environment-Variablen
- manuell gepflegte Infrastruktur- und Integrationskonfiguration
- lokale CLI-Argumente für `scripts/ci/`, `scripts/ops/` und `scripts/debug/`
- bewusst von System- oder Integrationsadministrator:innen gesetzte Upstream-, Endpoint-, Datenbank- oder Bucket-Konfigurationen

Das bedeutet nicht, dass solche Pfade keine Risiken haben. Sie sind aber primär als privilegierte Konfigurations- oder Operator-Pfade und nicht als öffentliche, low-privilege Angriffspfade zu bewerten.

## In Scope

Im Scope für sicherheitsrelevante Befunde sind insbesondere:

- produktive Serverrouten und serverseitige Actions
- Authentisierung, Autorisierung, Mandantentrennung und Session-Handling
- Persistenz-, Export-, Import- und Medienpfade
- Schnittstellen zu externen Produktivsystemen
- serverseitige Verarbeitung untrusted Inputs
- sicherheitsrelevante Fehlkonfigurationen in shipped Code und dokumentierten Betriebsprofilen

## Out of Scope oder nur eingeschränkt relevant

Nur eingeschränkt oder standardmäßig nicht als Produkt-Sicherheitslücke zu bewerten sind:

- reine Test-, Fixture-, E2E- und Demo-Dateien
- lokale Entwicklerhilfen und Debug-Skripte
- CI-/Ops-Skripte, deren Eingaben nur durch vertrauenswürdige Maintainer oder Operatoren gesetzt werden
- bewusst administrative Integrationskonfigurationen, sofern kein zusätzlicher Boundary-Bypass für unprivilegierte Nutzer nachweisbar ist

## SSRF- und Egress-Bewertung

Für dieses Repository gilt bei SSRF- und ähnlichen Outbound-Request-Befunden:

- Kritisch ist ein Befund typischerweise dann, wenn untrusted Input aus einer öffentlichen oder niedrig privilegierten Produktoberfläche serverseitig ein Ziel bestimmen oder wesentlich beeinflussen kann.
- Hoch, aber nicht kritisch sind typischerweise privilegierte Admin-/Integrationspfade, in denen Administrator:innen oder Operatoren serverseitige Ziele konfigurieren können und diese Konfiguration anschließend Requests auslöst.
- Reine Browser-Fetches, relative `/api`-Aufrufe und lokal betriebene Test-/Ops-Skripte sind keine SSRF-Produktbefunde.

## Responsible Disclosure

- Keine öffentliche Offenlegung vor abgestimmter Freigabe
- Keine Zugriffe auf Daten Dritter
- Keine dauerhafte Beeinträchtigung von Produktivsystemen
- Tests nur im zur Validierung erforderlichen Umfang

## Weitere Grenzen

- Es gibt kein öffentliches Bug-Bounty-Programm.
- Themen rund um Supply Chain, Build-Härtung, Secret-Rotation oder externe SaaS-Abhängigkeiten können Folgearbeit erfordern, auch wenn die Erstmeldung validiert ist.
- Third-Party-Schwachstellen ohne ausnutzbaren Projektbezug werden als Abhängigkeits- oder Upgrade-Thema behandelt.

## Fixes und Dokumentation

- Sicherheitsfixes sollten von passenden Tests, Reproduktionsschritten oder klarer Validierung begleitet sein.
- Wenn eine Schwachstelle auch Betriebs- oder Architekturannahmen betrifft, werden die zugehörigen Dokumente im Repository mit aktualisiert.

## Verweise

- GitHub-Einstieg: [`.github/SECURITY.md`](./.github/SECURITY.md)
- ausführliche Richtlinie: [`docs/guides/security-policy.md`](./docs/guides/security-policy.md)
- Incident-Kommunikation: [`docs/guides/incident-response.md`](./docs/guides/incident-response.md)
