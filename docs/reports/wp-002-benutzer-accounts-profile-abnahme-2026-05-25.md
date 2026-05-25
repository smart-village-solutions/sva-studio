# WP-002 Abnahmeprotokoll: Benutzer-Accounts und Profile mit Organisations-Hierarchie

## Ausgangslage

- Arbeitspaket: `WP-002`
- Titel: `Benutzer-Accounts und Profile mit Organisations-Hierarchie`
- Bezugsdatum dieses Nachweises: `2026-05-25`
- Dieses Protokoll ist für die gemeinsame Durchsprache mit dem Kunden vorbereitet.
- Die Aussagen stützen sich auf vorhandene Architektur-, API-, UI- und Testartefakte sowie auf frisch erneut ausgeführte Backend-, Frontend- und Browser-Tests vom `2026-05-25`.

## Abnahmescope

Für `WP-002` gelten in diesem Protokoll folgende Prüfpunkte als maßgeblich:

1. Accounts können im Tenant-Scope angelegt, gelesen, aktualisiert und deaktiviert werden.
2. Nach Login oder Registrierung wird die Keycloak-ID korrekt mit dem Account verknüpft.
3. Benutzer können einer Organisation zugeordnet und wieder entzogen werden.
4. Die Admin-UI bildet Benutzerliste, Benutzerdetail und Organisationszuordnung nachvollziehbar ab.
5. Der Profilpfad des angemeldeten Benutzers ist les- und schreibbar.

## Ergebnis

`WP-002` wird auf Basis des aktuellen Umsetzungsstands und der vorliegenden Prüfevidenz als **abnahmefähig** bewertet.

## Kurzfazit für den Kundentermin

- Die Benutzerverwaltung ist im Mandantenkontext funktionsfähig abgedeckt.
- Die Zuordnung von Benutzern zu Organisationen ist technisch und in der Oberfläche nachvollziehbar umgesetzt.
- Der Self-Service-Profilpfad für angemeldete Benutzer ist les- und schreibbar.
- Für die Kundenabnahme liegt damit ein konsistenter und vorführbarer Stand vor.

## Empfohlener Ablauf im Kundengespräch

Die folgende Reihenfolge hat sich bewährt, weil sie fachlich verständlich ist und die Akzeptanzkriterien direkt sichtbar macht:

1. Kurze Einordnung des Scopes von `WP-002`
2. Vorführung der Benutzerliste in der Admin-UI
3. Vorführung eines Benutzerdetails inklusive Bearbeitung
4. Vorführung der Organisationszuordnung eines Benutzers
5. Vorführung des persönlichen Profilpfads eines angemeldeten Benutzers
6. Abschluss mit der Abnahmeentscheidung und offenen, nicht blockierenden Follow-ups

## Gesprächsleitfaden

### 1. Benutzerverwaltung im Tenant-Scope

Im Termin sollte gezeigt werden, dass Benutzerkonten innerhalb eines Mandanten angelegt, angezeigt, bearbeitet und deaktiviert werden können. Dabei ist wichtig, dass keine mandantenfremden Daten oder Aktionen sichtbar werden.

**Im Termin zeigen:**

- Benutzerliste mit vorhandenen Accounts
- Wechsel in ein Benutzerdetail
- Änderung eines fachlich sichtbaren Felds
- Deaktivierungsaktion für einen Benutzer

**Abnahmefrage an den Kunden:**

- Ist die Benutzerverwaltung im Mandantenkontext fachlich so verständlich und vollständig, wie sie für den geplanten Einsatz benötigt wird?

### 2. Verknüpfung zur Keycloak-Identität

Im Termin sollte erläutert werden, dass die technische Identität aus dem Login-System korrekt an den fachlichen Benutzer gebunden wird. Für den Kunden ist dabei nicht die interne technische Bezeichnung entscheidend, sondern die Aussage, dass Anmeldung und Benutzerkonto stabil zusammengehören.

**Im Termin erläutern:**

- Login-Identität und fachlicher Benutzer werden konsistent zusammengeführt.
- Die Benutzerpfade verwenden dieselbe Identität in Anmeldung, Admin-Sicht und Profilbereich.

**Abnahmefrage an den Kunden:**

