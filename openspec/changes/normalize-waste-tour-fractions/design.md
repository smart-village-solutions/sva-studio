## Kontext und belegte Lücke

Die Arrayspalte kann keine Existenzprüfung einzelner Fraktionen durch Fremdschlüssel leisten. Unmittelbare Verbraucher sind Tourverwaltung, Jahresübernahme, Datenaustausch, Mainserver-Sync, Kalender und Erinnerungen; die neue Beziehungstabelle erweitert deren bestehenden Persistenzpfad.

Wesentliche Ausgangspunkte am Analyse-HEAD `2b5761662`:

| Pfad | Verantwortung |
| --- | --- |
| `packages/waste-management-runtime/src/operations/waste-management-operations.schema.ts` | Schema-Builder, Arrayspalte, GIN-Index, Schema-Prüfung |
| `deploy/portainer/waste-tenant-migration-catalog.mjs` und `migrate-waste-tenants.mjs` | versionierte Migration und Verifikation bestehender Tenant-Datenbanken |
| `packages/waste-management-runtime/src/repositories/master-data.tours.ts` | Tour-Lesen, Filter und Upsert |
| `packages/waste-management-runtime/src/repositories/master-data.fractions.ts` und `handlers/fractions.ts` | Fraktionslöschung; vorhandene Behandlung von SQLSTATE `23503` als HTTP 409 |
| `packages/waste-management-runtime/src/repositories/annual-tour-transfer-write.ts` | Bulk-Persistenz des Folgejahrs |
| `packages/waste-management-runtime/src/operations/waste-management-operations.import.persist.ts` und `waste-management-data-exchange-*.server.ts` | Import-/Export- und Referenzverträge |
| `packages/waste-management-runtime/src/operations/waste-management-mainserver-sync.revision-schema.ts` | Quellrevision bei fachlichen Änderungen |
| `apps/public-waste-calendar-web/src/lib/public-waste-calendar-loader.server.ts` | direkte Kalender-Joins |
| `apps/public-waste-calendar-web/src/lib/public-waste-repository-summary-reminders.server.ts` | Fraktionsauflösung für Erinnerungen |

Vor Umsetzung zusätzlich alle Verbraucher des fachlichen Felds `wasteFractionIds` sowie dynamische Tabellenlisten, Reset-/Seed-/Exportpfade und Berechtigungsvergaben prüfen. Eine Textsuche allein nach der SQL-Spalte reicht nicht.

## Entscheidungen

### Relationales Modell im bestehenden Tenant-Schema

`waste_tour_fractions` enthält `tour_id UUID NOT NULL`, `fraction_id UUID NOT NULL` und `position INTEGER NOT NULL CHECK (position >= 0)`. Primärschlüssel ist `(tour_id, fraction_id)`, zusätzlich gilt `UNIQUE (tour_id, position)`. Die Position erhält die bestehende Arrayreihenfolge ohne neue fachliche Sortierregel. Ein zusätzlicher Index auf `fraction_id` unterstützt die Rückwärtssuche.

- `tour_id` referenziert `waste_tours(id) ON DELETE CASCADE`.
- `fraction_id` referenziert `waste_fractions(id) ON DELETE RESTRICT`.
- Die Datenbank pro Instanz bleibt die Tenant-Grenze; keine redundante `instance_id` und keine zentrale IAM-Zuordnungstabelle.
- Kein kaskadierendes Entfernen einer Fraktion aus bestehenden Touren. Erst die Zuordnung fachlich ändern, danach die Fraktion löschen.
- Kein generisches Beziehungsframework, kein dauerhafter Dual-Write und keine alternative Primärquelle.

### Atomare Schreibpfade und stabile Außenverträge

Tour-Upsert und vollständiger Ersatz ihrer Zuordnungen laufen über `upsert_waste_tour(...)` in derselben Transaktion auf derselben Verbindung. Die PL/pgSQL-Funktion führt erst den Stammdaten-Upsert einschließlich seiner Trigger und danach den Zuordnungsersatz aus; ein datenändernder CTE mit nachgelagertem Zuordnungswrite ist wegen der verzögerten AFTER-Trigger beim Insert ungeeignet. Bestehende Touren werden vor dem Ersatz gesperrt; alle Schreiber verwenden dieselbe Sperrreihenfolge, bei Bulk-Operationen nach Tour-ID. Fehler rollen Stammdaten und Zuordnungen gemeinsam zurück. Fremdschlüssel sichern auch die Konkurrenz mit Fraktionslöschungen ab.

