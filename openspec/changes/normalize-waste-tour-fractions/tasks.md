## 1. Entwurf und Ausführungsgrenzen

- [x] 1.1 Proposal und Design fachlich prüfen und vor Implementierung freigeben; ausschließlich Tour–Fraktions-Zuordnungen als PR-Scope festhalten.
- [x] 1.2 Alle DB-Leser/-Schreiber, Grants, Schema-Manifeste, Reset-/Seed-, Datenaustausch-, Duplikat- und Jahresübernahmepfade inventarisieren; Konflikte mit laufenden Changes prüfen.
- [x] 1.3 Bestehende Migrationsreihenfolge prüfen und wegen fehlender Quieszenz den ausdrücklich freigegebenen Expand/Contract-Vertrag ausarbeiten; Contract standardmäßig deaktivieren.
- [x] 1.4 Vor nichttrivialem Code XERJ-Referenzen gemäß AGENTS.md prüfen, Indexstand abgleichen; bestehende Transaktions-/Migrationspfade und Lizenzbedingungen berücksichtigen.

## 2. Schema und Migration

- [x] 2.1 In vorhandenen PostgreSQL-Integrationstests den verwaisten Arraybezug und die künftigen FK-/Delete-Invarianten abdecken.
- [x] 2.2 Vorhandenen Schema-Builder und versionierten Waste-Tenant-Migrationskatalog um Beziehungstabelle, Position, Constraints, Index, Grants und strukturelle Verifikation erweitern. Keine zentrale IAM-Migration für Waste-Fachdaten anlegen.
- [x] 2.3 Gesperrte, transaktionale Vorprüfung/Übernahme mit Ordinalität, exaktem Vergleich vor Spaltenabbau und Abbruch bei ungültigen Referenzen oder Dubletten implementieren. Leere Bestandsarrays erhalten.
- [x] 2.4 Frisch provisionierte DB und Bestandsmigration auf denselben Endzustand prüfen; Wiederanlauf nach Fehler/Prozessabbruch und bestehende/deaktivierte Tenants berücksichtigen.

## 3. Verbraucher umstellen

- [x] 3.1 Tour-Upserts und Zuordnungsersatz transaktional serialisieren; Typ-/Existenz-/Duplikatvalidierung und bestehenden Mindestanzahlvertrag erhalten; Reads geordnet aggregieren, Filter/Counts/Pagination regressionsfrei umstellen.
- [x] 3.2 Jahresübernahme einschließlich Bulk-Write und Retry, Duplizieren sowie Import/Export und portable Austauschprofile auf dieselbe relationale Persistenz umstellen; äußere Feldverträge erhalten.
- [x] 3.3 Direkte SQL-Leser für Kalender und Erinnerungen umstellen; ihre gemeinsame fachliche Datenbasis und Reminder-Auswahl gegen PostgreSQL prüfen. Unveränderte PDF-/iCal-Renderer werden nicht neu gestaltet.
- [x] 3.4 Bestehende Mainserver-Revisionsverfolgung für Zuordnungsänderungen erweitern; alten Spaltentrigger, Arrayspalte und GIN-Index in der ausdrücklich zu aktivierenden Contract-Stufe entfernen. Befristete Brücke und Endbedingung dokumentieren.
- [x] 3.5 Vorhandenen HTTP-409-Pfad für verwendete Fraktionen durch echten FK-Konflikt verifizieren; Tourlöschung mit kaskadierender Zuordnungsbereinigung testen.

## 4. Nachweise und Dokumentation

- [x] 4.1 PostgreSQL-Nachweise aus der Invariantentabelle im Design ausführen: Migration, FK-Fehler, Rollback, Konkurrenz, Rechte, Reihenfolge, frische/alte DB und Revisionsverfolgung.
- [x] 4.2 Gezielte Vitest-/Nx-Gates für geänderte Projekte/Dateien sowie bestehende Datenaustausch-Roundtrip- und Jahresübernahme-Integrationstests ausführen. Targets vorher mit `pnpm nx show project <projekt> --json` ermitteln; Dateifilter als `--testFiles=...`. Keine unnötigen breiten lokalen Wiederholungen.
- [x] 4.3 Pflicht-Gates für Migration und Datenintegrität gemäß DEVELOPMENT_RULES.md 5.2 sowie betroffene Runtime-/Skript-Typechecks auswählen; vor affected-Unit-Lauf Scope mit `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main` messen. GitHub-Gates bleiben einer später beauftragten PR-Erstellung vorbehalten.
- [x] 4.4 `docs/development/studio-db-schema.md` fortschreiben; `studio-db-schema-final.sql` prüfen und nur bei tatsächlicher zentraler Schemaänderung aktualisieren, sonst begründeten unveränderten Stand dokumentieren. Waste-Schema-/Manifestnachweise aktualisieren.
- [x] 4.5 arc42-Abschnitte 05, 06 und 08 aktualisieren; 07 auf Kompatibilitäts-/Umschaltwirkung prüfen und Änderung oder begründete Nichtbetroffenheit dokumentieren. Bestehende Anwenderdokumentation zum Löschkonflikt prüfen.
- [x] 4.6 Change mit `pnpm exec openspec validate normalize-waste-tour-fractions --strict` und Dateiplatzierung mit `pnpm check:file-placement` prüfen. Verbliebene Spaltenzugriffe gezielt suchen; Bezeichnungen im unveränderten Import-/API-Vertrag sind zulässig.
- [ ] 4.7 Vor separat freigegebenem Rollout Staging-Migrationsprobe mit Backup/Restore, allen Verbraucher-Versionen, Verbraucherwechsel, ausdrücklicher Contract-Bestätigung, Tenant-Verifikation und fachlichen Smokes gemäß kanonischem Rolloutprozess nachweisen. Technischen Rollout und fachliche Abnahme getrennt berichten.

## Lokaler Prüfstand (2026-10-30)

- Isolierte PostgreSQL-16-Testinstanz unter ignoriertem `artifacts/`, keine Live-Datenbankzugriffe.
- Neue Expand/Contract-Integration: ungültige Bestände, Reihenfolge, FK-/Löschschutz, konkurrierende Zuordnung/Löschung, atomarer Tour-Upsert und tatsächlicher Backend-Abbruch mit sauberem Wiederanlauf.
- Eingeschränkte Provisioner-/Runtime-/öffentliche Rollen: versionierter Katalog, Ledger-Replay, verbotene direkte Writes, nicht öffentlich ausführbare Writer sowie Anwendungsschreibzugriff vor/nach Contract geprüft.
- Jahresübernahme/Idempotenz/Rollback, Datenaustausch und transaktionale Mainserver-Quellrevision gezielt gegen PostgreSQL geprüft.
- Öffentlicher Kalender und Reminder-Join gegen PostgreSQL sowie bestehende Repository-Unit-Tests geprüft.
- Keine PR-/CI-, Staging-, Backup-/Restore- oder Live-Abnahme behauptet. 4.7 bleibt vor einer separat freizugebenden Auslieferung offen.

- Abschließende lokale Gates: Runtime- und App-Typecheck, Skript-Typecheck, gezielter ESLint-Lauf, Node-Syntaxprüfung der Migrationsdateien, OpenSpec strict und Dateiplatzierung. Die Integrationstests verwenden die vorhandene `vitest.integration.config.ts` direkt, da das Unit-Nx-Target bereits eine feste Unit-Konfiguration vorgibt.
