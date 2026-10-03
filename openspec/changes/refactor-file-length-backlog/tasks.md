# Lieferliste mit zwei Arbeitssträngen ab PR 23

PR 01 bis PR 22 wurden seriell bearbeitet. Ab PR 23 gelten die beiden
Arbeitsstränge unterhalb dieser Einleitung; jeder PR bleibt einzeln beschrieben.
Die erste Checkbox wird
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

**Strang A:** PR 23 → PR 24a → PR 24b → PR 25a → PR 25b → PR 26a → PR 26b → PR 26c → PR 26d → PR 31 → PR 32 → PR 33 → PR 34.
**Strang B:** PR 27 → PR 28 → PR 29 → PR 30. PR 29 beginnt erst nach dem
Merge von PR 26d, weil der öffentliche Waste-Kalender die dann integrierten
Waste-Verträge und Runtime-Pfade prüfen muss. PR 28 prüft vor Beginn seine
Mainserver-Waste-Schnittstelle gegen die laufenden Änderungen aus Strang A;
bei konkreter Kopplung wartet er auf den betroffenen Waste-PR.

Pro Strang arbeitet höchstens ein Subagent in einem eigenen Worktree. Innerhalb
eines Strangs beginnt der nächste PR erst nach dem Merge des Vorgängers;
zwischen den Strängen darf die Implementierung parallel laufen. Merges bleiben
einzeln: Vor dem finalen Nachweis wird jeder Branch mit dem dann aktuellen
`origin/main` synchronisiert. Nach einer Synchronisierung gelten Checks und
Review-Threads nur für den neuen exakten HEAD. Gemeinsame Änderungen an
`tasks.md`, `design.md` und der Complexity-Policy werden dabei aufgelöst,
bevor der PR gemergt wird. Der Schlusslauf wartet auf alle PRs 23 bis 34.

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

- [x] `apps/sva-studio-react/src/lib/interfaces-api.ts` nach
      Serverfunktionen und ihren bestehenden Berechtigungs- und
      Fehlerverträgen aufteilen. Instanzkontext, Autorisierung und
      Anfragevalidierung mit den API-Tests prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1638.json` mit
      Nutzertext eingebracht; PR #1638 am 02.10.2026 als
      `e97a456c56db59004cd2f07b844fb0b3e866a913` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 07e — Schnittstellen-Dialoge (1 Befund)

- [x] `apps/sva-studio-react/src/routes/interfaces/-interfaces-page.dialogs.tsx`
      entlang der vorhandenen Schnittstellentypen aufteilen. Eingaben,
      Dialogzustände, Tastaturbedienung und Fehlerrückmeldungen prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1644.json` eingebracht;
      PR #1644 am 02.10.2026 als
      `52b636bfd7ef930b88c8f72f9b1822e76fa4ad1c` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 07f — Instanz-Hook (1 Befund)

- [x] `apps/sva-studio-react/src/hooks/use-instances.ts` nach Lade- und
      Mutationsverantwortung aufteilen. Cache-Zustand, Fehler und
      Berechtigungsreaktionen mit den Hook-Tests prüfen.
- [x] Studio-Changelog `docs/changelog/entries/pr-1646.json` eingebracht;
      PR #1646 am 02.10.2026 als
      `94f8c78bd2159c86e022fd67c082531fd7f9114c` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 08a — Content-Liste (1 Befund)

- [x] `apps/sva-studio-react/src/routes/content/-content-list-page.tsx`
      entlang URL-Zustand, Listenanzeige und Löschaktionen aufteilen.
      Filter, Sortierung, Pagination, Zeilenrechte, Bulk-Aktionen und
      Projektionsmeldungen mit `-content-list-page.test.tsx` prüfen.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1648.json` mit
      passender `prNumber` und nutzerverständlichem `body` eingebracht;
      PR #1648 am 02.10.2026 als
      `59db02770b29eae2fe2c117a841b8d92d86fe44b` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 08b — Content-Editor (1 Befund)

- [x] `apps/sva-studio-react/src/routes/content/-content-editor-page.tsx`
      nach Formularzustand und Speicherung aufteilen. Validierung,
      Berechtigungen, Speichern und Fehlerrückmeldungen mit den vorhandenen
      Editor-Seitentests prüfen.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1649.json` mit passender `prNumber` und
      nutzerverständlichem `body` eingebracht; PR #1649 am 02.10.2026 als
      `00a5e1af0a0c5fe9b6b2aaae7118eecac7c336b9` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 08c — Waste-Import (1 Befund)

- [x] `apps/sva-studio-react/src/lib/waste-management-operations.import.ts`
      nach Importvalidierung und Ausführung aufteilen. Dateiformate,
      Vorschau, Fehler und Schreiboperationen mit den vorhandenen
      Import-/Operationstests prüfen.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1650.json` mit passender `prNumber` und
      nutzerverständlichem `body` eingebracht; PR #1650 am 03.10.2026 als
      `8f85d262e30cdaf010a34afc5668367c65d7c430` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 08d — Medien-Hook (1 Befund)

- [x] `apps/sva-studio-react/src/hooks/use-media.ts` nach Laden,
      Mutation und lokalem Zustand aufteilen. Upload, Auswahl,
      Löschung und Fehlerzustände mit den vorhandenen Hook-Tests prüfen.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1651.json` mit passender `prNumber` und
      nutzerverständlichem `body` in PR #1651 eingebracht. Finaler PR-HEAD
      `1a339058cddc1f1182ae4a60fdefa17e2e4de35c`: alle Checks grün,
      keine offenen Review-Threads; Merge-Commit
      `59901732612960db96b25ab5a9da9dc1961b5e0c`.

## IAM und Auth

### PR 09a — Self-Service-Profil (2 Befunde)

