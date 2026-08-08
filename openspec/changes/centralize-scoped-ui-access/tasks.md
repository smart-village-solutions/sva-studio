## 1. Vertrag und Reproduktion

- [x] 1.1 Characterization-Tests für Sidebar-Loading, Dev-Auth-Verfügbarkeit, Scope-Wechsel, Permission-Read-Fehler und verspätete Antworten eines alten Scopes ergänzen.
- [x] 1.2 Eine maschinenlesbare Inventur aller Host- und Plugin-Aktionen erstellen und gegen `studio-module-iam`, Plugin-Permissions, Module-IAM, Plattform-/Tenant-Scope, Modulzuweisung und Server-Enforcement klassifizieren.
- [x] 1.3 Den framework-agnostischen `UiAccessRequirement`-, `EffectiveAccessSnapshot`- und `UiAccessDecision`-Vertrag in `@sva/iam-core` mit diskriminiertem Plattform-/Tenant-Scope, Modul-Gate und vollständig qualifizierten Action-IDs definieren und isoliert testen.
- [x] 1.4 Die Überschneidung mit `refactor-cross-cutting-runtime-guardrails` festhalten und dessen Cross-Validation wiederverwenden, statt eine zweite Registry-Prüfung einzuführen.

## 2. Revisionsbasierte Permission-Cache-Gültigkeit

- [x] 2.1 Vor der Migration `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` prüfen und das Schema für monotone `instanceRevision`- und `userRevision`-Werte mit eindeutigen Instanz-/Subject-Constraints entwerfen.
- [x] 2.2 Migration und Repository-Vertrag für den PostgreSQL-autoritativ gespeicherten Revisionsvektor implementieren; Schema-Snapshot und Schema-Dokumentation im selben Änderungsblock aktualisieren.
- [x] 2.3 Die vollständige Mutationsmatrix klassifizieren: bekannte benutzerbezogene Änderungen erhöhen gezielt `userRevision`, rollen-, permission-, katalog-, hierarchie-, modul- oder instanzweite Änderungen erhöhen `instanceRevision`, unklare Betroffenenmengen fallen konservativ auf Instanzscope zurück.
- [x] 2.4 Relevante Datenänderung, Revisions-Bump und `pg_notify` mit `eventId`, Scope und neuer Revision in derselben PostgreSQL-Transaktion ausführen; PostgreSQL darf das Event erst nach erfolgreichem Commit zustellen.
- [x] 2.5 Den Authorize-/Me-Permissions-Read-Pfad so umstellen, dass er den aktuellen Revisionsvektor über einen schmalen indizierten PostgreSQL-Read bestätigt, bevor ein L1- oder Redis-Snapshot als Hit verwendet wird.
- [x] 2.6 L1- und Redis-Snapshot-Key/Payload auf einen revisionsgebundenen v2-Vertrag migrieren; alte Revisions-Keys logisch unadressierbar lassen und nur über TTL oder best-effort Cleanup physisch entfernen.
- [x] 2.7 Recompute aus einem konsistenten PostgreSQL-Snapshot erzeugen, Revision vor Publish erneut prüfen und veraltete Kandidaten ohne L1-/Current-Redis-Publish als `stale_write_discarded` verwerfen; identische Recomputes pro Replikat zusammenführen und replikatübergreifende Koordination nur als best-effort Lastschutz verwenden.
- [x] 2.8 `NOTIFY`-Listener für schnelle L1-Eviction und best-effort Redis-Cleanup beibehalten; verlorene, verspätete, doppelte und unbekannte Events dürfen die revisionsbasierte Gültigkeit nicht beeinflussen.
- [x] 2.9 Cache-Reset, Browser-Refetch und Session-Widerruf als getrennte APIs/Operationen dokumentieren und testen; kein Pfad darf die beiden anderen implizit auslösen.
- [x] 2.10 Entschieden und dokumentiert: Dieser Change stellt keinen manuellen Permission-Cache-Reset bereit; revisionsbasierte Invalidierung, Browser-Refetch und Session-Widerruf bleiben getrennte Verträge.
- [x] 2.11 Metriken und strukturierte Logs für Revision-Read, L1-/Redis-Hit/Miss, Reset, Event-Eviction, Recompute, Publish und verworfene veraltete Writes ergänzen; keine Tokens, Session-IDs oder PII loggen.
- [ ] 2.12 Multi-Replikat-Integrationstests mit warmem L1/Redis für Grant, Revocation, transaktionale Benutzer-/Instanzinvalidierung, Transaktionsrollback, verlorene/verspätete Events, parallele Mutation/Recompute sowie Redis-/DB-Ausfälle ergänzen.
- [ ] 2.13 Cache-Hit-, Cache-Miss- und Recompute-Benchmarks mit realistischem PostgreSQL-/Redis-Netzpfad ausführen und die p95-Grenzen `< 10 ms`, `< 80 ms`, `< 300 ms` unter mehreren App-Replikaten nachweisen.

