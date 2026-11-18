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

Bitte keine öffentlichen GitHub Issues für neue, noch nicht veröffentlichte Sicherheitslücken anlegen. Nicht-sensitive Upgrade-Aufgaben zu bereits öffentlichen Advisories dürfen nach Triage öffentlich verfolgt werden.

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

## Bekannte Befunde und akzeptierte Ausnahmen

Die [Risikoübersicht](../architecture/11-risks-and-technical-debt.md#bekannte-sicherheitsbefunde-und-akzeptierte-ausnahmen) führt relevante öffentlich dokumentierbare Sicherheitsbefunde und akzeptierte Ausnahmen. Sie ist keine vollständige Kopie aller Scanner-Meldungen und kein Nachweis für Schwachstellenfreiheit. README und GitHub-Einstieg verlinken die Übersicht, statt parallele Befundlisten zu pflegen.

- **Dependency-Warnung:** Eine verwendete Version fällt in den Bereich einer Advisory; die Ausnutzbarkeit im Produkt ist noch nicht bestätigt oder wurde im geprüften Umfang nicht nachgewiesen.
- **Bestätigte ausnutzbare Schwachstelle:** Ein konkreter Angriffspfad ist für den angegebenen Produktstand und Betriebsumfang nachgewiesen.
- **Akzeptiertes Restrisiko:** Ein offener Befund wird mit dokumentierter Entscheidung und Endbedingung zeitweise toleriert. Das ist eine Behandlungsentscheidung zusätzlich zum technischen Befundstatus, kein Behebungsnachweis.

Jeder aufgenommene Befund nennt Advisory oder Quelle, betroffene Versionen und Bereiche, Prüfstand und Datum, nachgewiesene Auswirkungen beziehungsweise offene Fragen, Gegenmaßnahmen und deren Grenzen, verantwortlichen Owner, Ticket und nächsten Prüftermin. Bei Ausnahmen werden zusätzlich die Freigabe und eine überprüfbare Endbedingung festgehalten. Der Owner prüft den Eintrag zum Termin sowie bei relevanten Updates und schreibt Behebung und Nachweise fort; ein Datum im Dokument löst keine automatische Erinnerung oder Sperre aus.

Noch nicht veröffentlichte eigene Sicherheitsbefunde bleiben im privaten Melde-/Advisory-Verfahren. Öffentliche Übersicht und Tickets erhalten erst nach abgestimmter Offenlegung entsprechende Details. Bereits öffentliche Third-Party-Advisories dürfen nach Triage als nicht-sensitive Upgrade-Aufgaben verfolgt werden. Audit-Ausnahmen gelten nur für ausdrücklich benannte Advisories und dürfen nicht als pauschale Abschaltung der Sicherheitsprüfung verwendet werden.

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