- [x] `packages/auth-runtime/src/iam-account-management/profile-handlers.ts`
      und `packages/iam-admin/src/profile-commands.ts` fachlich aufteilen.
      Die vorhandenen Profil-Handler- und Command-Tests prüfen Plattform- und
      Tenant-Grenzen, Feature-Gate, CSRF, Rate Limit, Keycloak-Synchronisierung
      samt Kompensation, Session-Seed mit Savepoint, Audit, Projektion,
      Fehlercodes und PII-arme Diagnose. Öffentliche Verträge bleiben gleich.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1652.json` mit passender `prNumber` und
      nutzerverständlichem `body` in PR #1652 eingebracht. Finaler PR-HEAD
      `87710c30cb0deb9c812d5602ed1550979fdf2878`: alle Checks grün,
      keine offenen Review-Threads; Merge-Commit
      `13f3f3d2691bd2ec8996d6091ecb371a7b287637`.

### PR 09b — IAM-Schema-Readiness und Diagnose (2 Befunde)

- [x] `packages/auth-runtime/src/iam-account-management/schema-guard.ts`
      und `diagnostics.ts` nach Schema-Prüfung und Fehlerklassifikation
      aufteilen. `schema-guard.test.ts` und `diagnostics.test.ts` prüfen
      Goose-Head, kritische Checks, Cache, Schema-Drift, RLS,
      Verschlüsselung und sanitierte Diagnosedaten. Readiness- und
      Fehlerverträge bleiben gleich.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1653.json` mit
      passender `prNumber` und nutzerverständlichem `body` in PR #1653
      eingebracht. Finaler PR-HEAD `d56d4f092da911c68adf90d3f2b81f3d671f0ad8`:
      alle Checks grün, keine offenen Review-Threads; Merge-Commit
      `0aa9c7777ad0aa368a11ac578277e46145298f22`.

### PR 09c — Tenant-Keycloak-Import (1 Befund)

- [x] `packages/auth-runtime/src/iam-account-management/user-import-sync-handler.ts`
      nach Identitätsabgleich und Persistenz aufteilen. Die vorhandenen
      `user-import-sync-handler.*.test.ts` prüfen Tenant-/Permission-Grenzen,
      Reparaturentscheidungen, Transaktions-Rollback, Reihenfolge,
      Teilfehler und PII-Redaction. Bericht und Fehlercodes bleiben gleich.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1655.json` mit
      passender `prNumber` und nutzerverständlichem `body` in PR #1655
      eingebracht. Finaler PR-HEAD `773fb0b9abd58bf35e09e7a2ca894c7558b4c982`:
      alle Checks grün, keine offenen Review-Threads; Merge-Commit
      `325038668bde144514f36b83edb163a1799a9d82`.

### PR 09d — Admin-Benutzerlesen und -aktualisierung (2 Befunde)

- [x] `packages/iam-admin/src/user-read-handlers.ts` und
      `user-update-handler.ts` nach Leseprojektion und Update-/Kompensations-
      schritten aufteilen. Die vorhandenen `user-read-handlers.test.ts` und
      `user-update-handler.test.ts` prüfen Tenant-/Plattform-Scope,
      Filter/Pagination, Projektion, technische Rollendifferenzen,
      Datenbank-Persistenz, Kompensation und Fehlerabbildung. Öffentliche
      Verträge und Autorisierung bleiben gleich.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1656.json` mit
      passender `prNumber` und nutzerverständlichem `body` in PR #1656
      eingebracht; PR #1656 am 02.10.2026 als
      `1140d7e4f56bb846e80cb5985f580d839af8cc74` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 10a — Organisations-Lesequeries (1 Befund)

- [x] `packages/iam-admin/src/organization-query.ts` unter 320 Zeilen
      bringen. Projektion/Filter, lesende SQL-Abfragen und Hierarchieoperationen
      entlang ihrer Verantwortung trennen; die bestehenden Exporte und den
      separaten `publicExports`-Befund erhalten. `organization-query.test.ts`
      und `organization-read-handlers.test.ts` prüfen Tenant-Scope,
      verschlüsselte Namen, Filter/Escaping, Sortierung/Pagination sowie
      Hierarchiefehler und Subtree-Update. Keine DB- oder API-Änderung.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1657.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      PR #1657 eingebracht; PR #1657 am 03.10.2026 als
      `72059978e40fbed48838297f15834b09540c0ddd` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 10b — Organisationsmutationen (1 Befund)

- [x] `packages/iam-admin/src/organization-mutation-handlers.ts` nach
      Request-/Autorisierungsgrenze und Create-/Update-/Mitgliedschafts-
      transaktionen aufteilen. `organization-mutation-handlers.test.ts`
      sichert Tenant- und Parent-Scope, Idempotenz, Rate-Limit,
      Credential- und Membership-Schreibfolgen, Fehler und Kompensation.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1658.json` mit
      passender `prNumber` und nutzerverständlichem `body` in PR #1658
      angelegt; PR #1658 am 03.10.2026 als
      `8588d9741b3947fef8b14b2c0934c5e30b690f0a` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 10c — Rollenpersistenz (1 Befund)

- [x] `packages/iam-admin/src/role-mutation-persistence.ts` nach
      Permission-Normalisierung und Rollen-/Zuordnungs-Persistenz trennen.
      `role-mutation-persistence.test.ts` sowie Create-/Update-/Delete-Tests
      sichern Tenant-Scope, Verfügbarkeit von Berechtigungen, Audit,
      Rollback und Sync-Vertrag.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1659.json` mit
      passender `prNumber` und nutzerverständlichem `body` in PR #1659
      angelegt; PR #1659 am 03.10.2026 als
      `7fde5f1cdb0801b604e1d2d5b26a4b02b4079116` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.

### PR 10d — Rollen-Reconcile (1 Befund)

- [x] `packages/iam-admin/src/reconcile-core.ts` nach Katalogabgleich,
      Identity-Provider-Abgleich und Ergebnis-/Fehlerpersistenz aufteilen.
      `reconcile-core.test.ts` und `reconcile-handler.test.ts` sichern
      Tenant-Grenze, Import-/Update-Entscheidungen, Idempotenz,
      Fehlerbericht und Audit.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1660.json` mit
      passender `prNumber` und nutzerverständlichem `body` eingebracht;
      PR #1660 am 03.10.2026 als
      `ca43b1a4c47bc204861a624e4ed9f0be0148df37` gemergt.
      Changelog- und Complexity-Gate vor Merge grün.

### PR 10e — Moderne und Legacy-Gruppenmutationen (2 Befunde)

- [x] `packages/iam-admin/src/group-mutation-handlers.ts` und
      `legacy-group-mutation-handlers.ts` an ihren jeweiligen
      Gruppenoperationen und gemeinsamen Vertragsgrenzen aufteilen.
      Beide vorhandenen Mutationstestdateien sichern Auth-/Tenant-Scope,
      Rollen- und Mitgliedschaftsänderungen, Fehlerabbildung und Audit;
      moderne und Legacy-Endpunkte bleiben kompatibel.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1661.json` mit
      passender `prNumber` und nutzerverständlichem `body` in PR #1661
      angelegt; PR #1661 am 03.10.2026 als
      `c7871c1752b19ed36390ffab6dc1796d09730e95` gemergt.
      Changelog- und Complexity-Gate vor Merge grün.

