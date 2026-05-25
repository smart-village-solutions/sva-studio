# WP-003 Abnahmeprotokoll: Organisation und Struktur

## Ausgangslage

- Arbeitspaket: `WP-003`
- Titel: `Organisation und Struktur`
- Bezugsdatum dieses Nachweises: `2026-05-25`
- Dieses Protokoll ist für die gemeinsame Durchsprache mit dem Kunden vorbereitet.
- Die Aussagen stützen sich auf vorhandene Architektur-, API-, UI- und Testartefakte sowie auf frisch erneut ausgeführte Backend- und Frontend-Tests vom `2026-05-25`, inklusive der nachgezogenen Parent-Options- und Teststabilitäts-Fixes.

## Abnahmescope

Für `WP-003` gelten in diesem Protokoll folgende Prüfpunkte als maßgeblich:

1. Organisationen können mit Parent-Child-Beziehungen angelegt und bearbeitet werden.
2. Hierarchische Organisationsstrukturen werden tenant-sicher gespeichert und gelesen.
3. Mitgliedschaften und aktiver Organisationskontext verhalten sich konsistent über Hierarchiewechsel hinweg.
4. Die Admin-UI zeigt Organisationsstruktur und Hierarchie korrekt an.

## Ergebnis

`WP-003` wird auf Basis des aktuellen Repository-Stands als **kundenseitig abnahmebereit mit sehr guter technischer Evidenz** bewertet.

Für eine formale Freigabe im strengen Sinn fehlt aktuell nur noch der explizit dokumentierte Zielumgebungsnachweis für Parent-Child-Neuzuordnung, Tenant-Grenzen und finalen Hierarchie-Smoke-Test.

## Kurzfazit für den Kundentermin

- Die Organisationsverwaltung mit Hierarchie ist fachlich nachvollziehbar umgesetzt.
- Parent-Child-Beziehungen, Hierarchiepfade und Tenant-Schutz sind in Backend und UI belastbar abgesichert.
- Mitgliedschaften und aktiver Organisationskontext sind als zusammenhängender Pfad modelliert und getestet.
- Für den Kundentermin liegt damit ein gut vorführbarer Stand vor; der letzte formale Zielumgebungsnachweis ist separat nachzuziehen.

## Empfohlener Ablauf im Kundengespräch

Die folgende Reihenfolge ist sinnvoll, weil sie die Organisationslogik aus Fachsicht erklärt und gleichzeitig die kritischen Risikoübergänge sichtbar macht:

1. Kurze Einordnung des Scopes von `WP-003`
2. Vorführung der Organisationsliste
3. Vorführung einer Parent-Child-Anlage bzw. Bearbeitung einer Organisation
4. Vorführung eines Organisationsdetails mit Hierarchiepfad und Mitgliedschaften
5. Erläuterung des aktiven Organisationskontexts und seines Verhaltens bei Wechseln
6. Abschluss mit Abnahmeeinschätzung und offenem Zielumgebungs-Smoke-Test

## Gesprächsleitfaden

### 1. Parent-Child-Anlage und Bearbeitung

Im Termin sollte gezeigt werden, dass Organisationen nicht nur einzeln gepflegt werden, sondern gezielt in eine Hierarchie eingeordnet und später umgehängt werden können. Für den Kunden ist relevant, dass solche Änderungen kontrolliert und nachvollziehbar erfolgen.

**Im Termin zeigen:**

- Anlegen einer neuen Organisation
- Auswahl einer Parent-Organisation
- Bearbeitung einer bestehenden Organisation mit Änderung der Parent-Zuordnung
- Speichern der Änderung ohne Bruch im Organisationsdetail

**Abnahmefrage an den Kunden:**

- Ist nachvollziehbar, dass Organisationsstrukturen fachlich passend angelegt und geändert werden können?

### 2. Tenant-sichere Hierarchiestruktur

Im Termin sollte erläutert werden, dass Hierarchien tenant-sicher geführt werden. Entscheidend ist hier nicht nur die Sichtbarkeit der Struktur, sondern auch, dass keine instanzfremden Beziehungen akzeptiert werden und unzulässige Hierarchien fail-closed enden.

**Im Termin zeigen oder erläutern:**

- Organisationsliste und Organisationsdetail im aktiven Mandanten
- sichtbarer Hierarchiepfad einer Organisation
- Parent-Auswahl nur im gültigen Kontext
- Hinweis auf serverseitige Sperren für instanzfremde Kontexte und Zyklen

