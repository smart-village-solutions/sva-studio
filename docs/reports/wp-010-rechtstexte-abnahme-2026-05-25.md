# WP-010 Abnahmeprotokoll: Rechtstexte

## Ausgangslage

- Arbeitspaket: `WP-010`
- Titel: `Rechtstexte`
- Bezugsdatum dieses Protokolls: `2026-05-25`
- Dieses Protokoll bereitet die Kundenabnahme für die Rechtstext-Verwaltung, den blockierenden Akzeptanzflow und die Nachweis-/Exportpfade vor.
- Die Aussagen stützen sich auf vorhandene Architektur-, API-, UI- und Testartefakte zu Versionierung, Pflichtakzeptanz, Consent-Audit, Exportberechtigung und Rücksprunghärtung.

## Abnahmescope

Für `WP-010` gelten in diesem Protokoll folgende Prüfpunkte als maßgeblich:

1. Mindestens zwei unterschiedliche Rechtstexte können versioniert angelegt und bearbeitet werden.
2. Benutzer mit offener Zustimmung werden beim Login oder vor geschützten Pfaden zuverlässig zur Akzeptanz gezwungen.
3. Akzeptanzen werden mit Datum und Versionsbezug unveränderbar protokolliert.
4. Nachweise akzeptierter Rechtstexte können für berechtigte Benutzer exportiert werden.
5. Der Rücksprung nach erzwungener Akzeptanz bleibt auf interne Zielpfade begrenzt.

## Ergebnis

`WP-010` ist zum Bezugsdatum `2026-05-25` **repo-seitig weitgehend umgesetzt und für die Kundenabnahme fachlich gut vorbereitet**.

Die technische Nachweislage für Rechtstext-Verwaltung, blockierenden Akzeptanzflow, Consent-Export und Rücksprunghärtung ist belastbar. Für eine vollständig geschlossene formale Abnahme fehlen aktuell aber noch die bereits im Projektstatus benannten Zielumgebungs- und Negativnachweise, insbesondere für den finalen blockierenden End-to-End-Flow und den Exportpfad ohne Exportberechtigung.

## Kurzfazit für den Kundentermin

- Rechtstexte werden nicht nur technisch verwaltet, sondern als fachliche Inhalte mit Version, Sprache, Status und Veröffentlichungsdatum gepflegt.
- Offene Pflicht-Rechtstexte blockieren geschützte Zugriffe serverseitig und führen den Benutzer in einen klaren Akzeptanzflow.
- Akzeptanzereignisse sind mit revisionsrelevanten Feldern für Version, Zeitpunkt und Zielkontext modelliert.
- Exportpfade für Zustimmungsnachweise sind explizit berechtigungsgebunden.
- Der Rücksprung nach erfolgreicher Akzeptanz ist gegen externe oder unzulässige Ziele gehärtet.

## Empfohlener Ablauf im Kundengespräch

1. Kurze Einordnung des Scopes von `WP-010`
2. Vorführung der Rechtstext-Verwaltung im Admin-Bereich
3. Vorführung oder Erläuterung des blockierenden Akzeptanzdialogs
4. Erläuterung der revisionssicheren Protokollierung und Exportierbarkeit
5. Darstellung des abgesicherten Rücksprungverhaltens nach Akzeptanz
6. Abschluss mit Abnahmeeinschätzung und den noch offenen Zielumgebungsnachweisen

## Gesprächsleitfaden

### 1. Versionierte Rechtstext-Verwaltung

Im Termin sollte gezeigt werden, dass Rechtstexte nicht als starre technische Flags behandelt werden, sondern als fachlich pflegbare Inhalte mit Name, Version, Sprache, Status, Veröffentlichungsdatum und HTML-Inhalt. Für die Abnahme ist wichtig, dass mindestens mehrere unterschiedliche Texte parallel verwaltet werden können und dass Erstellen, Bearbeiten und gezielte Zielgruppenzuordnung nachvollziehbar funktionieren.

**Repo-seitig gestützt durch:**

- [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx)
- [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.test.tsx)
- [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx)
- [apps/sva-studio-react/src/hooks/use-legal-texts.test.tsx](../../apps/sva-studio-react/src/hooks/use-legal-texts.test.tsx)
- [packages/iam-governance/src/legal-text-mutation-handlers.test.ts](../../packages/iam-governance/src/legal-text-mutation-handlers.test.ts)
- [packages/iam-governance/src/legal-text-repository.test.ts](../../packages/iam-governance/src/legal-text-repository.test.ts)