### PR 10f — Öffentliche IAM-Admin-Exporte (1 Befund)

- [x] `packages/iam-admin/src/index.ts` unter 320 Zeilen bringen, ohne
      Namen oder Laufzeitpfade der veröffentlichten Package-API zu ändern.
      `index.test.ts`, Package-Build und Server-Runtime-Check sichern
      Exportparität; der separate `publicExports`-Befund wird nur bei
      tatsächlich erfüllter Schwelle entfernt.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1662.json` mit
      passender `prNumber` und nutzerverständlichem `body` in PR #1662
      eingebracht; PR #1662 am 03.10.2026 als
      `89f79be9cd52a77c4d1665df7c53643a7618a4d2` gemergt.
      Alle GitHub-Gates für den finalen HEAD grün, keine offenen Threads.
      Der separate `publicExports`-Befund bleibt registriert.

### PR 11a — Betroffenenrechte-HTTP-Handler (1 Befund)

- [x] `packages/auth-runtime/src/iam-data-subject-rights/core.ts` nach
      Export-/Status-, Antrags-/Korrektur-, Legal-Hold-/Widerspruchs- und
      Admin-Lesepfaden aufteilen. `core.test.ts` sichert Auth-/Tenant-Grenze,
      CSRF, Zugriffsprüfung, Datenintegrität und Fehlerabbildung; öffentliche
      Handler und ihre Route-Bindings bleiben unverändert. Umsetzung in PR #1663;
      `core.ts` bleibt der bestehende Route-Importpfad und enthält den
      Self-Service-Antrag mit Commit-gebundener Session-Revocation.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1663.json` mit passender `prNumber` und
      Nutzertext in PR 11a angelegt; PR #1663 am 03.10.2026 als
      `3b5b8247c328e92d73bf74457d073b17dd22dbee` gemergt.
      Changelog- und Complexity-Gate vor Merge grün.

### PR 11b — DSR-Export und Queue (3 Befunde)

- [x] `packages/auth-runtime/src/iam-data-subject-rights/export-worker.ts`
      sowie `packages/iam-governance/src/dsr-export-flows.ts` und
      `dsr-export-payload.ts` entlang Queue-/Job-Abschluss,
      Idempotenz-/Exportantrag und Payload-/Formatprojektion aufteilen.
      Die jeweiligen Tests sichern Tenant-Scope, Export-Vollständigkeit,
      Verschlüsselung, JSON/CSV/XML, Retry-/Fehlerstatus und Audit.
      Umsetzung in PR #1664; der finale PR-HEAD
      `1c4dace13838e66b5a09898a4acd442cae414661` wurde am
      03.10.2026 als `4bb372c8bca46b8053ca138ce65a4e2e291a9373`
      gemergt.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1664.json` mit
      passender `prNumber` und Nutzertext in PR #1664 angelegt;
      Changelog- und Complexity-Gate vor Merge grün.

### PR 11c — DSR-Leseprojektionen (2 Befunde)

- [x] `packages/iam-governance/src/dsr-read-models.mappers.ts` und
      `dsr-read-models.self-service-queries.ts` nach Admin-/Self-Service-
      Projektion und Query-/Detailauflösung aufteilen. Die Read-Model-Tests
      sichern Tenant-/Account-Scope, Statusabbildung, Suche, Reihenfolge,
      Pagination und Fall-Details. Umsetzung in PR #1665; finaler PR-HEAD
      `13678bf393b156830524af7e56b539ea3292b566` mit grünen Gates
      am 03.10.2026 als `268603dc6a55e4c5e952123af2b7b9a8132417e7`
      gemergt.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1665.json` mit
      passender `prNumber` und Nutzertext in PR #1665 anlegen;
      Changelog-Gate vor Merge grün.

### PR 11d — Governance-Workflow-Ausführung (1 Befund)

- [x] `packages/iam-governance/src/governance-workflow-executor.ts` nach
      Berechtigungsänderung, Delegation/Impersonation und Rechtsannahme
      aufteilen. `governance-workflow-executor.test.ts` und Policy-Tests
      sichern Freigabegrenzen, Zustandswechsel, Audit, Ablauf und Fehlerpfade.
      Umsetzung in PR #1666; Merge `73dcb090eb934eb74e1671e32f92b8ec0ffc0aee`
      nach 25 erfolgreichen GitHub-Checks am HEAD `a5b6325ee90029ffd6304f11097f55fe0a13da1b`.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1666.json` mit
      passender `prNumber` und Nutzertext in PR #1666 anlegen;
      Changelog-Gate vor Merge grün.

### PR 11e — Governance-HTTP-Handler (1 Befund)

- [x] `packages/auth-runtime/src/iam-governance/core.ts` nach Workflow-,
      Falllisten-, Compliance-/Consent-Export- und Self-Service-Handlern
      aufteilen. `core.test.ts` sichert Auth-/Tenant-Grenze, CSRF,
      Berechtigungen, CSV-Ausgabe und Fehlerabbildung; die bestehenden
      Routen und der Governance-Workflow-Vertrag bleiben erhalten.
      Umsetzung in PR #1667; Merge `0743228c4fc9ab585f0fd462e280191fe16b22b7`
      nach 25 erfolgreichen GitHub-Checks am HEAD `251085d0972683ccd45fbb851676009742841360`.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1667.json` mit
      passender `prNumber` und Nutzertext in PR #1667 anlegen;
      Changelog-Gate vor Merge grün.

### PR 11f — Rechtstexte-Mutationen (2 Befunde)