**Abnahmefrage an den Kunden:**

- Ist ausreichend nachvollziehbar, dass Organisationshierarchien sauber pro Mandant getrennt bleiben?

### 3. Mitgliedschaften und aktiver Organisationskontext

Im Termin sollte klar gemacht werden, dass die Hierarchie nicht isoliert betrachtet wird, sondern mit Mitgliedschaften und dem aktiven Organisationskontext zusammenarbeitet. Das ist fachlich wichtig, weil Benutzer im richtigen organisatorischen Kontext weiterarbeiten müssen.

**Im Termin zeigen oder erläutern:**

- Mitgliedschaften im Organisationsdetail
- Zuweisen und Entfernen eines Mitglieds
- Bedeutung des aktiven Organisationskontexts für den angemeldeten Benutzer
- konsistentes Verhalten bei Kontextwechsel und bei unzulässigen Zielorganisationen

**Abnahmefrage an den Kunden:**

- Ist das Zusammenspiel aus Organisationsstruktur, Mitgliedschaften und aktivem Kontext fachlich verständlich und passend?

### 4. Nachvollziehbarkeit in der Admin-UI

Für die Abnahme ist relevant, dass die Organisationsstruktur nicht nur im Backend richtig ist, sondern auch in der Oberfläche verständlich vermittelt wird. Deshalb sollte im Termin besonders auf Liste, Detailansicht, Hierarchiepfad und Pflegeaktionen eingegangen werden.

**Im Termin zeigen:**

- Organisationsliste mit Filter- und Statusfunktionen
- Detailseite mit Hierarchiepfad
- Parent-Auswahl, Mitgliederverwaltung und Lösch-/Deaktivierungsfluss
- verständliche Fehler- oder Sperrmeldungen bei Konflikten

**Abnahmefrage an den Kunden:**

- Ist die Organisationsverwaltung in der Oberfläche nachvollziehbar und für die spätere Nutzung praxistauglich?

## Kurzprotokoll

| Akzeptanzkriterium | Fachliche Aussage für die Abnahme | Bewertung |
| --- | --- | --- |
| Organisationen können mit Parent-Child-Beziehungen angelegt und bearbeitet werden | Organisationsstrukturen lassen sich mit Parent-Zuordnung anlegen und bestehende Beziehungen anpassen | erfüllt |
| Hierarchische Organisationsstrukturen werden tenant-sicher gespeichert und gelesen | Tenant-Grenzen, Hierarchiepfade und Konfliktpfade sind serverseitig abgesichert | erfüllt |
| Mitgliedschaften und aktiver Organisationskontext verhalten sich konsistent über Hierarchiewechsel hinweg | Mitgliedschaften, Fallback-Kontext und aktiver Org-Wechsel sind als zusammenhängender Pfad abgesichert | erfüllt |
| Die Admin-UI zeigt Organisationsstruktur und Hierarchie korrekt an | Liste, Detailansicht, Parent-Auswahl und Mitgliedschaftspflege sind vorhanden und nachvollziehbar | erfüllt |

## Abnahmeeinschätzung

Aus Repository-Sicht sind die fachlichen Kriterien für `WP-003` erfüllt und kundenseitig vorführbar. Für eine vollständig geschlossene formale Abnahme bleibt noch ein separater Zielumgebungsnachweis offen.

Der noch offene Zielumgebungs-Smoke-Test ist jetzt als separates Kurzprotokoll vorbereitet: [wp-003-zielumgebungs-smoke-test-protokoll-2026-05-25.md](./wp-003-zielumgebungs-smoke-test-protokoll-2026-05-25.md). Damit ist die Dokumentationsstruktur für Parent-Child-Anlage, Re-Zuordnung und Tenant-Grenzen bereits normiert, auch wenn der echte Zielumgebungslauf noch aussteht.

**Empfohlene Formulierung im Termin:**

> Das Arbeitspaket `WP-003` ist fachlich vollständig vorführbar und technisch belastbar abgesichert. Die finale formale Freigabe steht nur noch unter dem Vorbehalt des abschließenden Zielumgebungs-Smoke-Tests für Parent-Child-Re-Zuordnung und Tenant-Grenzen.

## Hinweise für die Moderation

