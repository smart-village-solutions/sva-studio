# Angebotsabdeckung durch Meilenstein 1

Stand: `2026-05-25`

## Fragestellung

Dieses Dokument beantwortet die Rückfrage, ob ein vollständig erfolgreich umgesetzter und abgenommener **Meilenstein 1** den fachlichen Leistungsumfang des angebotenen IAM-Ausbaus vollständig abdeckt.

Kurzantwort:

- **Inhaltlich inzwischen sehr weitgehend ja.**
- **Vertrags- und nachweislogisch belastbar, wenn die Angebotskriterien den tragenden Workpackages und den inzwischen vorliegenden WP-Abnahmeartefakten explizit zugeordnet werden.**

## Ausgangspunkt

Das Angebot ist in fünf fachliche Leistungspakete gegliedert:

1. Architektur & Basis-IAM-Inkrement
2. Accounts & Organisationen
3. Rollenmodell, Gruppen & Vererbungen
4. Permission Engine & High-Performance AuthZ
5. Rechtstexte & Akzeptanzsystem

Der Projektstatus in [apps/project-report/src/data/project-status.json](../../apps/project-report/src/data/project-status.json) schneidet denselben Themenraum anders, nämlich in technische und fachliche Workpackages innerhalb von Meilenstein 1.

## Rückrichtung: Angebot zu Meilenstein 1

| Angebots-Paket | Führende Workpackages in M1 | Ergänzende Workpackages in M1 | Einschätzung |
| --- | --- | --- | --- |
| 1. Architektur & Basis-IAM-Inkrement | `WP-001` | `WP-013`, teilweise `WP-014` | fachlich abgedeckt, Architekturanteil ist nicht als eigenes WP isoliert |
| 2. Accounts & Organisationen | `WP-002`, `WP-003` | `WP-011`, teilweise `WP-014` | fachlich abgedeckt |
| 3. Rollenmodell, Gruppen & Vererbungen | `WP-005` | `WP-003`, `WP-004`, `WP-011` | fachlich abgedeckt, aber über mehrere WPs verteilt |
| 4. Permission Engine & High-Performance AuthZ | `WP-004` | `WP-015`, `WP-016`, `WP-017`, `WP-020` | fachlich abgedeckt |
| 5. Rechtstexte & Akzeptanzsystem | `WP-006`, `WP-010` | teilweise `WP-007` | fachlich abgedeckt |

## Bewertung

Wenn **alle für IAM relevanten Workpackages in Meilenstein 1** erfolgreich abgeschlossen und abgenommen sind, ist der fachliche Kern des Angebots im Regelfall mit abgedeckt.

Zum Stand `2026-05-25` ist diese Aussage stärker belastbar als in früheren Zwischenständen, weil für die zentralen IAM-Kernpakete inzwischen eigenständige WP-Abnahmeprotokolle vorliegen und damit die Rückrichtung zwischen Angebotslogik und technischer Lieferlogik deutlich sauberer referenzierbar ist.

Dazu zählen insbesondere:

- `WP-001` Authentifizierung und Sicherheit unter Berücksichtigung von Mandantenfähigkeit
- `WP-002` Benutzer-Accounts und Profile mit Organisations-Hierarchie
- `WP-003` Organisation und Struktur
- `WP-004` Permission Engine
- `WP-005` Rollen- und Rechtemanagement via Keycloak
- `WP-006` Datenschutz und Compliance
- `WP-010` Rechtstexte

Ergänzend stützen diese Workpackages die Angebotsabdeckung technisch oder betrieblich:

- `WP-011` Basis-UI & Navigation
- `WP-013` Keycloak
- `WP-014` Main-Server
- `WP-015` OTEL
- `WP-016` Grafana
- `WP-017` Loki
- `WP-020` Monitoringsystem

## Nicht notwendige oder nur randständige M1-Pakete

Nicht jedes Workpackage in Meilenstein 1 ist notwendig, um das Angebot fachlich abzudecken.

Insbesondere diese Pakete sind eher flankierend, optional oder thematisch außerhalb des engeren Angebotskerns:

- `WP-007` Audit-Log
- `WP-008` Datenlöschkonzept
- `WP-009` Nachrichten (MVP)
- `WP-012` E-Mail-Server
- `WP-018` News-Modul
- `WP-019` Dokumentation der Funktionalitäten und Entwicklungen des Moduls
- `WP-021` Redaktion über die App

Wenn also **wirklich jedes** Workpackage aus Meilenstein 1 abgenommen ist, ist das Angebot damit erst recht inhaltlich mit umfasst. Umgekehrt ist aber nicht jedes dieser Workpackages zwingend erforderlich, um das Angebot selbst als erfüllt zu betrachten.

## Grenzen der Aussage

Die Aussage "Meilenstein 1 vollständig abgenommen" ist nicht automatisch identisch mit der Aussage "Angebot vollständig und vertragsfest nachgewiesen erfüllt".

Die wesentlichen Gründe:

- Das Angebot ist nach fünf fachlichen Paketen strukturiert.
- Der Projektstatus ist nach technischen Workpackages strukturiert.
- Einzelne Angebotskriterien sind auf mehrere Workpackages verteilt.
- Einige Angebotskriterien verlangen explizite End-to-End- oder Zielumgebungsnachweise.

Deshalb reicht ein pauschal grüner M1-Status allein für eine belastbare Angebotsabnahme nur dann aus, wenn zusätzlich die Nachweise je Angebotspaket referenzierbar sind.

Genau diese Referenzierbarkeit ist mit dem aktuellen Stand für die IAM-Kernpakete deutlich verbessert: Die Nachweise liegen nicht mehr nur als Sammelberichte, sondern zusätzlich als explizite WP-Abnahmeprotokolle vor.

## Bereits vorhandene Stützartefakte

- M1-Umsetzungsbericht: [docs/reports/cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md](./cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md)
- Abnahmeartefakte für Angebotsbausteine 3 bis 5: [docs/reports/2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md](./2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md)
- WP-001-Nachweis: [docs/reports/wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md](./wp-001-auth-mandantenfaehigkeit-abnahme-2026-05-25.md)
- WP-002-Nachweis: [docs/reports/wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md](./wp-002-benutzer-accounts-profile-abnahme-2026-05-25.md)
- WP-003-Nachweis: [docs/reports/wp-003-organisation-struktur-abnahme-2026-05-25.md](./wp-003-organisation-struktur-abnahme-2026-05-25.md)
- WP-004-Nachweis: [docs/reports/wp-004-permission-engine-abnahme-2026-05-25.md](./wp-004-permission-engine-abnahme-2026-05-25.md)
- WP-004-Performance-Nachweis: [docs/reports/wp-004-permission-engine-performance-nachweis-2026-05-25.md](./wp-004-permission-engine-performance-nachweis-2026-05-25.md)
- WP-005-Nachweis: [docs/reports/wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md](./wp-005-rollen-rechte-keycloak-abnahme-2026-05-25.md)
- WP-006-Nachweis: [docs/reports/wp-006-datenschutz-compliance-abnahme-2026-05-25.md](./wp-006-datenschutz-compliance-abnahme-2026-05-25.md)

## Fazit

Für die Rückrichtung gilt:

- Wenn alle **angebotrelevanten** Workpackages von Meilenstein 1 erfolgreich abgeschlossen und abgenommen sind, ist das Angebot **inhaltlich sehr weitgehend abgedeckt**.
- Wenn sogar **alle** Workpackages von Meilenstein 1 abgenommen sind, ist das Angebot damit **erst recht inhaltlich umfasst**.
- Für eine saubere vertragsseitige Abnahme sollte zusätzlich je Angebots-Paket ein expliziter Verweis auf die tragenden Workpackages und die konkreten Abnahmeartefakte geführt werden.

Zum Stand `2026-05-25` ist die Rückrichtung damit nicht mehr nur eine grobe fachliche Plausibilisierung, sondern bereits eine belastbare Zuordnung auf Basis konkreter WP-Abnahmeartefakte. Die größte Restvorsicht liegt weniger in der inhaltlichen Abdeckung von Meilenstein 1, sondern eher in einzelnen formal noch nachzuziehenden End-to-End- oder Zielumgebungsnachweisen innerhalb einzelner WPs wie `WP-006`.