- [x] `packages/iam-governance/src/legal-text-repository.ts` und
      `legal-text-mutation-handlers.ts` nach Persistenz/Zielgruppen und
      Request-/Idempotenzgrenze aufteilen. Repository-, Mutation- und
      HTTP-Tests sichern Tenant-Scope, Rollen-/Gruppenziele, Sanitizing,
      Konflikte, Audit und Fehlerabbildung. Umsetzung in PR #1668;
      PR #1668 am 03.10.2026 nach grünen Gates am HEAD
      `514ffb68d6898a2265eed10dd074925aef9ecca8` als
      `8608bdf376f469b9d5510bcba2fb18dafac9795b` gemergt.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1668.json` mit
      passender `prNumber` und Nutzertext in PR #1668 anlegen;
      Changelog-Gate vor Merge grün.

### PR 12a — Auth-Routen (1 Befund)

- [x] `packages/auth-runtime/src/auth-route-handlers.ts` entlang
      Login/Account-Action, Callback, `/auth/me`, Logout und gemeinsamen
      Cookie-/Fehlerhilfen aufteilen. Die sieben Exporte von
      `runtime-routes.ts` und die OTEL-Initialisierung beim Modulimport
      erhalten. `auth-route-handlers.test.ts` sowie direkte Auth-Server-
      und Session-Tests sichern Redirect/State, Tenant-/Session-Scope,
      Fail-Closed, CSRF, Cookie-Rotation, Silent SSO, Audit-Redaction und
      Response-/Header-Verträge. Auth-/Security- und Server-Runtime-Gates
      aus `DEVELOPMENT_RULES.md` Abschnitt 5.2 ausführen. Umsetzung in
      PR #1669; am 03.10.2026 nach grünen Gates am HEAD
      `bed1d8ab635954638834cc12b402ac344afec063` als
      `43e504339cab1a85442cbc54ce89502fe0df2f95` gemergt.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1669.json` mit passender `prNumber`
      und nutzerverständlichem `body` in PR #1669 anlegen;
      Changelog-Gate vor Merge grün.

### PR 12b — Redis-Session (1 Befund)

- [x] `packages/auth-runtime/src/redis-session.ts` nach
      Session-Speicherung, Login-State und Session-Kontrolle aufteilen.
      `redis-session.test.ts`, `auth-server/session.test.ts` und
      `auth-route-handlers.test.ts` sichern TTL, Rotation, atomaren
      State-Verbrauch, Tenant-Bindung, Ausfall/Retry und Fail-Closed.
      Auth-/Security- und Server-Runtime-Gates aus Abschnitt 5.2 ausführen.
      Umsetzung in PR #1670; am 03.10.2026 nach grünen Gates am HEAD
      `bf553d475cd3f0e5224a3d511f6a53194dc0e50a` als
      `5badc734e20e572c92cd010fce51a42ae18193ec` gemergt.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1670.json` mit passender `prNumber`
      und nutzerverständlichem `body` in PR #1670 anlegen;
      Changelog-Gate vor Merge grün.

### PR 12c — Audit-DB-Sink (1 Befund)

- [x] `packages/auth-runtime/src/audit-db-sink.ts` nach
      Event-Mapping, tenantgebundener Persistenz und Fehlerabbildung
      aufteilen. `audit-db-sink.test.ts` und direkte Audit-Consumer-Tests
      sichern Redaction/PII-Schutz, Tenant-Grenze, Event-Reihenfolge und
      Ausfallverhalten; Server-Runtime- und Auth-/Security-Gates prüfen.
      Umsetzung in PR #1671; am 03.10.2026 nach grünen Gates am HEAD
      `2fb15b8ed179cef965f2da4289e9a54436837709` als
      `6f8d1559ab1c2bcdb6406ad06b9a4003ca64afa2` gemergt.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1671.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      PR #1671 anlegen; Changelog-Gate vor Merge grün.

### PR 12d — IAM-Authorization shared (1 Dateilängenbefund)

- [x] `packages/auth-runtime/src/iam-authorization/shared.ts` entlang
      Scope-/DB-Zugriff und Autorisierungsantwort aufteilen. Direkte
      Authorization- und Handler-Tests sichern Tenant-/Permission-Grenzen,
      Fail-Closed, Fehlerabbildung und bestehende Exporte. Separate
      Cyclomatic- und `publicExports`-Befunde nur bei wirklich erfüllter
      Schwelle entfernen; Auth-/Security- und Server-Runtime-Gates prüfen.
      Umsetzung in PR #1672; am 03.10.2026 nach grünen Gates am HEAD
      `02ebda80531d2fc0928e06a6a32b0a1020459aab` als
      `09a3dfd636d9c33a9ad7681742ff6449311fb492` gemergt.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1672.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      PR #1672 anlegen; Changelog-Gate vor Merge grün.

### PR 13a — Content-Repository und Write-Helfer (2 Befunde)

- [x] `packages/auth-runtime/src/iam-contents/repository.ts` und
      `iam-contents/repository-write-helpers.ts` entlang Listen-/Detail-Lesezugriff,
      Ownership-Zielauflösung, Mutationen, Author-Display-Regeln, SQL-Writes
      und Activity-Emission aufteilen. Bestehende `repository.js`- und
      `repository-write-helpers.js`-Exporte, Tenant-Scope, parametrisierte SQL,
      Transaktion, History-/Activity-Reihenfolge, Ownership- und
      State-Validation-Verträge erhalten. `repository.test.ts`,
      `repository-helpers.test.ts` und direkt betroffene
      `external-content-*.test.ts` ausführen; Auth-/Data-/Security- und
      Server-Runtime-Gates prüfen. Abschluss: PR #1673, HEAD
      `5bcf0b0d999f7cabc7bd511941906ab092194a09`, Merge-Commit
      `0126ed38d631bdf6762baeea8a93123242dbeed4`.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1673.json` mit passender `prNumber` und
      nutzerverständlichem `body` in PR #1673 angelegt; Changelog-Gate vor
      Merge grün.

### PR 13b — Media-Verarbeitung und S3-Speicher (2 Befunde)

- [x] `packages/auth-runtime/src/iam-media/processing.ts` und
      `iam-media/storage-s3.ts` nach Bildverarbeitung und S3-Operationen
      aufteilen. Media-/Storage-Tests sichern Größen-, MIME- und
      Berechtigungsvalidierung, Tenant-/Objektschlüsselbindung, Upload-/Delete-
      Reihenfolge sowie Fehlerabbildung; Auth-/Security- und
      Server-Runtime-Gates prüfen. Abschluss: PR #1674, HEAD
      `dcb18fb7528fd8971b077d15733c8df30616649a`, Merge-Commit
      `59c90bcac7d05ed6f2b1e3d0d9750ac01511c709`.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1674.json` mit passender `prNumber` und
      nutzerverständlichem `body` in PR #1674 anlegen;
      Changelog-Gate vor Merge grün.

### PR 13c — Plugin-Server-Dispatcher (1 Befund)

- [x] `packages/auth-runtime/src/plugin-server-handlers/dispatcher.ts`
      entlang Request-Validierung, Tenant-/Plugin-Autorisierung und Dispatch
      aufteilen. Dispatcher-/Handler-Tests sichern Plugin-Namespace,
      Fail-Closed, Fehlerstatus und Response-Vertrag; Auth-/Security- und
      Server-Runtime-Gates prüfen. Abschluss: PR #1675, HEAD
      `a1eb1c46658cd0973a1cc8b97dd540dcae6b4834`, Merge-Commit
      `22b05ec30f3f5a737aa6cc2d6d0e30e61677881f`.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1675.json` mit passender `prNumber` und
      nutzerverständlichem `body` in PR #1675 angelegt; Changelog-Gate grün.

