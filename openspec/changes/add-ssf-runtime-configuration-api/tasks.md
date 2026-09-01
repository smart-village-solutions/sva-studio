## 0. Voraussetzungen und Baseline

- [x] 0.1 `extend-plugin-platform-scopes-and-activation` auf dem
      Implementierungsbranch verfügbar machen und exakte Manifest-, Server-,
      Aktivierungs- und Dispatcher-Verträge gegen dieses Design prüfen
      (der gemergte Vertrag unterstützt `platform` und `tenant`; der für SSF
      benötigte technische Service-Zugriff bleibt eine explizite Erweiterung)
- [x] 0.2 Bestehenden MCP-Service-Token-Pfad charakterisieren und seine
      unveränderte Auth-/Fehlersemantik mit Tests festhalten
- [x] 0.3 Zentralen Studio-Schema-Snapshot und Schemaübersicht prüfen; die
      getrennte SSF-Plugin-Datenbank sowie ihren eigenen Snapshot-Pfad
      dokumentieren
- [x] 0.4 Assurance-IDs `SSF-RT-01` bis `SSF-RT-10` den konkreten Testdateien
      und Gate-Kommandos zuordnen

## 1. Plugin- und API-Verträge

- [x] 1.1 `@sva/plugin-ssf` über den kanonischen Nx-/Plugin-Generatorpfad als
      `admin`-Plugin mit Aktivierungsrichtlinie `automatic` anlegen
      (der verpflichtende Generator-Dry-Run scheiterte vor Dateierzeugung am
      bestehenden Workspace-Graph; das Paket wurde danach entsprechend den
      vorhandenen Plugin-Paketen kontrolliert angelegt)
- [x] 1.2 Browser-sichere Fachtypen, Zod-Schemas, OpenAPI-V1-Schema,
      Größenkonstanten und stabile Fehlercodes definieren
- [ ] 1.3 Den internen GET-Serverbeitrag mit festem Pfad, Methode,
      Service-Action und Handler-ID deklarieren
- [ ] 1.4 Plugin-Boundary- und Snapshot-Tests für Namespace, Tier, Scope,
      Aktivierung und vollständige Handler-Bindung ergänzen

## 2. SSF-Plugin-Datenbank

- [x] 2.1 Getrennte Datenbankkonfiguration und minimale Migrator-, Root- und
      Tenant-Runtime-Principals bereitstellen
- [x] 2.2 Migrationen für `ssf.server_settings`, `ssf.server_locales`,
      `ssf.tenant_settings` und `ssf.tenant_locales` mit Constraints, Indizes
      und Zeitwerten implementieren
- [x] 2.3 Transaktionsgebundenen `app.instance_id`-Kontext, erzwungene RLS und
      zusätzliche Repository-Prädikate implementieren
- [x] 2.4 Typisierte Read-/Upsert-Repositories für serverweite und
      tenantbezogene Werte implementieren; noch keine HTTP-Schreibroute
- [x] 2.5 Eigenen Sollschema-Snapshot
      `docs/development/ssf-plugin-db-schema-final.sql` reproduzierbar erzeugen
      und `docs/development/studio-db-schema.md` aktualisieren
- [x] 2.6 PostgreSQL-Integrationstests für zwei Tenants, Root-/Tenant-Principals,
      Constraints, RLS, Migration-Idempotenz und Rollback ergänzen

## 3. Effektive Konfiguration

- [x] 3.1 Versionierte deutsche und englische Produktdefaults einschließlich
      unterstützter Locales als Plugin-Code definieren
- [x] 3.2 Reinen Resolver für Tenant → Server → Produktdefault und die
      nachgelagerten Branding-/Speicher-Policies implementieren
- [x] 3.3 Medienreferenzen über eine versionierte Host-Capability auflösen und
      Fremdtenant-/fehlende-Medien-Fälle fail-closed behandeln
