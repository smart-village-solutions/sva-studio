## 1. SSF-Plugin und Verträge

- [ ] 1.1 SSF-Plugin über den kanonischen Generator-/Katalogpfad anlegen
- [ ] 1.2 Plugin als `automatic` mit Root-/Tenant-Contributions registrieren
- [ ] 1.3 Konkrete `ssf.*`-Actions, Audit-Events und Fehlercodes definieren
- [ ] 1.4 Zusätzliche Keycloak-Client-Anforderungen deklarativ festlegen

## 2. SSF-Plugin-Datenbank

- [ ] 2.1 Eine einzelne PostgreSQL-Datenbank mit Installations- und Tenant-Schema bereitstellen
- [ ] 2.2 Getrennte Migrator-, Root- und Tenant-Runtime-Principals einrichten
- [ ] 2.3 Tenant-Grunddatensatz mit `instanceId`, Status und Revision implementieren
- [ ] 2.4 Transaktionsgebundenen Tenant-Kontext und RLS umsetzen
- [ ] 2.5 Eigene Sollschema-Dokumentation und reversible Migrationen erstellen
- [ ] 2.6 PostgreSQL-Integrationstests mit mindestens zwei Tenants und Root-/Tenant-Negativfällen ergänzen

## 3. Keycloak und initialer Tenant-Admin

- [ ] 3.1 Provisionierung um deklarierte Studio-/SSF-Clients und Audiences erweitern
- [ ] 3.2 Initialen Tenant-Admin mit tenantlokalem `system_admin` integrieren
- [ ] 3.3 Kopieren von Root-Benutzern und automatische E-Mail-Verknüpfung ausschließen
- [ ] 3.4 Idempotenz-, Drift-, Secret- und Teilfehlertests für Realm und Clients ergänzen

## 4. Tenant-Lifecycle

- [ ] 4.1 SSF-Provision-, Reconcile-, Suspend-, Reactivate- und Readiness-Beiträge registrieren
- [ ] 4.2 Automatische Aktivierung, SSF-IAM-Basis und Tenant-Grunddatensatz orchestrieren
- [ ] 4.3 Teilzustände und Retry über die generische Plugin-Operations-Plattform abbilden
- [ ] 4.4 Suspendierung und Reaktivierung ohne Daten- oder Realm-Löschung implementieren

## 5. Admin-Oberflächen

- [ ] 5.1 SSF-Status und Aktionen in bestehendes Instanzdetail, Setup und Cockpit integrieren
- [ ] 5.2 Root-Funktionen ausschließlich für `instance_registry_admin` freigeben
- [ ] 5.3 Tenantlokale Nutzer-, Rollen- und Gruppenverwaltung unverändert wiederverwenden
- [ ] 5.4 UI-Tests für Root-/Tenant-Trennung, Readiness, Reparatur, Accessibility und i18n ergänzen

## 6. Betrieb und Sicherheit

- [ ] 6.1 Audit und PII-arme Korrelation über Realm-, IAM- und Plugin-Provisionierung implementieren
- [ ] 6.2 Deployment-, Secret-, Backup-, Restore- und Rollback-Verträge dokumentieren
- [ ] 6.3 Readiness für Keycloak, IAM und SSF-Datenbank getrennt nachweisen

## 7. Architektur und Abnahme

- [ ] 7.1 Betroffene arc42-Abschnitte und ADRs für Realm-/Client-Modell sowie Datenbank-Ownership aktualisieren
- [ ] 7.2 Zielbild auf den implementierten Tenant-Administrationsstand aktualisieren
- [ ] 7.3 Relevante Unit-, Type-, Server-Runtime-, Integrations-, E2E-, Security- und Migrations-Gates ausführen
- [ ] 7.4 Abnahme mit zwei Tenants, getrennten Realms, initialen Admins, Suspendierung und Reaktivierung dokumentieren
- [ ] 7.5 `openspec validate add-ssf-tenant-administration --strict`, Dokumentations- und Platzierungschecks ausführen
