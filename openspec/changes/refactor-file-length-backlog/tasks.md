# Serielle Lieferliste

Die PRs werden in dieser Reihenfolge bearbeitet. Die erste Checkbox wird
abgehakt, wenn der PR auf dem exakt geprüften HEAD gemergt ist, seine
benannten aktuellen `fileLines`-Befunde im vollständigen Complexity-Lauf
verschwunden und die zugehörigen Registereinträge entfernt sind. Die zweite
Checkbox belegt den eigenen Studio-Changelog-Eintrag samt grünem Gate. Vor
Beginn wird der Dateiscope gegen das dann aktuelle `main` und laufende
Changes geprüft. Ist ein Befund bereits anderweitig erledigt, wird der
Merge- und Gate-Nachweis an seinem PR-Task vermerkt; die nächste Nummer
bleibt erhalten. Eine nötige Scope-Änderung wird zuerst hier und in
`design.md` dokumentiert. Die allgemeinen Qualitätsregeln stehen in
`design.md`. Beide Haken sind für den Abschluss eines PR-Tasks nötig.

## Pilot und Grundlagen

### PR 01 — Server-Runtime-Grenzen (2 Befunde)

- [x] In `packages/server-runtime/src/` `logger/index.server.ts` und
      `external-interfaces.server.ts` unter ihre 260-Zeilen-Grenzen bringen.
      Logger- und Interface-Verträge samt Server-Runtime-Gate prüfen.

- [x] Studio-Changelog `docs/changelog/entries/pr-1620.json` mit
      Nutzertext eingebracht; PR #1620 am 02.10.2026 als
      `6c3398a0da0090777a8e5ecbb0841d90170a1284` gemergt.
      Vollständiges Complexity-Gate auf `main`: 162 verbleibende
      `fileLines`-Befunde, keine neuen Findings.

### PR 02 — Studio-UI-Bausteine (3 Befunde)

- [x] In `packages/studio-ui-react/src/` `studio-primitives.tsx`,
      `studio-data-table.tsx` und `rich-text-html-editor.tsx` nach vorhandenen
      Komponentenverantwortungen zerlegen. DOM-, A11y- und Editor-Verhalten
      mit gezielten Komponenten- und Typprüfungen erhalten.

- [x] Studio-Changelog `docs/changelog/entries/pr-1622.json` mit
      Nutzertext eingebracht; PR #1622 am 02.10.2026 als
      `310b84e14a7a97518077192202e891a7a6f4e98d` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 03 — Core- und Routing-Verträge (8 Befunde)

- [x] In `packages/core/src/` `iam/account-management-contract.ts`,
      `content-management.ts`, `plugin-operations-contract.ts`,
      `iam/runtime-diagnostics.ts`, `instances/registry.ts`, `index.ts`,
      `runtime-profile.ts` sowie `packages/routing/src/app.routes.shared.ts`
      bereinigen. Öffentliche Exporte, Runtime-Imports, IAM- und
      Routing-Verträge gezielt prüfen.

- [x] Studio-Changelog `docs/changelog/entries/pr-1623.json` mit
      Nutzertext eingebracht; PR #1623 am 02.10.2026 als
      `b28199a3166f53cd5620ee8bc39258eae0a3dcba` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 04 — Plugin-SDK-Vertragsfläche (4 Befunde)

- [x] In `packages/plugin-sdk/src/` `plugins.ts`, `admin-resources.ts`,
      `plugin-operations.ts` und `plugin-platform-resolution.ts` an ihren
      bestehenden SDK-Zuständigkeiten aufteilen. Exporte und Registrierung
      mit Package-Tests und Typprüfung absichern.

- [x] Studio-Changelog `docs/changelog/entries/pr-1624.json` mit
      Nutzertext eingebracht; PR #1624 am 02.10.2026 als
      `45b36bc8560e1b2cf3aafd7049e66d0f196d3e87` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

## Studio-Frontend

### PR 05 — Shell und Navigation (4 Befunde)

- [x] In `apps/sva-studio-react/src/` `components/Sidebar.tsx`,
      `components/Header.tsx`, `providers/auth-provider.tsx` und
      `routing/app-route-bindings.tsx` bereinigen. Navigation, Auth-Zustand,
      Rollen-Sichtbarkeit und typsichere Routen gezielt testen.