## 3. Gemeinsamer Scope- und Effective-Access-State

- [x] 3.1 Den Plattform-/Tenant-Scope und den aktiven Organisationskontext in einen anwendungsweit gemeinsamen Provider überführen und konkurrierende lokale Hook-Zustände entfernen.
- [x] 3.2 Einen hosteigenen `EffectiveAccessProvider` implementieren: Plattform-Snapshots verwenden ausschließlich die validierte technische Plattform-Session-Sicht; Tenant-Snapshots verwenden `GET /iam/me/permissions` plus die fail-closed Modulzuweisung aus der Session-Sicht.
- [x] 3.3 Bei Session-/Scope-Wechsel, Fehler und expliziter Invalidation alte Permissions atomar verwerfen und Antworten veralteter Generationen ignorieren.
- [x] 3.4 Stabile serverseitige Stale-, Scope- oder Versionssignale sowie lokale Rollen-, Permission- und Modul-Mutationen an denselben globalen Invalidation-Pfad anbinden; globale Invalidation höchstens einmal pro Snapshot-Generation auslösen.
- [x] 3.5 `/auth/me` als Identitäts-/Session-Read beibehalten und dessen flache Permission-Liste aus Route- und UI-Entscheidungen entfernen beziehungsweise kontrolliert deprecaten.
- [x] 3.6 Unit-, Hook- und Integrationstests für `unresolved`, `loading`, `ready`, `error`, Retry, Plattform-/Tenant-Wechsel, Organisationswechsel, Modulentzug und verspätete Antworten ausführen.

## 4. Routing, Sidebar und Dev-Auth härten

- [x] 4.1 Route-Guards auf den scope-gebundenen Effective-Access-State umstellen und nicht aufgelöste oder fehlerhafte Zustände fail-closed behandeln.
- [x] 4.2 Sidebar- und Navigationseinträge aus denselben Access-Entscheidungen ableiten; `loading` darf keine Freigabe mehr erzeugen.
- [x] 4.3 Die Verfügbarkeit von Dev-Auth als Authorization-Bypass entfernen und ausschließlich eine nachweislich aktive Dev-Auth-Testsession gesondert behandeln.
- [x] 4.4 Read-Routen und Mutationsaktionen sowie Plattform-/Tenant- und Modul-Gates in Routing- und UI-Tests getrennt verifizieren.

## 5. Host-Oberflächen migrieren

- [x] 5.1 Benutzer-, Organisations-, Rollen-, Gruppen- und Rechtstextseiten auf explizite Read/Create/Update/Delete-Entscheidungen umstellen.
- [x] 5.2 Media-Library und Media-Detailflächen für Read/Create/Update/Delete und referenzbezogene Aktionen migrieren.
- [x] 5.3 Interfaces- und Monitoring-Flächen einschließlich operativer Tools auf ihre vollständig qualifizierten Actions binden.
- [x] 5.4 Content-Liste, Toolbar-, Row- und Bulk-Aktionen auf denselben Access-Vertrag umstellen.
- [x] 5.5 Read-only-Formulare gegen Submit per Button, Tastatur und impliziten Formularpfad absichern und zugänglich kennzeichnen.
- [x] 5.6 Für jeden Host-Bereich Negativtests ergänzen, die unberechtigte Mutationselemente und fokussierbare Rest-Controls ausschließen.

## 6. Plugin-Vertrag und Plugin-Oberflächen migrieren

- [x] 6.1 Plugin-Action-, Route-, Navigation- und Admin-Resource-Verträge um explizite Access-Anforderungen erweitern; Übergangsdiagnosen für bestehende unvollständige Beiträge bereitstellen.
- [x] 6.2 Registry-Validierung für bekannte Action-IDs, Plugin-Permissions, Module-IAM-Permissions, Systemrollen und Admin-Resource-Permissions ergänzen.
- [x] 6.3 Hostaufgelöste Create-, Update- und Delete-Capabilities an Standard-Content-Bindings übergeben.
- [x] 6.4 News, Events, POI, Generic Items, FAQ, Cockpit Cards und Projects auf den Standardvertrag migrieren; hartes `canEditContent: true` und unbedingte Save-/Delete-Aktionen entfernen.
- [x] 6.5 Surveys, Waste Management und weitere Sonderflächen auf vollständig qualifizierte Action-Entscheidungen migrieren; rollenbasierte UI-Sonderprüfungen entfernen, sofern keine explizite technische Plattformrolle betroffen ist.
- [x] 6.6 Nach abgeschlossener Migration fehlende oder unbekannte autorisierbare Plugin-Bezüge beim Registry-Build fail-fast abweisen.