**Für den Kunden fachlich relevant:**

- unterschiedliche Rechtstexte wie Datenschutzhinweise und Nutzungsbedingungen können parallel gepflegt werden
- Versionen, Sprachen und Statuswechsel sind sauber abbildbar
- Veröffentlichungszeitpunkte und Zielrollen/-gruppen sind Teil des Fachmodells
- die Admin-Oberfläche bildet Liste, Suche, Detailpflege und Bearbeitung konsistent ab

### 2. Blockierender Akzeptanzflow für offene Pflicht-Rechtstexte

Für die Abnahme ist zentral, dass offene Pflicht-Rechtstexte nicht nur angezeigt werden, sondern den fachlichen Zugriff wirksam blockieren. Der Schutz darf nicht allein im Frontend stattfinden, sondern muss serverseitig vor geschützten Pfaden greifen.

Die vorhandene Runtime-Logik gibt bei offenen Akzeptanzen deterministisch `403 legal_acceptance_required` zurück und liefert den validierten Rücksprungpfad mit. Auf der UI-Seite wird der blockierende Dialog geladen, offene Rechtstexte werden nachgeladen und gesammelt akzeptiert.

**Repo-seitig gestützt durch:**

- [packages/auth-runtime/src/legal-text-enforcement.test.ts](../../packages/auth-runtime/src/legal-text-enforcement.test.ts)
- [packages/iam-governance/src/legal-text-http-handlers.test.ts](../../packages/iam-governance/src/legal-text-http-handlers.test.ts)
- [apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx](../../apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx)
- [docs/adr/ADR-027-rechtstext-fail-closed-und-blockierte-session.md](../adr/ADR-027-rechtstext-fail-closed-und-blockierte-session.md)
- [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)

**Abnahmefrage an den Kunden:**

- Ist nachvollziehbar, dass Nutzer mit offenen Pflicht-Rechtstexten vor fachlichem Zugriff wirksam in einen Akzeptanzflow geführt werden?

**Führende gemeinsame Evidence mit `WP-006`:**

- [docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md)

### 3. Unveränderbare Protokollierung mit Datum und Versionsbezug

Im Termin sollte erläutert werden, dass Akzeptanzen nicht nur als UI-Zustand gelten, sondern als revisionsrelevante Nachweise mit Zeit- und Versionsbezug persistiert und exportierbar sind. Für die Abnahme ist entscheidend, dass diese Daten später konsistent für Prüfung, Audit oder Datenschutzanfragen verwendet werden können.

Die vorhandene Migrations- und Exportlogik modelliert hierzu Felder wie `workspace_id`, `subject_id`, `legal_text_version`, `accepted_at`, `revoked_at` und `action_type`. Damit lassen sich Annahme- und Widerrufspfad nachvollziehbar unterscheiden.

**Repo-seitig gestützt durch:**

- [packages/data/migrations/0017_iam_legal_acceptance_audit.sql](../../packages/data/migrations/0017_iam_legal_acceptance_audit.sql)
- [packages/iam-governance/src/legal-consent-export.ts](../../packages/iam-governance/src/legal-consent-export.ts)
- [packages/iam-governance/src/legal-consent-export.test.ts](../../packages/iam-governance/src/legal-consent-export.test.ts)
- [docs/guides/iam-governance-runbook.md](../guides/iam-governance-runbook.md)
- [docs/reports/2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md](./2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md)

**Im Termin zeigen oder erläutern:**

- welche Pflichtfelder für den Nachweis gespeichert werden
- dass Versionsbezug und Zeitstempel Bestandteil des Nachweises sind
- dass Akzeptanz- und Widerrufsevents im Exportmodell unterscheidbar sind

### 4. Export nur für berechtigte Benutzer

Für die Abnahme ist relevant, dass Consent-Nachweise nicht beliebig abrufbar sind. Der Exportpfad muss an eine klare Berechtigung gebunden sein, damit rechtliche Nachweise zwar verfügbar, aber nicht unkontrolliert zugänglich sind.