- [x] Studio-Changelog `docs/changelog/entries/pr-1625.json` mit
      Nutzertext eingebracht; PR #1625 am 02.10.2026 als
      `6438ab98d9ce16ae3cbdbb85cfc80caf720368a5` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 06a — IAM-API-Client (1 Befund)

- [x] `apps/sva-studio-react/src/lib/iam-api.ts` entlang seiner bestehenden
      Ressourcenverträge aufteilen. Exporte, HTTP-Fehlerabbildung und
      Anfrageparameter mit den gezielten API-Tests erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1626.json` eingebracht; PR #1626
      am 02.10.2026 als `dded9ab44926e47a67bd7f1f44e72d4c58d7c4dd`
      gemergt. Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 06b — IAM-Cockpit (1 Befund)

- [x] `apps/sva-studio-react/src/routes/admin/-iam-page.tsx` nach
      Rechte-, Governance-, DSR- und Löschregel-Panels aufteilen.
      Tab-Navigation und Berechtigungssicht gezielt prüfen.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1627.json` eingebracht; PR #1627
      am 02.10.2026 als `006760cfc308b4d367dd12f2180af90326dc872a`
      gemergt. Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 06c — Rollen und Gruppen (2 Befunde)

- [x] `apps/sva-studio-react/src/routes/admin/roles/-role-detail-page.tsx`
      und `routes/admin/groups/-group-detail-page.tsx` nach ihren
      bestehenden Formular- und Berechtigungsverantwortungen aufteilen.
      Rollenvergabe und Gruppenmitgliedschaft gezielt prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1628.json` eingebracht;
      PR #1628 am 02.10.2026 als
      `1535fb65d1b37fcf1d88a4062238704723640e16` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 06d1 — Benutzerseiten (2 Befunde)

- [x] `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`,
      `routes/admin/users/-user-list-page.tsx` nach Formular-Panels,
      Listenaktionen und Rückmeldungen aufteilen. Formulare,
      Berechtigungen, Mitgliedschaft und Suche gezielt prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1630.json` eingebracht;
      PR #1630 am 02.10.2026 als
      `d7eb9cede602c225e88e7d52d52caab638435ec8` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 06d2 — Organisationen und Auswahl (2 Befunde)

- [x] `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.tsx`
      und `components/ui/searchable-select.tsx` nach Organisationsformular,
      Mitgliedschaft und Auswahlzustand aufteilen. Suche und Tastaturbedienung
      gezielt prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1631.json` eingebracht;
      PR #1631 am 02.10.2026 als
      `745f0a458aa522c6137bca1a2a80529005757777` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 07a — Instanz-Anlageassistent (1 Befund)

- [x] `apps/sva-studio-react/src/routes/admin/instances/-instance-create-page.tsx`
      entlang der vorhandenen Assistentenschritte und Bereitschaftsanzeige
      aufteilen. Formularvalidierung, Realm-Auswahl, serverseitige
      Bereitschaft und Anlage mit dem bestehenden Seitentest prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1635.json` eingebracht;
      PR #1635 am 02.10.2026 als
      `9728cd478f2acc7f25027f566e750795435bc91d` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 07b — Instanz-Betriebsmodelle und Detailseite (2 Befunde)

- [x] `apps/sva-studio-react/src/routes/admin/instances/-instances-shared.tsx`
      und `-instance-detail-page.tsx` entlang New-Realm- und
      Existing-Realm-Betriebsmodell sowie Cockpit-Aktionen aufteilen.
      Schrittstatus, Berechtigungen, Nachladen und Fehlerzustände mit
      den vorhandenen Modell- und Seitentests prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1636.json` eingebracht;
      PR #1636 am 02.10.2026 als
      `be22f2c5b713f2c7090717d9feb667f19e577091` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 07c — Schnittstellen-Speicherung und Healthcheck (2 Befunde)

- [x] `apps/sva-studio-react/src/lib/instance-interfaces-server.ts`
      und `instance-interface-healthcheck.server.ts` nach Speicherung,
      Validierung und Prüftypen aufteilen. Mandantengrenzen, Secrets,
      CRUD, Timeouts und Fehlerabbildung mit den Server-Tests prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1637.json` eingebracht;
      PR #1637 am 02.10.2026 als
      `3c54567f0547f4d6a66fd4f2db0722902667a96d` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 07d — Schnittstellen-API (1 Befund)

- [ ] `apps/sva-studio-react/src/lib/interfaces-api.ts` nach
      Serverfunktionen und ihren bestehenden Berechtigungs- und
      Fehlerverträgen aufteilen. Instanzkontext, Autorisierung und
      Anfragevalidierung mit den API-Tests prüfen.
- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 07e — Schnittstellen-Dialoge (1 Befund)

- [ ] `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.dialogs.tsx`
      entlang der vorhandenen Schnittstellentypen aufteilen. Eingaben,
      Dialogzustände, Tastaturbedienung und Fehlerrückmeldungen prüfen.
- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 07f — Instanz-Hook (1 Befund)

- [ ] `apps/sva-studio-react/src/hooks/use-instances.ts` nach Lade- und
      Mutationsverantwortung aufteilen. Cache-Zustand, Fehler und
      Berechtigungsreaktionen mit den Hook-Tests prüfen.
- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 08 — Content und Medien im Frontend (4 Befunde)

- [ ] In `apps/sva-studio-react/src/` `routes/content/-content-list-page.tsx`,
      `routes/content/-content-editor-page.tsx`,
      `lib/waste-management-operations.import.ts` und `hooks/use-media.ts`
      bereinigen. Content-Filter, Editor-Speicherung, Import- und
      Medienzustände mit passenden Tests erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## IAM und Auth

### PR 09 — Account- und User-Handler (7 Befunde)

- [ ] In `packages/auth-runtime/src/iam-account-management/`
      `profile-handlers.ts`, `schema-guard.ts`,
      `user-import-sync-handler.ts`, `diagnostics.ts` und in
      `packages/iam-admin/src/` `user-update-handler.ts`,
      `user-read-handlers.ts`, `profile-commands.ts` bereinigen.
      Validierung, Mandantengrenzen, Fehlercodes und PII-Redaction testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 10 — Rollen-, Gruppen- und Organisationsverwaltung (7 Befunde)

- [ ] In `packages/iam-admin/src/` `organization-mutation-handlers.ts`,
      `organization-query.ts`, `reconcile-core.ts`,
      `role-mutation-persistence.ts`, `group-mutation-handlers.ts`,
      `legacy-group-mutation-handlers.ts` und `index.ts` bereinigen.
      Mutations-/Reconcile-Invarianten und öffentliche Verträge prüfen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 11 — Betroffenenrechte und Governance (10 Befunde)

- [ ] In `packages/auth-runtime/src/`
      `iam-data-subject-rights/core.ts`,
      `iam-data-subject-rights/export-worker.ts`, `iam-governance/core.ts`
      sowie in `packages/iam-governance/src/`
      `governance-workflow-executor.ts`, `dsr-export-flows.ts`,
      `legal-text-repository.ts`, `dsr-read-models.mappers.ts`,
      `dsr-export-payload.ts`, `dsr-read-models.self-service-queries.ts`,
      `legal-text-mutation-handlers.ts` bereinigen. Export-Vollständigkeit,
      Zugriff, Audit und Datenintegrität mit Pflicht-Gates nachweisen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 12 — Auth-Routen, Session und Audit (4 Befunde)

- [ ] In `packages/auth-runtime/src/` `auth-route-handlers.ts`,
      `redis-session.ts`, `audit-db-sink.ts` und
      `iam-authorization/shared.ts` bereinigen. Fail-closed-Verhalten,
      Session-Lifecycle, Audit-Redaction und Server-Runtime prüfen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 13 — Plugin-, Content- und Media-Runtime in Auth (9 Befunde)

- [ ] In `packages/auth-runtime/src/` `iam-contents/repository.ts`,
      `iam-contents/repository-write-helpers.ts`,
      `iam-media/processing.ts`, `iam-media/storage-s3.ts`,
      `plugin-server-handlers/dispatcher.ts`,
      `plugin-operations/runner-registry.ts`,
      `plugin-operations/runner-worker.ts`,
      `plugin-operations/job-state-writer.ts` und
      `plugin-tenant-lifecycle/orchestrator.ts` bereinigen. Tenant-,
      Storage-, Retry- und Job-State-Grenzen gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## Daten und Provisionierung

### PR 14 — Repository-Entrypoints und Integrationen (4 Befunde)

- [ ] In `packages/data-repositories/src/` `media/index.ts`,
      `plugin-operations/index.ts`, `iam/repositories/statements.ts` und
      `integrations/instance-integrations.server.ts` bereinigen. Bestehende
      Entrypoints und SQL-/Mapping-Verträge erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 15 — Instanz-Repository und Provisionierungsplan (7 Befunde)