- [x] 3.4 `sanitize-html` mit der freigegebenen flexiblen V1-Policy integrieren
      und Ein-/Ausgabegrenzen vor und nach Bereinigung erzwingen
- [x] 3.5 RFC-8785-Kanonisierung über `json-canonicalize` und SHA-256-
      `configurationRevision` implementieren
- [x] 3.6 Unit-, Golden- und Property-Tests für Prioritäten, Locales, Policies,
      HTML, Größenlimits und wirksame/unwirksame Revisionen ergänzen

## 4. Service-Authentisierung und Endpoint

- [x] 4.1 Die bestehende JOSE-/JWKS-Verifikation in einen generischen
      Service-Token-Baustein extrahieren, ohne MCP-Verhalten zu verändern
- [x] 4.2 SSF-Konfiguration für Issuer, Audience, Client-ID, RS256, `exp`,
      `azp` und `ssf.runtime-configuration.read` anbinden
- [ ] 4.3 Host-Gates für Instanz, Suspendierung, Plugin-Aktivierung, Datenbank-
      Readiness und verifizierte `authorizationRevision` implementieren
- [ ] 4.4 Tenantgebundenen Execution-Context erzeugen und den Plugin-Handler
      ausschließlich nach allen Host-Gates ausführen
- [ ] 4.5 Erfolgs- und Fehlerantworten, Korrelations-ID, strukturierte Metriken,
      PII-arme Logs und Sicherheits-Audit implementieren
- [ ] 4.6 Browser-, Token-, Header-, Fremdtenant-, Inaktivitäts-, Readiness- und
      Datenbankfehlerpfade durch Integrationstests absichern

## 5. Deployment und Betriebsgrenze

- [ ] 5.1 SSF-Plugin-Datenbank, Migration, Backup-/Restore-Inventar und
      Service-Token-Konfiguration in das bestehende Deployment-Profil
      integrieren
- [ ] 5.2 Endpoint-Freigabe standardmäßig deaktiviert lassen und nur für lokale
      Integrationstests einen explizit verifizierten Revisionsprovider
      konfigurieren
- [ ] 5.3 Health-/Readiness-Befunde für Datenbank, Service-Issuer und fehlende
      IAM-Projektionsrevision getrennt und ohne zweiten Rolloutpfad abbilden
- [ ] 5.4 Ausfalltests für Studio, Plugin-Datenbank, JWKS und fehlende Medien-
      Capability ergänzen; keine persistente SSF-Fallback-Schicht einführen

## 6. Dokumentation und Gates

- [x] 6.1 Den deutschen und englischen V1-Vertrag um konkrete OpenAPI-,
      Größen-, Hash-, Sanitizer- und Implementierungsverweise ergänzen
- [x] 6.2 Betroffene arc42-Abschnitte 03 bis 11 auf den tatsächlich
      implementierten Zwischenstand und das fail-closed IAM-Follow-up prüfen
      und aktualisieren
- [x] 6.3 ADR-057 nur bei tatsächlicher Entscheidungsabweichung fortschreiben;
      andernfalls die konforme Implementierung in Abschnitt 09 nachweisen
- [ ] 6.4 Relevante Unit-, Type-, Server-Runtime-, PostgreSQL-Integrations-,
      Plugin-Boundary-, OpenAPI-, Security- und E2E-Gates ausführen
- [x] 6.5 `pnpm check:server-runtime`, `pnpm check:plugin-architecture-boundary`,
      `pnpm check:file-placement`, `pnpm check:docs` und den betroffenen
      Schema-Snapshot-Check erfolgreich ausführen
- [x] 6.6 `pnpm exec openspec validate add-ssf-runtime-configuration-api --strict`
      und `git diff --check` erfolgreich ausführen
- [ ] 6.7 Vor produktivem Enablement ein getrenntes Follow-up für die
      revisionsgebundene SSF-Keycloak-Permission-Projektion freigeben und
      dessen End-to-End-Nachweise verlangen
