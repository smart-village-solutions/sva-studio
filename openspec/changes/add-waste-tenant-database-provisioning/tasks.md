## 1. Verträge und zentrale Persistenz

- [ ] 1.1 Den bestehenden PostgreSQL-Migrationschange integrieren und überlappende Waste-Spec-Deltas auflösen.
- [ ] 1.2 Den zentralen, tenantgebundenen Provisionierungsstatus mit Zustandsübergängen, Fehlercodes, Jobkorrelation und Deaktivierungszustand modellieren.
- [ ] 1.3 Die vorhandene External-Interface-Ownership um den pluginverwalteten Waste-Vertrag ergänzen, ohne eine parallele Registry einzuführen.
- [ ] 1.4 Datenbankschema, Migrationen, Constraints und Indizes für neue zentrale Metadaten implementieren und `docs/development/studio-db-schema-final.sql` sowie `docs/development/studio-db-schema.md` aktualisieren.
- [ ] 1.5 Unit-, Type- und Integrationstests für Statusübergänge, Tenantgrenzen und konkurrierende Enqueues ergänzen und den kleinsten relevanten Gate-Pfad ausführen.

## 2. Sichere Datenbankprovisionierung

- [ ] 2.1 Den Provisionierungspfad in der vorhandenen Plugin-Operations-/Worker-Infrastruktur implementieren und durch Architektur- sowie Deployment-Tests absichern, dass kein neuer dauerhaft laufender Service erforderlich ist.
- [ ] 2.2 Kanonische, validierte und kollisionssichere Datenbank- und Rollennamen aus der Instanzidentität ableiten.
- [ ] 2.3 Den privilegiengetrennten Provisionierungspfad für Datenbank, Owner-, Migrations-, Studio-Runtime- und gegebenenfalls Public-Runtime-Rolle mit Least Privilege implementieren.
- [ ] 2.4 Tenantbezogene Secrets über die bestehende verschlüsselte Secret-Infrastruktur erzeugen, rotieren und referenzieren; Klartext aus Browser, Logs und Jobdetails fernhalten.
- [ ] 2.5 Waste-Migrationen und Rechteprüfungen idempotent ausführen und Schema-/Berechtigungsdrift sicher klassifizieren.
- [ ] 2.6 Fehler- und Retry-Tests einschließlich partiell vorhandener Datenbank, Rollen, Interface und Migrationen ergänzen.

## 3. Plugin-Operations und Modul-Lifecycle

- [ ] 3.1 Den namespaced Jobtyp `waste-management.provision-tenant-database` mit zentraler Persistenz, Fortschrittsphasen und idempotentem Enqueue registrieren.
- [ ] 3.2 Nach erfolgreicher Modulzuweisung asynchron provisionieren und Waste bis zum Zustand `ready` fail-closed halten.
- [ ] 3.3 Modulentzug so implementieren, dass Runtime und Interface deaktiviert, Datenbank und Sicherungen jedoch erhalten werden.
- [ ] 3.4 Berechtigte Retry-/Reconcile-Aktion sowie Audit- und Monitoring-Evidenz ohne Secrets implementieren.
- [ ] 3.5 Unit-, Type- und Integrationstests für Zuweisung, Doppelereignisse, Fehler, Retry, Entzug und erneute Zuweisung ergänzen.

## 4. Verwaltetes Interface und UI

- [ ] 4.1 Das tenantbezogene PostgreSQL-Interface zunächst deaktiviert materialisieren und erst nach Migration und Rechteprobe aktivieren.
- [ ] 4.2 Pluginverwaltete Interfaces serverseitig aus allgemeinen Listen, Pickern und `/interfaces`-Detailpfaden filtern.
- [ ] 4.3 Allgemeine Interface-Mutationen für pluginverwaltete Datensätze fail-closed ablehnen und interne Resolver-/Operatorzugriffe gezielt erhalten.
- [ ] 4.4 Die bisherige Waste-Datenquellenbearbeitung durch eine Studio-konforme, internationalisierte Statusanzeige mit berechtigter Wiederholungsaktion ersetzen.
- [ ] 4.5 Autorisierungs-, API-, UI- und Accessibility-Tests für Sichtbarkeit, direkte URLs und Mutationsversuche ergänzen.

## 5. Runtime und Public-Waste-Anwendung

- [ ] 5.1 Die Waste-Host-Fassade ausschließlich über das aktive, pluginverwaltete Interface der aktuellen Instanz auflösen lassen.
- [ ] 5.2 Die Public-Waste-Runtime tenantgenau mit ihrer begrenzten Rolle verbinden und Cross-Tenant-Zugriffe sowie administrative SQL-Rechte ausschließen.
- [ ] 5.3 Connection-, Schema- und Rechteproben für beide Runtime-Rollen implementieren und den sichtbaren Status sicher projizieren.
- [ ] 5.4 Tenant-Isolations-, Runtime-, Type- und Server-Runtime-Tests ergänzen und `pnpm check:server-runtime` für betroffene Server-Packages ausführen.

## 6. Einmalmigration von `bb-prignitz`

- [ ] 6.1 Den Migrationslauf hart an die kanonische Instanzidentität und provisionierte Zieldatenbank von `bb-prignitz` binden.
- [ ] 6.2 Preflight für Dump-Version, Erweiterungen, Schemaausgangszustand, Zielidentität und verfügbaren Speicher implementieren.
- [ ] 6.3 Finalen Supabase-Dump im vereinbarten Offline-Fenster importieren und Migrationsevidenz ohne Zugangsdaten sichern.
- [ ] 6.4 Schema, Constraints, Sequenzen, Zeilenzahlen und fachliche Stichproben verifizieren sowie Studio- und Public-Smoke-Tests durchführen.
- [ ] 6.5 Den zeitlich begrenzten Rückfallpfad dokumentieren und sicherstellen, dass kein anderer Tenant Daten aus diesem Dump erhält.

## 7. Betrieb, Dokumentation und Gates

- [ ] 7.1 Das vorhandene Swarm-Deployment einmalig um Provisionierer-Secret und vorab administrativ angelegte PostgreSQL-Rolle ergänzen, ohne neuen Service, Port oder Stack einzuführen.
- [ ] 7.2 Backup-Discovery, tenantgenaue Sicherungsmetadaten, Restore und Aufbewahrung für dynamisch provisionierte Waste-Datenbanken ergänzen.
- [ ] 7.3 Durch einen automatisierten Aktivierungstest nachweisen, dass weitere Tenants ohne Deployment- oder manuelle Secret-Änderung provisioniert werden.
- [ ] 7.4 Betriebsdiagnose, Alerting und Runbooks für hängende Provisionierung, Drift, Backup-Fehler und Secret-Rotation ergänzen.
- [ ] 7.5 Die betroffenen arc42-Abschnitte `05`, `07`, `08`, `10` und `11` sowie die Waste-, Interface- und Rollout-Guides auf Deutsch aktualisieren.
- [ ] 7.6 Die relevanten Unit-, Type-, ESLint-, Integration-, E2E-, Security- und File-Placement-Gates ausführen.
- [ ] 7.7 Vor PR-Freigabe den affected Scope messen und nach Möglichkeit `pnpm test:pr` ausführen; ausgelassene breite Gates transparent dokumentieren.