- [ ] In `packages/data-repositories/src/instance-registry/`
      `repository-contract.ts`, `server.ts`, `repository-provisioning.ts`
      sowie in `packages/instance-registry/src/`
      `provisioning-auth-state.ts`, `provisioning-auth-evaluation.ts`,
      `provisioning-auth-plan.ts`, `tenant-provisioning-steps.ts`
      bereinigen. Persistenz-, Autorisierungs- und Retry-Invarianten
      zusammenhängend charakterisieren.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 16 — Instanz-Service und Keycloak-Ausführung (6 Befunde)

- [ ] In `packages/instance-registry/src/`
      `service-keycloak-execution.ts`, `service-keycloak-readers.ts`,
      `service-audit-keycloak.ts`, `service-module-mutations.ts`,
      `service-draft-readiness.ts`, `service-helpers.ts` bereinigen.
      Provisionierungszustände, Fehlerpfade und Keycloak-Grenze prüfen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## Fachplugins

### PR 17 — Events-Editor (3 Befunde)

- [ ] In `packages/plugin-events/src/` `events.detail-page.tsx`,
      `plugin.translations.ts`, `events.detail-form.ts` bereinigen.
      Feldpfade, Übersetzungen, Validierung und Speichersequenz testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 18 — News-Editor (3 Befunde)

- [ ] In `packages/plugin-news/src/` `news.detail-page.tsx`,
      `plugin.translations.ts`, `news.detail-form.ts` bereinigen.
      Editor- und Übersetzungsvertrag mit gezielten Tests erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 19 — Generic-Items-Editor (2 Befunde)

- [ ] In `packages/plugin-generic-items/src/`
      `generic-items.detail-content-tab.tsx` und
      `generic-items.detail-page.tsx` bereinigen. Content-Tab-Ownership,
      Formular- und Medienverträge gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 20 — POI-Editor (1 Befund)

- [ ] `packages/plugin-poi/src/poi.detail-page.tsx` entlang bestehender
      POI-Abschnitte bereinigen. Formular-, Geocoding- und
      Berechtigungsverhalten gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 21 — Projects-Seite (1 Befund)

- [ ] `packages/plugin-projects/src/projects.pages.tsx` entlang der
      bestehenden Seitenverantwortung bereinigen. Listen-, Detail- und
      Speicherverhalten gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 22 — Cockpit-Cards-Seite (1 Befund)

- [ ] `packages/plugin-cockpit-cards/src/cockpit-cards.pages.tsx`
      bereinigen. Sichtbarkeit, Reihenfolge und Save-/Reload-Verhalten
      gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## Waste-Management

### PR 23 — Waste-Plugin-Einstieg und Übersetzungen (5 Befunde)

- [ ] In `packages/plugin-waste-management/src/` `plugin.tsx`,
      `plugin.translations.de.tours.ts`,
      `plugin.translations.en.tours.ts`,
      `plugin.translations.de.scheduling.ts`,
      `plugin.translations.en.scheduling.ts` bereinigen. Registrierung,
      Schlüsselparität und bestehende Texte erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 24 — Waste-Plugin-Touren und Orte (7 Befunde)

- [ ] In `packages/plugin-waste-management/src/`
      `waste-management.tools.import-section.parts.tsx`,
      `waste-management.tours-custom-dates.tsx`,
      `waste-management.master-data-locations-table.views.tsx`,
      `waste-management.tours.presentation.ts`,
      `waste-management.tours-assignments-dialog.tsx`,
      `waste-management.tools.actions.ts`,
      `waste-management.tours.shared.ts` bereinigen. Import-, Touren- und
      Ortsauswahl mit gezielten UI- und Typprüfungen erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 25 — Waste-Verträge und Settings (8 Befunde)

- [ ] In `packages/waste-management-contracts/src/`
      `waste-management-settings-public-config.ts`,
      `waste-management-location-tour-pickup-date-planner.ts`,
      `waste-management-output.render.ts`,
      `waste-management-location-tour-pickup-date-parser.ts` sowie in
      `packages/waste-management-runtime/src/` `http-schemas.ts`,
      `handlers/settings-write-support.ts`, `handlers/settings-shared.ts`,
      `handlers/types.ts` bereinigen. Parsing, Ausgabe, öffentliche
      Settings und Validierung mit Vertrags- und Runtime-Tests prüfen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 26 — Waste-Lader und Runtime-Handler (7 Befunde)

