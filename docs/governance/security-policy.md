# Security Policy

Diese Richtlinie beschreibt den verbindlichen Melde- und Bearbeitungsprozess für Sicherheitslücken in SVA Studio.

## Zweck und Geltungsbereich

- Sie gilt für den aktiv gepflegten Stand auf `main`.
- Sie deckt Anwendungscode, Infrastrukturdefinitionen im Repository, Build-Konfiguration und dokumentierte Betriebsprofile ab.
- Sie ersetzt keine Incident-Kommunikation für laufende Ausfälle. Dafür gilt `./incident-response.md`.

## Unterstützte Stände

| Stand | Security-Fixes |
| --- | --- |
| `main` | Ja |
| ältere Branches oder historische Tags | Nein, nur nach separater Entscheidung |

## Schwachstellen melden

Bitte keine öffentlichen GitHub Issues für Sicherheitslücken anlegen.

Bevorzugte Meldewege:

1. GitHub Private Vulnerability Reporting bzw. Security Advisory dieses Repositories
2. Fallback per E-Mail an `security@smart-village.app`

Die Meldung sollte möglichst enthalten:

- betroffene Komponente, Datei, Route oder Betriebsfunktion
- betroffenen Commit, Branch oder Image-Tag
- reproduzierbare Schritte oder Proof of Concept
- erwartetes und tatsächliches Verhalten
- Auswirkungen auf Vertraulichkeit, Integrität oder Verfügbarkeit
- bekannte Mitigations oder einen möglichen Fix-Vorschlag

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

- Kritische Auswirkungen auf Authentifizierung, Autorisierung, Geheimnisse, PII oder Produktionsverfügbarkeit werden priorisiert.
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

## Was nicht über öffentliche Issues laufen soll

- neue Schwachstellen mit aktivem Exploit-Potenzial
- Datenabfluss, Geheimnisleck, Rechteausweitung oder Umgehung von Authentifizierung
- unbestätigte Hinweise auf DSGVO-relevante Vorfälle

Für diese Fälle immer Advisory oder `security@smart-village.app` verwenden.

## Bekannte Grenzen

- Security-Fixes werden aktuell nur für `main` verbindlich gepflegt.
- Es gibt kein öffentliches Bug-Bounty-Programm.
- Themen rund um Supply Chain, Build-Härtung, Secret-Rotation oder externe SaaS-Abhängigkeiten können Folgearbeit erfordern, auch wenn die Erstmeldung validiert ist.
- Third-Party-Schwachstellen ohne ausnutzbaren Projektbezug werden als Abhängigkeits- oder Upgrade-Thema behandelt.

## Responsible Disclosure

- Keine öffentliche Offenlegung vor abgestimmter Freigabe
- Keine Zugriffe auf Daten Dritter
- Keine dauerhafte Beeinträchtigung von Produktivsystemen
- Tests nur im zur Validierung erforderlichen Umfang

## Verweise

- GitHub-Einstieg: `../../.github/SECURITY.md`
- Incident-Kommunikation: `./incident-response.md`
- Betriebsprofil und Eskalation: `./swarm-deployment-runbook.md`