### PR 13d — Plugin-Operations Runner (2 Befunde)

- [x] `packages/auth-runtime/src/plugin-operations/runner-registry.ts`
      und `plugin-operations/runner-worker.ts` entlang Registrierung,
      Claim/Ausführung und Retry aufteilen. Registry-/Worker-Tests sichern
      Lease-/Attempt-Grenzen, Idempotenz, Tenant-/Plugin-Bindung und
      Terminalzustände; Auth-/Data-/Security- und Server-Runtime-Gates prüfen.
      Abschluss: PR #1676, HEAD
      `00626994874e3ca2dde0d44c40a095ed6bec1edc`, Merge-Commit
      `d63abc92556e4539ba795b18bbb08fd95bcf0c1b` nach grünen Gates.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1676.json` mit passender `prNumber` und
      nutzerverständlichem `body` in PR #1676 angelegt; Changelog-Gate grün.

### PR 13e — Plugin-Operations Job-State-Writer (1 Befund)

- [x] `packages/auth-runtime/src/plugin-operations/job-state-writer.ts`
      nach Zustandsvalidierung und Persistenz aufteilen. Writer-/Worker-Tests
      sichern erlaubte Übergänge, Tenant-/Job-Bindung, Attempt-/Lease-Prüfung,
      Event-Reihenfolge und Wiederholbarkeit; Auth-/Data-/Security- und
      Server-Runtime-Gates prüfen. Abschluss: PR #1677, HEAD
      `69bb84d2de9958de948542bac590841972f41288`, Merge-Commit
      `9c4de06b19dbe0f1aeb72d8f315d8fa34777754d` nach grünen Gates.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1677.json` mit passender `prNumber` und
      nutzerverständlichem `body` in PR #1677 angelegt; Changelog-Gate vor
      Merge grün.

### PR 13f — Plugin-Tenant-Lifecycle-Orchestrator (1 Befund)

- [x] `packages/auth-runtime/src/plugin-tenant-lifecycle/orchestrator.ts`
      entlang Plan-/Ausführungsschritten und Ergebnis-/Retry-Abbildung
      aufteilen. Orchestrator-/Lifecycle-Tests sichern Tenant- und
      Generation-Bindung, Reihenfolge, Idempotenz, Recovery und
      Terminalzustände; Auth-/Data-/Security- und Server-Runtime-Gates prüfen.
      Abschluss: PR #1678, HEAD `5868f939cba7da197f496e70d20ffd559b8a100d`,
      Merge-Commit `e5ba769bae7c0301f74e92a65b73022b3b3cae30` nach grünen Gates.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1678.json` mit passender `prNumber` und
      nutzerverständlichem `body` angelegt; Changelog-Gate vor Merge grün.

## Daten und Provisionierung

### PR 14a — Medien-Repository (1 Befund)

- [x] `packages/data-repositories/src/media/index.ts` entlang Asset-,
      Upload-, Storage-/Referenz- und Content-Save-Verantwortungen unter das
      Dateilimit bringen. `createMediaRepository`, `mediaStatements`, alle
      öffentlichen Typen, SQL-Text und Parameterreihenfolge bleiben erhalten;
      Tenant-Bindung, Claim-/Quota-Atomizität und Content-Save-Recovery mit
      den vorhandenen Media-Tests und Data-/Security-/Runtime-Gates prüfen.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Nachweis: PR #1679 mit HEAD
      `f967132c26da0594a790b633dc102a09986b35a0` als
      `5e2e6fdfae45e1f60360f4fa6d74d71cb1ff980e` gemergt;
      `docs/changelog/entries/pr-1679.json` enthalten.

### PR 14b — Plugin-Operations-Repository (1 Befund)

- [x] `packages/data-repositories/src/plugin-operations/index.ts` nach
      Job-State-, Lease-/Attempt- und Event-Persistenz aufteilen. Öffentlichen
      Entrypoint, SQL-Parameter, Tenant-/Job-Bindung, Zustandsübergänge und
      atomare Event-Reihenfolge mit Repository-/Worker-Tests und
      Data-/Security-/Runtime-Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Nachweis: PR #1680 mit HEAD
      `528e5d00be1c3c42d7f1fa9657d3ce8016eae813` als
      `607d3e372e651502889b741b7f1d275962279e79` gemergt;
      `docs/changelog/entries/pr-1680.json` enthalten.

### PR 14c — IAM-SQL-Statements (1 Befund)

- [x] `packages/data-repositories/src/iam/repositories/statements.ts` nach
      bestehenden IAM-Ressourcen gruppieren. Statement-Exports, SQL-Text,
      Platzhalterreihenfolge, Tenant-Filter und Rückgabemapping mit den
      IAM-Repository-Tests und Data-/Security-/Runtime-Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Nachweis: PR #1681 mit HEAD
      `f636c7d488a20e9f6776060efb8b6f2c0a7a46a2` als
      `d144df9dab3e05d1d0082bbede391975ddb8fe30` gemergt;
      `docs/changelog/entries/pr-1681.json` enthalten.

### PR 14d — Instanz-Integrationen (1 Befund)

- [x] `packages/data-repositories/src/integrations/instance-integrations.server.ts`
      entlang DB-Transaktion/Pool/Executor und Cache-Loader aufteilen.
      Serverseitige Exportform, Mandantengrenzen via `set_config`,
      BEGIN/COMMIT/ROLLBACK/Re-throw, Pool-Reset, Logger-Ereignisse,
      Cache-Schlüssel und Invalidierung mit den Integrationstests und
      Data-/Security-/Runtime-Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Nachweis: PR #1682 mit HEAD
      `656c1d46c12a93528466103496b21eb72ffe622c` als
      `68277cd4343c456f8d2ec0fba2b470254775d17b` gemergt;
      `docs/changelog/entries/pr-1682.json` enthalten.

### PR 15a — Instanz-Repository-Vertrag und Parent-Provisionierung (2 Befunde)

- [x] `packages/data-repositories/src/instance-registry/repository-contract.ts`
      und `repository-provisioning.ts` unter das Dateilimit bringen. Den
      öffentlichen `InstanceRegistryRepository`-Vertrag und sämtliche
      bestehenden Exporte erhalten; SQL-Text und Parameterreihenfolge sowie
      Tenant-Bindung, Idempotenz, Claim-/Lease- und Retry-Guards,
      Planbestätigung, Remediation und Audit-Reihenfolge mit gezielten
      Repository-Tests und Data-/Security-/Runtime-Gates nachweisen.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Nachweis: PR #1683 mit HEAD
      `b2cd22fd7ed5078fb096778658ee7c48ad2724c9` als
      `17ed00be03cefabeb5937ede139eb72dec421c28` gemergt;
      `docs/changelog/entries/pr-1683.json` enthalten.

### PR 15b — Instanz-Repository-Server (1 Befund)

- [x] `packages/data-repositories/src/instance-registry/server.ts` entlang
      der vorhandenen Pool-, Host- und Server-Fassaden unter das Dateilimit
      bringen. Öffentliche Exporte, URL-Auflösung, Pool-/Client-Lifecycle,
      Host-Cache/Fallback, Repository-Aufrufe mit Instance-ID-Filter und
      Fehlerweitergabe mit
      Server-Repository-Tests sowie Data-/Security-/Runtime-Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Nachweis: PR #1684 mit HEAD
      `da6327abda420b70fe16e880f1fb1a61e4178ab3` als
      `c3e4c1b3d5c0134a17e82484691f55a0ca8ebff6` gemergt;
      `docs/changelog/entries/pr-1684.json` enthalten.

### PR 15c — Keycloak-Provisionierungszustand (1 Befund)

- [x] `packages/instance-registry/src/provisioning-auth-state.ts` entlang
      Client-Vertrag, Tenant-Admin-Bootstrap, Realm-Readback und
      Artifact-Reconcile unter das Dateilimit bringen. Öffentlichen Subpath,
      Tenant-/Realm-Bindung, Ownership, Secret-Readback, Idempotenz,
      Reihenfolge und Cleanup-/Fehlerzuordnung mit den vorhandenen
      Provisionierungstests sowie Auth-/Security-/Runtime-Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

### PR 15d — Keycloak-Auth-Evaluation und -Plan (2 Befunde)

- [x] `packages/instance-registry/src/provisioning-auth-evaluation.ts` und
      `provisioning-auth-plan.ts` entlang der bestehenden Preflight-,
      Ownership- und Plan-Grenzen unter das Dateilimit bringen. Tenant-/Realm-
      Ownership, Plan-Fingerprint, Gate-Status, Fehlerklassen und
      Bestätigungsbedingungen mit gezielten Tests sowie Auth-/Security-/
      Runtime-Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Merge-Nachweis: PR #1688, HEAD
      `01d8a6ebf5730332ee97feb081580fdf32941010`, Merge-Commit
      `85cf9cded0b1b6334142e0beadc77eff438dff3e`; Changelog
      `docs/changelog/entries/pr-1688.json`.

### PR 15e — Tenant-Provisionierungsschritte (1 Befund)

- [x] `packages/instance-registry/src/tenant-provisioning-steps.ts` nach
      vorhandenen Provisionierungsphasen unter das Dateilimit bringen.
      Schrittfolge, idempotente Wiederaufnahme, Lease-/Retry-Grenzen,
      Terminalstatus und Audit-Ereignisse mit den Orchestrator-Tests sowie
      Auth-/Data-/Security-/Runtime-Gates erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` anlegen;
      Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1689, HEAD
      `618c3f6b249ebe2fe435381c610d1a9e96cefc88`, Merge-Commit
      `0d311774251251b13cd8923bdf664be6c8e13621`; Changelog
      `docs/changelog/entries/pr-1689.json`.