- [ ] In `packages/waste-management-runtime/src/` `server-loaders.ts`,
      `repositories/email-reminders.ts`, `server-handlers.ts`,
      `handlers/operations.ts`, `handlers/read-handlers.ts`,
      `handlers/tours-write-support.ts`, `handlers/mutation-helpers.ts`
      bereinigen. Tenant-Scope, Reminder-, Lese- und Mutationsverhalten
      mit Datenintegritäts- und Server-Runtime-Tests erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## Mainserver und öffentlicher Kalender

### PR 27 — Mainserver-Content-Routen (5 Befunde)

- [ ] In `packages/sva-mainserver/src/server/` `news-route.ts`,
      `events-route.ts`, `generic-items-route.ts`, `poi-route.ts`,
      `projects-route.ts` bereinigen. Validierung, Fehlercodes,
      Berechtigungen und Antwortformat gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 28 — Mainserver-Service und interne Typen (4 Befunde)

- [ ] In `packages/sva-mainserver/src/` `server/service.ts`, `types.ts`,
      `server/interfaces-contract.ts`,
      `server/service-internals/mappers-shared.ts` bereinigen.
      Service-Komposition, Interface-Vertrag und Runtime-Imports prüfen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 29 — Öffentliche Waste-Daten und Reminder (6 Befunde)

- [ ] In `apps/public-waste-calendar-web/src/`
      `server/public-waste-email-reminders.server.ts`,
      `server/public-waste-runtime.ts`, `lib/public-waste-endpoints.server.ts`,
      `lib/public-waste-repository.server.ts`,
      `lib/public-waste-calendar-occurrences.ts`,
      `lib/public-waste-demo-runtime.ts` bereinigen. Datenfilter,
      Terminberechnung, Reminder und Fehlerfälle gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 30 — Öffentliche Waste-Oberfläche (2 Befunde)

- [ ] In `apps/public-waste-calendar-web/src/`
      `components/public-waste-calendar-panels.tsx` und `routes/index.tsx`
      bereinigen. Anzeige, Navigation und Barrierefreiheit gezielt testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## Tooling und MCP

### PR 31 — CI-Qualitäts-Gates (5 Befunde)

- [ ] In `scripts/ci/` `complexity-gate.ts`, `coverage-gate.ts`,
      `patch-coverage-gate.ts`, `sonar-hotspots.ts` und
      `sonar-new-code-gate.ts` bereinigen. Exitcodes, CLI-Optionen,
      Reportformat und Finding-Erkennung mit Skript-Tests und
      Skript-Typecheck erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 32 — CI-Vertrags- und IAM-Prüfer (5 Befunde)

- [ ] In `scripts/ci/` `verify-plugin-lifecycle-database-contract.ts`,
      `run-iam-evidence.ts`, `run-iam-authorize-performance.ts`,
      `check-server-package-runtime.ts`,
      `verify-graphile-worker-database-contract.ts` bereinigen.
      Prüfreihenfolge, Exitcodes, Fehlertexte und Redaction testen.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 33 — Operations-Migrationsskripte (2 Befunde)

- [ ] In `scripts/ops/runtime/` `migration-job.ts` und `goose.ts`
      bereinigen. Ausführungsreihenfolge, Cleanup, Exitcodes und
      Datenbank-Fehlerverhalten mit vorhandenen Ops-Tests erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 34 — Studio-MCP-Prozess und Tools (2 Befunde)

- [ ] In `packages/studio-mcp/src/` `process.ts` und `tools.ts`
      bereinigen. MCP-Tool-Verträge, Authentisierung und Prozess-Lifecycle
      mit gezielten Tests und Typprüfung erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## Abschluss nach PR 34

- [ ] Auf integriertem `main` einen vollständigen `pnpm complexity-gate`-Lauf
      mit null aktuellen `fileLines`-Verstößen und null verwaisten
      `fileLines`-Registereinträgen belegen; andere Metriken getrennt
      ausweisen.
- [ ] Die tatsächlich betroffenen arc42-Abschnitte 05, 08, 10 und 11 sowie
      `docs/development/complexity-quality-governance.md` auf den Endstand
      bringen; für IAM-/Security-Schnitte auch 04 und 06 prüfen.
- [ ] OpenSpec strikt validieren, alle PR-Nachweise und Checkboxen abgleichen
      und den Change erst nach Integration gemäß OpenSpec-Prozess archivieren.