- Im Kundengespräch sollte die Organisationslogik aus Sicht von Fachstruktur und Bedienbarkeit erklärt werden, nicht aus Sicht interner Tabellen- oder Handlerdetails.
- Technische Schutzmechanismen wie Zyklusvermeidung, instanzfremde Parent-Sperren oder fail-closed-Kontextwechsel sollten nur kurz erläutert und bei Rückfragen vertieft werden.
- Der offene Zielumgebungs-Smoke-Test sollte transparent benannt werden, aber nicht die bereits starke fachliche Nachweislage verdecken.

## Repo-seitige Stützbelege

Die folgende Repo-Evidenz stützt den dokumentierten Stand und dient für Rückfragen, interne Nachvollziehbarkeit und revisionssichere Ablage:

- Acceptance-Vertrag und Zielumgebungsbezug:
  - [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)
- Architektur- und Laufzeitkontext:
  - [docs/architecture/06-runtime-view.md](../architecture/06-runtime-view.md)
  - [docs/reports/cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md](./cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md)
  - [docs/reports/iam-organization-management-verification-2026-03-09.md](./iam-organization-management-verification-2026-03-09.md)
- Frisch erneut ausgeführte Backend-Testevidenz für Hierarchie- und Kontextpfade:
  - `pnpm nx run iam-admin:test:unit --testFiles=src/organization-mutation-handlers.test.ts --testFiles=src/organization-read-handlers.test.ts --testFiles=src/organization-query.test.ts`
  - Ergebnis am `2026-05-25`: `45` Testdateien / `267` Tests grün
- Frisch erneut ausgeführte Frontend-Testevidenz:
  - `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/organizations/-organizations-page.test.tsx --testFiles=src/routes/admin/organizations/-organization-detail-page.test.tsx --testFiles=src/routes/admin/organizations/-organization-create-page.test.tsx`
  - Ergebnis am `2026-05-25`: `117` Testdateien / `872` Tests grün
- Nachgezogene gezielte Frontend-Nachweise für den bereinigten Parent-/Detailpfad:
  - `pnpm exec vitest run src/routes/admin/organizations/-organization-detail-page.test.tsx --config vitest.config.ts`
  - Ergebnis am `2026-05-25`: `1` Testdatei / `5` Tests grün
  - `pnpm exec vitest run src/routes/admin/organizations/-organization-create-page.test.tsx src/routes/admin/organizations/-organization-detail-page.test.tsx src/routes/admin/organizations/-organizations-page.test.tsx src/routes/admin/organizations/-organization-shared.test.tsx --config vitest.config.ts`
  - Ergebnis am `2026-05-25`: `4` Testdateien / `22` Tests grün
- Relevante UI- und Hook-Artefakte für die Vorführung:
  - [apps/sva-studio-react/src/routes/admin/organizations/-organizations-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organizations-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/organizations/-organization-create-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organization-create-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx)
  - [apps/sva-studio-react/src/hooks/use-organization-context.test.tsx](../../apps/sva-studio-react/src/hooks/use-organization-context.test.tsx)

## Offene Restpunkte

Für die formale Komplettfreigabe von `WP-003` bleiben aktuell noch diese Zielumgebungsnachweise separat nachzuziehen:

- formalen Zielumgebungsnachweis für Parent-Child-Anlage und Re-Zuordnung abschließen
- finalen Zielumgebungs-Smoke-Test für Tenant-Grenzen und Hierarchiepfade archivieren

Diese Punkte entsprechen dem aktuellen Projektstatus in [apps/project-report/src/data/project-status.json](../../apps/project-report/src/data/project-status.json).

## Einordnung der Beweisstärke

Dieses Protokoll ist bewusst kundentauglich formuliert, ohne die aktuelle Lage zu beschönigen:

- Die fachlichen Prüfpunkte sind vollständig gegen Architektur, Handlerlogik und UI-Pfade abbildbar.
- Die kritischen Risikopfade für Zyklen, instanzfremde Kontexte und inkonsistente Kontextwechsel sind bereits technisch adressiert.
- Die einzige verbleibende Lücke ist kein funktionaler Repository-Blocker, sondern ein noch zu archivierender Zielumgebungsnachweis.

## Entscheidung

Für den aktuellen Projektstatus `apps/project-report/src/data/project-status.json` ist `WP-003` mit diesem Protokoll **sauber für den Kundentermin vorbereitet und statusseitig auf `acceptance` vertretbar**, aber noch **nicht vollständig formal geschlossen**, solange der Zielumgebungs-Smoke-Test nicht dokumentiert ist.