Der bestehende Vertrag verlangt mindestens eine Fraktion bei regulären Tourmutationen. Diese Validierung bleibt erhalten; ungültige UUIDs, doppelte und unbekannte IDs werden vor dem Write abgewiesen und durch passende DB-Constraints abgesichert. Die neue Tabelle allein erzwingt keine Mindestanzahl von Kindzeilen. UUID-, Existenz- und Eindeutigkeitsprüfung sind auch am Datenbank-Write wirksam; der bestehende Formular-/API-Mindestanzahlvertrag bleibt unverändert. Historisch leere Arrays dürfen durch die Schemaumstellung nicht still verändert werden; sie werden als leere Zuordnung übernommen, reguläre nachfolgende Änderungen erfüllen weiterhin den bestehenden API-Vertrag.

Reads rekonstruieren `wasteFractionIds` geordnet nach `position`. Die Normalisierung verändert keine Paginierung, Counts oder Kardinalität: Tourlisten verwenden etwa eine Aggregation pro Tour, Fraktionsfilter einen Existenztest. Import/Export einschließlich der portablen Datenaustauschprofile behalten ihre Feldnamen und Referenzsemantik; fachliche Referenzauflösung erfolgt vor der relationalen Persistenz. Kopieren, Jahresübernahme, Seed, Reset und bestehende Fehler-/Retrypfade verwenden denselben zuständigen Repositorypfad.

### Revision und Zugriffsrechte

Änderungen an der Beziehung erhöhen die bestehende Mainserver-Quellrevision transaktional. Die Arrayspalte bleibt während Expand über den Kompatibilitätstrigger angebunden; der bisherige Revisionstrigger auf Updates von `waste_fraction_ids` wird bereits durch relationale Beobachtung ersetzt; der bestehende Mechanismus beobachtet stattdessen Inserts, Updates und Deletes der Zuordnungstabelle. Schema-Builder und versionierte Migration müssen denselben Endzustand erzeugen. Keine zusätzliche Queue oder Sync-Orchestrierung. Rollback einer Fachmutation darf keine persistierte Revision hinterlassen.

Bestehende Runtime-Rollen erhalten die erforderlichen Rechte auf der neuen Tabelle; öffentliche Leser erhalten ausschließlich die bisher vorgesehenen Leserechte. Bereits eingerichtete Rollen und neue Provisionierungen sind beide zu testen. Schema-/Readiness-Prüfungen müssen auch Fremdschlüssel, Eindeutigkeit und Triggervertrag erkennen, nicht nur die Existenz einer Tabelle.

## Migration, Umschaltung und Recovery

Die Vorprüfung hat am 2026-10-30 ergeben: `.github/workflows/promote.yml` führt den Migrationsjob (Zeile 699) vor dem App-Deploy (Zeile 751) aus. Die unabhängig veröffentlichte Kalender-App nutzt `start-first` (`deploy/portainer/docker-compose.public-waste.yml:27`). Ein koordinierter Stopp aller Verbraucher ist im regulären Pfad nicht nachgewiesen. Der Nutzer hat deshalb am 2026-10-30 die befristete Expand/Contract-Variante ausdrücklich freigegeben.

### Expand und kompatibler Verbraucherwechsel

1. Der bestehende versionierte Migrationsrunner ergänzt die Beziehungstabelle und prüft/übernimmt den Bestand unter Tabellensperre in seiner vorhandenen Transaktion mit Lock-/Statement-Timeout. UUIDs, NULL-/Leereinträge, Dubletten nach UUID-Kanonisierung und unbekannte Referenzen brechen die Migration ohne Fachkorrektur ab. Reihenfolge und leere Bestandsarrays bleiben erhalten.
2. Die Arrayspalte bleibt ausschließlich als zeitlich begrenzter Kompatibilitätseingang bestehen. Ein schemaqualifizierter Definer-Trigger ersetzt bei alten Array-Writes die relationalen Zuordnungen in derselben Transaktion. Direkte Runtime-Schreibrechte auf der Beziehungstabelle sind gesperrt; damit entsteht kein unabhängig beschreibbarer Shadow-Bestand. Fremdschlüssel verhindern sofort das Löschen verwendeter Fraktionen.
3. Neue Leser verwenden die Beziehungstabelle. Neue Schreiber verwenden `upsert_waste_tour(...)` für die atomare bestehende Tour-Upsert-Operation ohne direkten Arrayspaltenzugriff. Diese Funktion ruft nach dem Stammdaten-Upsert `replace_waste_tour_fractions(uuid, text[])` auf. Während Expand aktualisiert diese Funktion die Arrayspalte; der Trigger führt die relationale Änderung aus. Der Upsert sperrt die Tour und serialisiert konkurrierende Änderungen.
4. Die Funktion ist erforderlich, weil neue Verbraucher zwischen Schema-Expand und späterem Contract dieselbe atomare Schreibschnittstelle benötigen. Die vorhandene Repository-Schnittstelle bleibt unverändert; es entsteht weder ein Package noch ein Service oder ein Anwendungs-Fallback.
5. Kalender-App, Studio und Worker können unabhängig wechseln. Bereits bestätigte Zuordnungsänderungen erhöhen weiterhin die vorhandene Quellrevision transaktional; neue Provisionierungen erhalten dieselben Integritätsregeln und Rechte.