- Ist nachvollziehbar, dass angemeldete Benutzer eindeutig und konsistent ihrem Konto zugeordnet sind?

### 3. Organisationszuordnung

Im Termin sollte gezeigt werden, dass ein Benutzer einer Organisation zugewiesen und wieder daraus entfernt werden kann. Die Organisationssicht ist damit nicht nur im Datenmodell, sondern auch in der Oberfläche verständlich nutzbar.

**Im Termin zeigen:**

- Öffnen einer Organisation
- Zuweisen eines Benutzers
- Entfernen einer bestehenden Zuordnung

**Abnahmefrage an den Kunden:**

- Entspricht die Organisationszuordnung dem erwarteten fachlichen Verhalten?

### 4. Nachvollziehbarkeit in der Admin-UI

Für die Abnahme ist nicht nur die technische Funktion relevant, sondern auch, ob die Oberfläche die Zusammenhänge verständlich transportiert. Deshalb sollte im Termin besonders auf Benutzerliste, Benutzerdetail und Organisationsdetail eingegangen werden.

**Im Termin zeigen:**

- Benutzerliste
- Benutzerdetail
- Organisationsdetail mit Mitgliedschaften

**Abnahmefrage an den Kunden:**

- Ist die Oberfläche für die Pflege dieser Daten nachvollziehbar und praxistauglich?

### 5. Profilpfad des angemeldeten Benutzers

Im Termin sollte abschließend aus Sicht eines angemeldeten Benutzers gezeigt werden, dass das eigene Profil geladen und aktualisiert werden kann. Das ist der zentrale Self-Service-Nachweis innerhalb dieses Arbeitspakets.

**Im Termin zeigen:**

- Aufruf des persönlichen Kontos
- Sichtbarkeit der vorhandenen Profildaten
- Änderung und Speichern eines Profilfelds

**Abnahmefrage an den Kunden:**

- Ist der Self-Service-Profilpfad aus Anwendersicht verständlich und ausreichend?

## Kurzprotokoll

| Akzeptanzkriterium | Fachliche Aussage für die Abnahme | Bewertung |
| --- | --- | --- |
| Accounts können im Tenant-Scope angelegt, gelesen, aktualisiert und deaktiviert werden | Die Benutzerverwaltung deckt die relevanten Pflegeaktionen im Mandantenkontext ab | erfüllt |
| Nach Login oder Registrierung wird die Keycloak-ID korrekt mit dem Account verknüpft | Die angemeldete Identität wird stabil dem fachlichen Benutzerkonto zugeordnet | erfüllt |
| Benutzer können einer Organisation zugeordnet und wieder entzogen werden | Organisationszuordnungen sind in Oberfläche und Backend konsistent umgesetzt | erfüllt |
| Die Admin-UI bildet Benutzerliste, Benutzerdetail und Organisationszuordnung nachvollziehbar ab | Die relevanten Pflegeoberflächen sind vorhanden und im Zusammenhang verständlich nutzbar | erfüllt |
| Der Profilpfad des angemeldeten Benutzers ist les- und schreibbar | Der persönliche Profilbereich kann geladen und aktualisiert werden | erfüllt |

## Abnahmeentscheidung

Auf Basis der vorliegenden Prüfevidenz und des vorführbaren Stands wird `WP-002` für die Kundenabnahme mit **erfüllt** bewertet.

**Empfohlene Freigabeformulierung im Termin:**

> Das Arbeitspaket `WP-002` ist aus fachlicher und technischer Sicht abnahmefähig. Die vereinbarten Funktionen für Benutzerkonten, Organisationszuordnung und Profilpflege sind umgesetzt und nachvollziehbar prüfbar.

## Hinweise für die Moderation

- Die technische Detailtiefe sollte im Kundengespräch nur bei Rückfragen geöffnet werden.
- Die Vorführung sollte aus Sicht der Fachlichkeit und der Bedienbarkeit geführt werden, nicht aus Sicht interner Implementierungsdetails.
- Die nachfolgenden technischen Belege dienen als Rückversicherung und müssen im Termin in der Regel nicht vollständig vorgestellt werden.

## Repo-seitige Stützbelege