### PR 16a — Keycloak-Ausführung (1 Befund)

- [x] `packages/instance-registry/src/service-keycloak-execution.ts` entlang
      Queue/Handler, Worker-Snapshot, Run-Ausführung und Finalisierung unter
      das Dateilimit bringen. Öffentliche Exporte, Run-/Tenant-/Attempt-/Lease-
      Bindung, Plan-Fingerprint, Secret-Synchronisierung, Cleanup,
      Fehlercodes und Terminal-/Retry-Folge mit Execution-, Failure-, Payload-,
      Finalize- und Reconcile-Tests sowie Auth-/Data-/Security-/Runtime-Gates
      erhalten; bestehende Complexity-Befunde der Datei gesondert messen.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` anlegen;
      Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1690, HEAD
      `8c0c560138a4f25ad3e2ef380a182b10854b6c6b`, Merge-Commit
      `13ddd101ae1fb2289b44ebe23036fa73b92bd27b`; Changelog
      `docs/changelog/entries/pr-1690.json`.

### PR 16b — Keycloak-Reader (1 Befund)

- [x] `packages/instance-registry/src/service-keycloak-readers.ts` entlang
      Status, Preflight und Plan unter das Dateilimit bringen. Tenantbindung,
      Read-Only-Verhalten und Plan-Fingerprint mit Reader-/Plan-Tests und
      zuständigen Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Merge-Nachweis: PR #1691, HEAD
      `6203ac1a2634d1c6130ee8b2016b47f9f606c590`, Merge-Commit
      `00f035444a07482aee24d11d912124a9df8d1911`; Changelog
      `docs/changelog/entries/pr-1691.json`.

### PR 16c — Keycloak-Audit (1 Befund)

- [x] `packages/instance-registry/src/service-audit-keycloak.ts` entlang
      Reader, Mapping und Checks unter das Dateilimit bringen. Audit-Umfang,
      PII-Schutz und Fehlerklassen mit gezielten Audit-Tests und zuständigen
      Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Merge-Nachweis: PR #1692, HEAD
      `53857c310f5ff30630318d20b29d0b8c464b5850`, Merge-Commit
      `ece5097cd712846092d9e39302a15d7673b221b4`; Changelog
      `docs/changelog/entries/pr-1692.json`.

### PR 16d — Modul-Mutationen (1 Befund)

- [x] `packages/instance-registry/src/service-module-mutations.ts` entlang
      Sync und Audit unter das Dateilimit bringen. Modulreihenfolge,
      Idempotenz, Autorisierung und Audit mit Mutationstests und zuständigen
      Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Merge-Nachweis: PR #1693, HEAD
      `d7887f00e2083964837760d7bdf0e6e5bad71b77`, Merge-Commit
      `ad61e367bdb1e0931c9820810b643ee8214d6383`; Changelog
      `docs/changelog/entries/pr-1693.json`.

### PR 16e — Draft-Readiness und Service-Helfer (2 Befunde)

- [x] `packages/instance-registry/src/service-draft-readiness.ts` und
      `service-helpers.ts` nach den vorhandenen Readiness- und
      Projektionsgrenzen unter das Dateilimit bringen. Status, Validierung,
      Tenantbezug und Projektionen mit Readiness-/Service-Tests und zuständigen
      Gates erhalten.
- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit passender
      `prNumber` und nutzerverständlichem `body` anlegen; Gate vor Merge grün.

      Merge-Nachweis: PR #1694, HEAD
      `6e030441475045855535aac030b5f364610b560c`, Merge-Commit
      `e4dbeeaec8b7468ea10d74201ebbb2ecf2bf2ff5`; Changelog
      `docs/changelog/entries/pr-1694.json`.

## Fachplugins

### PR 17 — Events-Editor (3 Befunde)

- [x] In `packages/plugin-events/src/` `events.detail-page.tsx`,
      `plugin.translations.ts`, `events.detail-form.ts` bereinigen.
      Feldpfade, Übersetzungen, Validierung und Speichersequenz testen.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1695, HEAD
      `d66c8f6cd544420fe716cbad32d249ad2a72c2f0`, Merge-Commit
      `17bf730ac58d35376bc83c52a513c20761fff159`; Changelog
      `docs/changelog/entries/pr-1695.json`.

### PR 18 — News-Editor (3 Befunde)

- [x] In `packages/plugin-news/src/` `news.detail-page.tsx`,
      `plugin.translations.ts`, `news.detail-form.ts` bereinigen.
      Editor- und Übersetzungsvertrag mit gezielten Tests erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1697, HEAD
      `136aae62271df4ffc930a1bd0fa0c058ed2479a1`, Merge-Commit
      `0999c6f8a288ef4a6a13b221a623ca78a24965c8`; Changelog
      `docs/changelog/entries/pr-1697.json`.

### PR 19 — Generic-Items-Editor (2 Befunde)

- [x] In `packages/plugin-generic-items/src/`
      `generic-items.detail-content-tab.tsx` und
      `generic-items.detail-page.tsx` bereinigen. Content-Tab-Ownership,
      Formular- und Medienverträge gezielt testen.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1698, HEAD
      `ca55010b5002efdd60b283b0161bb11723d6b243`, Merge-Commit
      `d239bbc395d13591d7d8919212dc6246d7140cdc`; Changelog
      `docs/changelog/entries/pr-1698.json`.

### PR 20 — POI-Editor (1 Befund)

- [x] `packages/plugin-poi/src/poi.detail-page.tsx` entlang bestehender
      POI-Abschnitte bereinigen. Formular-, Geocoding- und
      Berechtigungsverhalten gezielt testen.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1699, HEAD
      `5e1baf8d7a2e43c11d76607672b18507d7456821`, Merge-Commit
      `f6e840cad623162ce01628b5e30692fe0a9c6809`; Changelog
      `docs/changelog/entries/pr-1699.json`.

### PR 21 — Projects-Seite (1 Befund)

- [x] `packages/plugin-projects/src/projects.pages.tsx` entlang der
      bestehenden Seitenverantwortung bereinigen. Listen-, Detail- und
      Speicherverhalten gezielt testen.

- [x] Studio-Changelog `docs/changelog/entries/pr-1700.json` mit passender
      `prNumber` und nutzerverständlichem `body` angelegt; Changelog-Gate vor
      Merge grün. Merge-Nachweis: PR #1700, HEAD
      `f63a6f0902f0ecad362ffddb933a547f729d3280`, Merge-Commit
      `4f96d3ed4fd9167ebdcc14e3b436b5b0df7e51fe`.

### PR 22 — Cockpit-Cards-Seite (1 Befund)

- [x] `packages/plugin-cockpit-cards/src/cockpit-cards.pages.tsx`
      bereinigen. Sichtbarkeit, Reihenfolge und Save-/Reload-Verhalten
      gezielt testen.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1701, HEAD
      `d20d2dedeb12f4bef23da4536daa6a2e439fe6e6`, Merge-Commit
      `e4b8aa62d719f7ab8b2dc8d2ac69d404e2bec8dc`; Changelog
      `docs/changelog/entries/pr-1701.json`.

## Waste-Management

### PR 23 — Waste-Plugin-Einstieg und Übersetzungen (5 Befunde)

- [x] In `packages/plugin-waste-management/src/` `plugin.tsx`,
      `plugin.translations.de.tours.ts`,
      `plugin.translations.en.tours.ts`,
      `plugin.translations.de.scheduling.ts`,
      `plugin.translations.en.scheduling.ts` bereinigen. Registrierung,
      Schlüsselparität und bestehende Texte erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1703, HEAD
      `267b3ab7744981ef25d28ba154c56351a1288962`, Merge-Commit
      `3a7fc93fba380406b25dc4ba4b753e2c8cb5ebb7`; Changelog
      `docs/changelog/entries/pr-1703.json`.

### PR 24a — Waste-Plugin-Import und Tourenlogik (4 Befunde)

- [x] In `packages/plugin-waste-management/src/`
      `waste-management.tools.import-section.parts.tsx`,
      `waste-management.tours.presentation.ts`,
      `waste-management.tools.actions.ts`,
      `waste-management.tours.shared.ts` bereinigen. Import-Wizard,
      Job-Aktionen, Tourenfilter und Kalendervorschau mit gezielten UI-,
      Unit- und Typprüfungen erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1705, HEAD
      `4271d847d1045620bc29c2ee4bb7938dcf7aabd3`, Merge-Commit
      `fa264443ccebeb454c6ee7dbf9ab319f322ae06e`; Changelog
      `docs/changelog/entries/pr-1705.json`.

### PR 24b — Waste-Plugin-Ortsauswahl und individuelle Tourtermine (3 Befunde)

- [x] In `packages/plugin-waste-management/src/`
      `waste-management.tours-custom-dates.tsx`,
      `waste-management.master-data-locations-table.views.tsx` und
      `waste-management.tours-assignments-dialog.tsx` bereinigen.
      Individuelle Abholtermine, Ortsauswahl, Zuordnungsdialoge und
      Tabellenaktionen mit gezielten UI- und Typprüfungen erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1707, HEAD
      `300749117b0414a04cc096cb0ee668d0a7c69be0`, Merge-Commit
      `2ffce9bca5267c909f7d89ffd1fd72a86a4e7567`; Changelog
      `docs/changelog/entries/pr-1707.json`.

### PR 25a — Waste-Vertragsfunktionen (4 Befunde)

- [x] In `packages/waste-management-contracts/src/`
      `waste-management-settings-public-config.ts`,
      `waste-management-location-tour-pickup-date-planner.ts`,
      `waste-management-output.render.ts`,
      `waste-management-location-tour-pickup-date-parser.ts` bereinigen.
      CSV-Parsing, Importplanung, PDF-Ausgabe und öffentliche Settings
      mit gezielten Vertrags-, Typ- und Runtime-Tests erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1711, HEAD
      `a5df07359fb4f73bb9b5bcf538f7ccb189606bf6`, Merge-Commit
      `ff7095317815ad9d5624c2677fe947e9b42f0c40`; Changelog
      `docs/changelog/entries/pr-1711.json`.

### PR 25b — Waste-Runtime-Validierung und Settings (4 Befunde)

- [x] In `packages/waste-management-runtime/src/` `http-schemas.ts`,
      `handlers/settings-write-support.ts`, `handlers/settings-shared.ts`,
      `handlers/types.ts` bereinigen. Request-Validierung,
      Settings-Lesen und -Schreiben sowie Handler-Verträge mit
      gezielten Runtime-, Typ- und Unit-Tests erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1712, HEAD
      `8664dd81c6a6b75cfc7c564dc6528a5f381487b9`, Merge-Commit
      `099f495e7ae00009e57fe9ea141dfc13dce89ec8`; Changelog
      `docs/changelog/entries/pr-1712.json`.

### PR 26a — Waste-Server-Lader (1 Befund)

- [x] In `packages/waste-management-runtime/src/server-loaders.ts`
      die Tenant-gebundenen Lader nach Datenbereichen trennen.
      Tenant-Scope, Repository-Bindung und Antworten mit gezielten
      Loader- und Server-Runtime-Tests erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

      Merge-Nachweis: PR #1713, HEAD
      `9638df0ad89d1f7e73df1153c103807d1f32dc0d`, Merge-Commit
      `b7600a090e303c673ac356b4dce60ebc57cf8aaa`; Changelog
      `docs/changelog/entries/pr-1713.json`.

### PR 26b — Waste-Reminder-Repository (1 Befund)

- [x] In `packages/waste-management-runtime/src/repositories/email-reminders.ts`
      Subscription-, Outbox- und Dispatch-Abfragen trennen.
      Token-Bindung, Lease-Verhalten und Versandstatus mit gezielten
      Repository- und Server-Runtime-Tests erhalten.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 26c — Waste-Handler-Komposition und Lesen (2 Befunde)

- [ ] In `packages/waste-management-runtime/src/` `server-handlers.ts`
      und `handlers/read-handlers.ts` bereinigen. Handler-Registrierung,
      Tenant-Scope, Leseantworten und Fehlerbehandlung mit gezielten
      Handler-, Lese- und Server-Runtime-Tests erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 26d — Waste-Operationen und Mutationen (3 Befunde)

- [ ] In `packages/waste-management-runtime/src/`
      `handlers/operations.ts`, `handlers/tours-write-support.ts` und
      `handlers/mutation-helpers.ts` bereinigen. Job-Start,
      Tour-Abhängigkeiten, Mutationsantworten, Audit und Fehlerbehandlung
      mit gezielten Datenintegritäts- und Server-Runtime-Tests erhalten.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-<tatsächliche-PR-Nummer>.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

## Mainserver und öffentlicher Kalender

### PR 27 — Mainserver-Content-Routen (5 Befunde)

- [x] In `packages/sva-mainserver/src/server/` `news-route.ts`,
      `events-route.ts`, `generic-items-route.ts`, `poi-route.ts`,
      `projects-route.ts` bereinigen. Validierung, Fehlercodes,
      Berechtigungen und Antwortformat gezielt testen.

      PR #1704 wurde am 03.10.2026 mit geprüftem HEAD
      `93c0200a9a113cdb8ec13bc14d98bef926b2b2e3` gemergt
      (Merge-Commit `a1f1ce19749fca6740a7641f0c19170c0a68278b`). Die fünf Routen
      wurden nach Eingabe, Zugriff, Lesen und Mutation getrennt. Die
      ursprünglichen Zeilenzahlen 1458/846/681/633/516 liegen nach dem
      Schnitt bei 127/110/128/250/312 (News/Events/Generic Items/POI/Projects).
      Die fünf `fileLines`-Registereinträge sind entfernt; der vollständige
      Complexity-Lauf meldete keine neuen Befunde; die finalen GitHub-Gates
      waren grün und es gab keine offenen Review-Threads.

- [x] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1704.json` mit
      passender `prNumber` und nutzerverständlichem `body` in
      diesem PR anlegen; Changelog-Gate vor Merge grün.