Die vorhandene Exportlogik prüft explizit auf `legal-consents:export` oder System-Admin-Rollen und begrenzt wiederholte Exportanfragen zusätzlich über ein Rate-Limit. Damit ist nicht nur der Positivpfad, sondern auch die erwartete Zugriffskontrolle im Modell angelegt.

**Repo-seitig gestützt durch:**

- [packages/iam-governance/src/legal-consent-export.test.ts](../../packages/iam-governance/src/legal-consent-export.test.ts)
- [docs/reports/2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md](./2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md)
- [apps/project-report/src/data/project-status.json](../../apps/project-report/src/data/project-status.json)

**Abnahmefrage an den Kunden:**

- Ist ausreichend nachvollziehbar, dass Nachweise exportiert werden können, aber nur über einen explizit berechtigten Pfad?

**Führende gemeinsame Evidence mit `WP-006`:**

- [docs/reports/wp-006-consent-enforcement-export-nachweis-2026-05-25.md](./wp-006-consent-enforcement-export-nachweis-2026-05-25.md)

### 5. Gehärteter Rücksprung nach erfolgreicher Akzeptanz

Ein wichtiger Qualitäts- und Sicherheitsaspekt dieses Arbeitspakets ist der Rücksprung nach erzwungener Akzeptanz. Der Benutzer soll nach erfolgreicher Bestätigung kontrolliert dorthin zurückkehren, wo der blockierte Vorgang begonnen wurde, aber nur dann, wenn das Ziel intern und zulässig ist.

Die vorhandenen Tests zeigen, dass interne Zielpfade gespeichert und wieder aufgenommen werden, während externe URLs oder API-Pfade auf einen sicheren Default-Pfad zurückfallen. Zusätzlich verarbeitet der Dialog serverseitig bzw. eventseitig validierte `return_to`-Werte.

**Repo-seitig gestützt durch:**

- [apps/sva-studio-react/src/lib/legal-acceptance-navigation.test.ts](../../apps/sva-studio-react/src/lib/legal-acceptance-navigation.test.ts)
- [apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx](../../apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx)
- [apps/project-report/src/data/project-status.json](../../apps/project-report/src/data/project-status.json)

**Abnahmefrage an den Kunden:**

- Ist nachvollziehbar, dass der Rücksprung nach der Akzeptanz den Benutzer kontrolliert zum richtigen internen Zielpfad zurückführt, ohne externe Umleitungen zuzulassen?

## Kurzprotokoll

| Akzeptanzkriterium | Fachliche Aussage für die Abnahme | Bewertung |
| --- | --- | --- |
| Mindestens zwei unterschiedliche Rechtstexte können versioniert angelegt und bearbeitet werden | Verwaltung, Create-/Update-Pfade, Status- und Versionsmodell sowie UI-Listen-/Detailpflege sind repo-seitig konkret belegt | erfüllt |
| Benutzer mit offener Zustimmung werden beim Login zuverlässig zur Akzeptanz gezwungen | Serverseitiger `403 legal_acceptance_required` und blockierender Dialog sind technisch vorhanden und testseitig nachweisbar | weitgehend erfüllt |
| Akzeptanzen werden mit Datum und Versionsbezug unveränderbar protokolliert | Audit- und Exportmodell enthält die revisionsrelevanten Consent-Felder für Akzeptanz und Widerruf | weitgehend erfüllt |
| Nachweise akzeptierter Rechtstexte können für berechtigte Benutzer exportiert werden | Exportlogik, Rollenprüfung und Rate-Limit sind vorhanden; finale Zielumgebungs-Evidence fehlt noch | weitgehend erfüllt |
| Der Rücksprung nach erzwungener Akzeptanz bleibt auf interne Zielpfade begrenzt | Interne Return-Targets werden gespeichert und externe bzw. unzulässige Ziele werden verworfen | erfüllt |

## Abnahmeeinschätzung

Aus Repository-Sicht ist `WP-010` fachlich klar vorführbar und in den zentralen Risikoübergängen substanziell abgesichert. Besonders stark ist die Evidenz bei Rechtstext-Verwaltung, serverseitigem Enforcement und Rücksprunghärtung.

Für eine vollständig geschlossene formale Abnahme sollte aber nicht behauptet werden, dass der komplette Zielumgebungsnachweis bereits archiviert ist. Offen bleiben vor allem der abschließende End-to-End-Nachweis des blockierenden Flows in der Zielumgebung sowie die dokumentierte Negativ-Evidence für Exportversuche ohne ausreichende Berechtigung.