### Contract mit ausdrücklicher Betriebsbestätigung

Die separate Contract-Migration ist standardmäßig deaktiviert und wird ausschließlich im bestehenden Runner über `WASTE_TOUR_FRACTIONS_CONTRACT_CONFIRMED=true` aktiviert. Diese Bestätigung darf erst nach dokumentiertem Wechsel sämtlicher Studio-/Kalender-/Worker-Verbraucher einschließlich deaktivierter Tenants und dem Ende möglicher Altversions-Rollbacks gesetzt werden. Sie bestätigt auch den Backup-/Restore-Nachweis im kanonischen Rolloutprozess.

Die Contract-Migration ersetzt zuerst den Körper derselben DB-Funktion durch gesperrtes relationales Delete/Insert, verifiziert nochmals die Übereinstimmung beider Bestände und entfernt danach Kompatibilitätstrigger, Arrayspalte und GIN-Index. Die neuen Anwendungen bleiben durch die stabile Funktionssignatur lauffähig. Direkte Runtime-Schreibrechte auf der Beziehungstabelle bleiben gesperrt; ausschließlich die explizit berechtigte Definer-Funktion schreibt sie. Alle schemaqualifizierten Definer-Funktionen verwenden einen festen sicheren Search-Path und sind nicht öffentlich ausführbar.

Die Entfernung ist damit an eine konkrete Endbedingung gebunden und im selben Change implementiert, wird aber nicht bereits mit Expand ausgeführt. Nach Contract sind alte Images inkompatibel. Ein Image-Rollback allein ist keine Recovery; nach neuen Fachwrites darf ein Backup nicht ohne ausdrückliche Datenverlustentscheidung zurückgespielt werden. Teilweise migrierte Tenantbestände werden über das vorhandene Ledger behandelt und dürfen keine automatische Rücksetzung bereits übernommener Daten auslösen.

Dies beschreibt Kompatibilitätsbedingungen; der einzige reguläre Rolloutpfad bleibt `docs/guides/studio-rollout-process.md`.

## Kritische Invarianten und Nachweise

| Invariante | Geplanter Nachweis |
| --- | --- |
| Jede Zuordnung verweist auf existierende Tour und Fraktion derselben Tenant-DB | echte PostgreSQL-FK-Negativtests; keine reinen SQL-String-Mocks |
| Verwendete Fraktionen bleiben erhalten | Delete-Test mit HTTP 409 und unverändertem Tour-/Fraktionsbestand, auch bei konkurrierender Zuweisung |
| Fachmutation ist atomar und Konkurrenz verliert keine Teilzuordnungen | Fehler zwischen Tour- und Zuordnungswrite injizieren; zwei Verbindungen für parallele Upserts/Delete verwenden |
| Gültige Bestände werden verlustfrei übernommen | Migrationsfixtures für mehrere Fraktionen, Reihenfolge, leere Arrays; Gleichheitsprüfung pro Tour; ungültige UUIDs, Dubletten und verwaiste Referenzen führen zum Abbruch |
| Alle Konsumenten bleiben fachlich gleich | Datenaustausch-Roundtrip, Jahresübernahme/Retry, Tourfilter mit Pagination, Kalender/iCal/PDF-Daten und Reminder-Daten vergleichen |
| Sync erkennt jede bestätigte Zuordnungsänderung | DB-Integrationstest für Insert/Update/Delete und zurückgerollte Mutation; bestehender Sync-Jobvertrag bleibt erhalten |
| Kein inkompatibler Prozess läuft während/nach Migration | Staging-Nachweis für Kompatibilität alter/neuer Versionen während Expand; ausdrückliche Contract-Bestätigung und neue Verbraucher-Versionen je Tenant |

## Abbruchbedingungen und offene Nachweise

- Ungültiger Bestand, nicht zuordenbare Tenant-DB, fehlende Rechte oder Lock-Timeout: keine automatische Reparatur, keine Verkehrsfreigabe für inkompatible Zustände.
- Contract bleibt ohne ausdrückliche Betriebsbestätigung deaktiviert; seine reale Aktivierung und der Rollout sind nicht durch den Implementierungsauftrag autorisiert.
- Performancegewinne sind kein Akzeptanzkriterium dieses Changes; Ziel sind Integrität und unveränderte fachliche Ergebnisse.