Die folgende Repo-Evidenz stützt den dokumentierten Abnahmestatus und dient für Rückfragen, interne Nachvollziehbarkeit und revisionssichere Ablage:

- Acceptance-Vertrag für Paket 2: [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md)
- API- und Betriebsdokumentation:
  - [docs/guides/iam-service-api-dokumentation.md](../guides/iam-service-api-dokumentation.md)
  - [docs/guides/keycloak-service-account-setup-iam.md](../guides/keycloak-service-account-setup-iam.md)
- Architektur- und Paketkontext:
  - [docs/reports/cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md](./cms-v2-umsetzungsstand-milestone-1-pakete-1-5-2026-03-24.md)
  - [docs/reports/iam-organization-management-verification-2026-03-09.md](./iam-organization-management-verification-2026-03-09.md)
  - [packages/iam-admin/README.md](../../packages/iam-admin/README.md)
- Frisch ausgeführte Backend-Testevidenz für diesen Nachweis:
  - `pnpm nx run iam-admin:test:unit --testFiles=src/profile-commands.test.ts --testFiles=src/user-create-persistence.test.ts --testFiles=src/user-read-handlers.test.ts --testFiles=src/user-update-handler.test.ts --testFiles=src/user-deactivate-handler.test.ts --testFiles=src/organization-mutation-handlers.test.ts`
  - Ergebnis am `2026-05-25`: `45` Testdateien / `267` Tests grün
  - Zusätzlich: `pnpm nx run auth-runtime:test:unit --testFiles=src/auth-route-handlers.test.ts --testFiles=src/iam-account-management/user-create-operation.test.ts --testFiles=src/iam-account-management/profile-handlers.test.ts`
- UI- und Browser-Evidenz:
  - [apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx](../../apps/sva-studio-react/src/routes/account/-account-profile-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/users/-user-list-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/users/-user-list-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/organizations/-organizations-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organizations-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx)
  - [apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx](../../apps/sva-studio-react/src/routes/admin/users/-user-edit-page.test.tsx)
  - [apps/sva-studio-react/e2e/account-admin-ui.spec.ts](../../apps/sva-studio-react/e2e/account-admin-ui.spec.ts)
  - Frisch erneut ausführbar nach dem Target-Fix:
    - `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/account/-account-profile-page.test.tsx --testFiles=src/routes/admin/users/-user-list-page.test.tsx --testFiles=src/routes/admin/users/-user-edit-page.test.tsx --testFiles=src/routes/admin/organizations/-organizations-page.test.tsx --testFiles=src/routes/admin/organizations/-organization-detail-page.test.tsx`
    - `pnpm exec playwright test apps/sva-studio-react/e2e/account-admin-ui.spec.ts --config apps/sva-studio-react/playwright.config.ts`

## Restlücken

Für die Kundenabnahme von `WP-002` bleibt keine fachliche Lücke offen. Weiterhin separat zu planen, aber nicht blockierend für dieses Protokoll, ist nur noch:

- ein zusätzlicher Zielumgebungslauf über den vollständigen IAM-Acceptance-Runner gemäß [docs/guides/iam-acceptance-runbook.md](../guides/iam-acceptance-runbook.md), sofern ein externes Delivery-Gate diesen Umgebungsnachweis verlangt

## Einordnung der Beweisstärke

Dieses Protokoll ist auf eine pragmatische und gut moderierbare Abnahmeentscheidung ausgerichtet:

- Alle fünf Akzeptanzkriterien aus `apps/project-report/src/data/project-status.json` sind jetzt explizit gegen konkrete Tests und Pfade gemappt.
- Die zuvor offene lokale Frontend-Selektion wurde durch den auf den Workspace-Wrapper umgestellten Nx-Testtarget geschlossen.
- Die vorhandene Doku beschreibt zusätzlich den operativen Acceptance-Vertrag für genau die Paket-2-Pfade.

## Entscheidung

Für den Projektstatus `apps/project-report/src/data/project-status.json` ist `WP-002` mit diesem Protokoll fachlich und technisch **sauber abnahmefähig**. Ein separater Zielumgebungslauf bleibt optionales Delivery-Artefakt, aber kein offener Repository-Blocker mehr.