Für den Kundentermin sollte `WP-010` diese Restpunkte nicht separat neu definieren, sondern dieselben führenden Evidence-Dateien wie `WP-006` referenzieren. Dadurch bleiben Consent-, Akzeptanz- und Exportargumentation konsistent.

**Empfohlene Formulierung im Termin:**

> Das Arbeitspaket `WP-010` ist fachlich vorführbar und technisch in den zentralen Rechtstext-, Akzeptanz- und Nachweispfaden belastbar abgesichert. Die finale formale Freigabe steht noch unter dem Vorbehalt des abgeschlossenen Zielumgebungsnachweises für den blockierenden Akzeptanzflow sowie der konsolidierten Export- und Negativtests.

## Repo-seitige Stützbelege

- Leit- und Abnahmedokumente:
  - [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)
  - [docs/guides/iam-governance-runbook.md](../guides/iam-governance-runbook.md)
  - [docs/reports/cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md](./cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md)
  - [docs/reports/2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md](./2026-03-31-iam-offer-packages-3-to-5-abnahmeartefakte.md)
  - [docs/reports/2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md](./2026-05-20-nachweismatrix-datenschutz-compliance-arbeitspaket-1-2.md)
- Architektur- und Entscheidungsgrundlagen:
  - [docs/adr/ADR-027-rechtstext-fail-closed-und-blockierte-session.md](../adr/ADR-027-rechtstext-fail-closed-und-blockierte-session.md)
  - [docs/architecture/05-building-block-view.md](../architecture/05-building-block-view.md)
- Backend- und Governance-Pfade:
  - [packages/auth-runtime/src/legal-text-enforcement.test.ts](../../packages/auth-runtime/src/legal-text-enforcement.test.ts)
  - [packages/iam-governance/src/legal-text-http-handlers.test.ts](../../packages/iam-governance/src/legal-text-http-handlers.test.ts)
  - [packages/iam-governance/src/legal-text-mutation-handlers.test.ts](../../packages/iam-governance/src/legal-text-mutation-handlers.test.ts)
  - [packages/iam-governance/src/legal-text-repository.test.ts](../../packages/iam-governance/src/legal-text-repository.test.ts)
  - [packages/iam-governance/src/legal-consent-export.test.ts](../../packages/iam-governance/src/legal-consent-export.test.ts)
  - [packages/data/migrations/0017_iam_legal_acceptance_audit.sql](../../packages/data/migrations/0017_iam_legal_acceptance_audit.sql)
- Frontend- und Dialogpfade:
  - [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-create-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/legal-texts/-legal-text-detail-page.test.tsx)
  - [apps/sva-studio-react/src/hooks/use-legal-texts.test.tsx](../../apps/sva-studio-react/src/hooks/use-legal-texts.test.tsx)
  - [apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx](../../apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.test.tsx)
  - [apps/sva-studio-react/src/lib/legal-acceptance-navigation.test.ts](../../apps/sva-studio-react/src/lib/legal-acceptance-navigation.test.ts)

## Offene Restpunkte

Für die formale Komplettfreigabe von `WP-010` bleiben aktuell noch diese Punkte separat nachzuziehen:

- blockierenden Akzeptanzflow in der Zielumgebung vollständig abnehmen
- Export- und Negativtests ohne Exportberechtigung als archivierte Evidenz nachziehen
- Deep-Link-Test und Konsistenzabgleich zwischen UI, Export und Auditspur im finalen Abnahme-Set ablegen

Zusätzlich zeigen die bestehenden Staging-Unterlagen, dass die relevanten manuellen Rechtstext-Szenarien bereits vorbereitet, aber noch nicht als abgeschlossen dokumentiert sind.

## Entscheidung

Für den aktuellen Projektstatus in [apps/project-report/src/data/project-status.json](../../apps/project-report/src/data/project-status.json) ist `WP-010` mit diesem Protokoll **sauber für den Kundentermin vorbereitet und statusseitig auf `acceptance` vertretbar**, aber **noch nicht vollständig formal geschlossen**, solange Zielumgebungsfluss, Export-Negativtest und finale End-to-End-Evidence nicht konsolidiert vorliegen.