### PR 28 — Mainserver-Service und interne Typen (4 Befunde)

- [ ] In `packages/sva-mainserver/src/` `server/service.ts`, `types.ts`,
      `server/interfaces-contract.ts`,
      `server/service-internals/mappers-shared.ts` bereinigen.
      Service-Komposition, Interface-Vertrag und Runtime-Imports prüfen.

      Ausgangs-HEAD `a1f1ce19749fca6740a7641f0c19170c0a68278b`:
      1216/906/669/459 Zeilen (Service/Typen/Interface-Vertrag/Mapper).
      Der Schnitt behält die öffentlichen Importpfade und teilt die interne
      Ausführung nach Verbindung, Fachoperationen und Diagnostik sowie die
      Typen und Interface-Verträge nach Verantwortung. Ziel sind vier
      beseitigte `fileLines`-Befunde, unveränderte Antworten und Fehler sowie
      grüne Service-, Interface-, Mapping- und Runtime-Gates.

- [ ] Eigenen Studio-Changelog-Eintrag
      `docs/changelog/entries/pr-1708.json` mit
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

## Abschluss nach allen PRs 23 bis 34

- [ ] Auf integriertem `main` einen vollständigen `pnpm complexity-gate`-Lauf
      mit null aktuellen `fileLines`-Verstößen und null verwaisten
      `fileLines`-Registereinträgen belegen; andere Metriken getrennt
      ausweisen.
- [ ] Die tatsächlich betroffenen arc42-Abschnitte 05, 08, 10 und 11 sowie
      `docs/development/complexity-quality-governance.md` auf den Endstand
      bringen; für IAM-/Security-Schnitte auch 04 und 06 prüfen.
- [ ] OpenSpec strikt validieren, alle PR-Nachweise und Checkboxen abgleichen
      und den Change erst nach Integration gemäß OpenSpec-Prozess archivieren.