## 7. Ressourcen-Capability-Integration und Server-Grenze

- [x] 7.1 Alle von den migrierten UI-Flächen aufgerufenen Mutationsendpunkte gegen Action, Instanz, Organisation und gegebenenfalls Ressourcen-/Ownership-Scope inventarisieren und den jeweils fachlich führenden Read-/Authorize-Vertrag dokumentieren.
- [x] 7.2 Fehlende serverseitige Authorize- oder Ressourcen-Capability-Verträge als Migrationsblocker dem verantwortlichen Fach-Change zuordnen; Mainserver-Fälle mit `use-mainserver-data-provider-as-content-author` sequenzieren und nicht durch eine generische Parallel-API ersetzen.
- [x] 7.3 Bereits serverautoritativ gelieferte `own`-, `organization`-, Geo- oder ressourcenbezogene Capabilities über den gemeinsamen UI-Decision-Vertrag konsumieren; bei fehlender Capability die konkrete Mutation fail-closed ausblenden.
- [x] 7.4 Sicherstellen, dass globale Action-Mitgliedschaft, Listenprojektion oder Cache-Treffer keine datensatzbezogene Mutation freigibt und ein erwartbarer Ressourcen-`403` ohne Stale-Signal keine globale Refetch-Schleife auslöst.

## 8. Verifikation, Dokumentation und Abschluss

- [x] 8.1 Tabellengetestete Persona-Matrix für read-only, create-only, update-only, delete-only, tenantseitigen `system_admin`, technischen Plattform-Admin, fehlende Modulzuweisung, unresolved/loading, error und Organisationswechsel ergänzen.
- [x] 8.2 Relevante E2E-Pfade mit negativen Sichtbarkeits-, Tastatur- und Direkt-URL-Szenarien ergänzen; direkte Mutationsrequests ohne Grant müssen `403` liefern.
- [ ] 8.3 Die betroffenen Unit-, Type-, Runtime-, Routing-, Plugin-Registry- und E2E-Gates gemäß `DEVELOPMENT_RULES.md` in kleinen Slices ausführen.
- [x] 8.4 `docs/architecture/04-solution-strategy.md`, `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`, `09-architecture-decisions.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` aktualisieren.
- [x] 8.5 ADR-014 und ADR-026 für revisionsbasierte Korrektheit fortschreiben und eine ADR unter `docs/adr/` für Auth-/Effective-Access-Trennung, diskriminierten Plattform-/Tenant-Scope, additives Modul-Gate, Fail-closed-Zustände, Ressourcen-Ownership und Plugin-Capability-Übergabe erstellen und verlinken.
- [x] 8.6 Relevante Auth-, Routing-, Permission-Cache- und Plugin-Dokumentation sowie den Changelog-Eintrag aktualisieren.
- [x] 8.7 Abschließenden read-only Audit-Run über UI-Aktionsmatrix, Registry-Verträge, Permission-Cache-Revisionsmatrix und Server-Endpunkte durchführen und verbleibende Ausnahmen dokumentieren.

## 9. Parallelisierte Delivery-Slices

- [x] 9.1 Cache-Revision-Fundament (Task 2) und zentralen Scope-/Access-State (Tasks 1 und 3) jeweils durch einen klaren Owner abschließen; gemeinsame Cache-, Provider-, SDK-, Routing- und Sidebar-Dateien nicht parallel bearbeiten.
- [ ] 9.2 Erst nach grünem Cache- und UI-Fundament Host-IAM, Host-Fachflächen, Standard-Content-Plugins und Sonderplugins in getrennten Subagent-Runs parallel migrieren.
- [x] 9.3 Gemeinsame Contract-Änderungen zentral integrieren und nach jedem Migrationsblock die kleinsten relevanten Nx-Gates ausführen.
- [x] 9.4 Den abschließenden Matrix-, Cache-Revisions- und Server-Enforcement-Audit unabhängig von den Migrations-Runs durchführen.
