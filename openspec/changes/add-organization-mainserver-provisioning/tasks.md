## 1. Datenmodell und Verträge

- [x] 1.1 DB-Migration für `iam.accounts.is_technical_account BOOLEAN NOT NULL DEFAULT false` erstellen.
- [x] 1.2 Organisationsbezogenen Mainserver-Zustand um eine instanzsichere, eindeutige Accountreferenz mit `ON DELETE SET NULL` ergänzen, ohne Bestands-Credentials zu verändern.
- [x] 1.3 `iam.organization_mainserver_credentials` um die Zustände `not_provisioned`, `account_ready`, `provisioning`, `verification_required`, `ready`, `failed` und `reconciliation_required` sowie Operationsreferenz, Phase, Versuchszähler, Lease, sicheren Fehlercode und relevante Zeitpunkte erweitern.
- [x] 1.4 Vollständige bestehende manuelle Credentials nach `verification_required` migrieren; unvollständige Bestände als `not_provisioned` behandeln und keine Credentials automatisch rotieren.
- [x] 1.5 `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` entsprechend fortschreiben.
- [x] 1.6 Core-, API- und Validierungsverträge um `isTechnicalAccount`, `includeTechnicalAccounts` und das secret-freie Provisioning-Read-Model ergänzen.
- [x] 1.7 Die Mainserver-Provisioning-Antwort typisiert um die vertraglich garantierte `data_provider_id` erweitern.

## 2. Technische Account-Klassifikation

- [x] 2.1 Account-Erstellung und -Bearbeitung um das boolesche Flag erweitern; dabei keine automatischen Änderungen an Status, Login, Rollen, Gruppen, Einladungen oder Mainserver-Daten auslösen.
- [x] 2.2 Account-Read-Models, Keycloak-Projektion und Import-/Reconcile-Pfade so erweitern, dass lokale Klassifikationen erhalten bleiben und unmapped Keycloak-Benutzer standardmäßig als nicht technisch gelten.
- [x] 2.3 Änderungen des Flags PII-minimiert mit Actor, Zielaccount sowie altem und neuem Wert auditieren.
- [x] 2.4 Unit- und Integrationstests für Create, Update, unveränderte Nebenwirkungen und Reconcile-Erhalt ergänzen.
- [x] 2.5 Belegen, dass `isTechnicalAccount` beim normalen Account-Create weder Organisations-Provisioning auslöst noch das bestehende persönliche Mainserver-Provisioning unterdrückt.

## 3. Accountliste und UI

- [x] 3.1 Den serverseitigen Benutzerlisten-Resolver um exakte Filterung technischer Accounts vor fachlicher Pagination und Gesamtzahlberechnung erweitern.
- [x] 3.2 Zusammenspiel mit Suche, Status-, Rollen- und Seitenfilter testen, einschließlich Keycloak-Fenstern mit ausschließlich technischen Treffern.
- [x] 3.3 Die Accounttabelle standardmäßig ohne technische Accounts laden und die lokalisierte Filteroption „Auch technische Accounts anzeigen“ ergänzen.
- [x] 3.4 Beim Umschalten des Filters auf Seite 1 zurücksetzen und eingeblendete technische Accounts mit einem lokalisierten Badge kennzeichnen.
- [x] 3.5 Account-Erstellungs- und Detailformular um „Ist ein technischer Account“ samt erklärendem Hinweis und Warnung beim Entfernen des Flags ergänzen.
- [x] 3.6 UI-Tests für Standardausblendung, Filter, Pagination, Bearbeitung, i18n, Tastaturbedienung und Statuskommunikation ergänzen.

## 4. Kontolöschungsregeln

- [x] 4.1 Automatische und manuell angestoßene Inaktivitäts-Lifecycle-Läufe vor der Zustandsentscheidung um den Ausschluss technischer Accounts ergänzen.
- [x] 4.2 Sicherstellen, dass das Flag bestehende Lifecycle-Zustände nicht zurücksetzt und ein später entferntes Flag die normale Regelbewertung wieder aktiviert.
- [x] 4.3 Belegen, dass explizite normale Deaktivierung unverändert bleibt und privilegierter Hard Delete nur während aktiver Provisioning-Lease blockiert, ansonsten die Accountreferenz löst und gültige Organisationsdaten erhält.
- [x] 4.4 Lifecycle-Tests für aktive, deaktivierte, pseudonymisierte, neu markierte und wieder entmarkierte technische Accounts ergänzen.

## 5. Organisations-Provisioning

- [x] 5.1 Einen atomaren Lease-/Reservationsvertrag pro `(instanceId, organizationId)` implementieren, einschließlich Operationsreferenz, Ablauf, Übernahme und idempotenter Antwort für parallele Requests.
- [x] 5.2 Einen idempotenten Resolver für den zugeordneten Studio-/Keycloak-Account implementieren; lokale Accountpersistenz und Organisationszuordnung gemeinsam abschließen.
- [x] 5.3 Deterministische, ASCII-sichere und kollisionsfeste Ableitung von E-Mail, Username, Vorname und Nachname aus Organisation und Tenant implementieren und testen.
- [x] 5.4 Technische Keycloak-Accounts mit `instanceId`, `organizationId` und `accountPurpose = organization_mainserver` kennzeichnen und Recovery nur bei vollständiger eindeutiger Übereinstimmung erlauben.
- [x] 5.5 Die Organisationserstellung nach lokalem Commit um best-effort Provisioning ergänzen; fehlende Konfiguration, persönliche Credentials und externe Ausfälle dürfen den Create-Erfolg nicht zurückrollen oder als fehlgeschlagene Organisationserstellung darstellen.
- [x] 5.6 `POST /api/v1/iam/organizations/:organizationId/provision-mainserver` ausschließlich mit `iam.org.write`, Idempotenz und sicheren Fehlercodes ergänzen; der Request darf keine freien technischen Accountattribute enthalten.
- [x] 5.7 Den Bootstrap-Token ausschließlich mit persönlichen Mainserver-Credentials des handelnden Administrators laden; aktiven Organisationskontext und jeden Organisations-Credential-Fallback ausschließen.
- [x] 5.8 Den unveränderten Mainserver-Benutzer-Endpunkt mit dem realen Keycloak-Subject und den abgeleiteten Accountdaten aufrufen.
- [x] 5.9 Application-ID und Secret verschlüsselt persistieren und die garantierte `data_provider_id` aus der Provisioning-Antwort als `create_response`-Evidenz für die Erstbindung verarbeiten.
- [x] 5.10 `/data_provider.json` für spätere Verifikation und Rotation verwenden; Abweichungen ohne Überschreiben als Konflikt und `reconciliation_required` persistieren.
- [x] 5.11 Lost-Response-, Timeout-, Teilpersistenz- und Retry-Fälle phasengenau abdecken; vor sicher nicht abgesendetem Upstream-Aufruf darf ein nachweislicher Verlierer deaktiviert werden, danach nicht mehr.
- [x] 5.12 Retry in `verification_required` und `reconciliation_required` zuerst vorhandene Credentials, Zuordnung und Binding vervollständigen lassen, bevor neu provisioniert wird.
- [x] 5.13 Hard Delete mit aktiver Lease sicher ablehnen, sonst die Accountreferenz lösen und gültige Organisations-Credentials sowie Bindungen erhalten.
- [x] 5.14 Organisationsdetail und -erstellung um den verständlichen, secret-freien Provisioning-Zustand und die explizite Nachprovisionierungsaktion ergänzen.

## 6. Audit, Dokumentation und Verifikation

- [x] 6.1 Audit- und Server-Logging für automatische Provisionierung, expliziten Retry, Skip, Upstream-Fehler, Erfolg und Reconciliation ergänzen; Secrets und rohe Upstream-Antworten ausschließen.
- [x] 6.2 Die relevanten IAM-, Organisations- und Mainserver-Guides aktualisieren.
- [x] 6.3 Arc42 `03-context-and-scope`, `05-building-block-view`, `06-runtime-view` und `08-cross-cutting-concepts` aktualisieren.
- [x] 6.4 Eine ADR zur technischen Account-Klassifikation und Organisations-Provisionierung erstellen und in `09-architecture-decisions` verlinken.
- [x] 6.5 Nach jedem Implementierungsblock die kleinsten betroffenen Unit-, Typ- und Server-Runtime-Gates ausführen; für DB- und Runtime-Änderungen insbesondere `pnpm check:server-runtime` früh prüfen.
- [x] 6.6 Integrations- und E2E-Flows für lokale Erstellung ohne Integration oder persönliche Credentials, erfolgreiche Provisionierung, `org_only`-Bootstrap, Retry, Filter und Lifecycle-Ausschluss ausführen.
- [x] 6.7 Konkurrenz-, Lease-Übernahme-, Crash-Recovery-, Lost-Response-, DataProvider-Konflikt- und Hard-Delete-Tests für alle relevanten Zustände ergänzen.
- [x] 6.8 `pnpm check:file-placement`, OpenSpec-Strict-Validierung und den gemessenen relevanten PR-Gate-Pfad ausführen.
- [x] 6.9 Den Implementierungs-PR explizit mit GitHub-Issue `#749` „Trennung von technischen und normalen Accounts“ verknüpfen und bei vollständiger Umsetzung mit `Closes #749` schließen.
- [x] 6.10 Review-Fix: Credential-Persistenz und alle laufenden Zustandsübergänge atomar an Operationsreferenz und aktive Lease binden; eine verlorene Lease darf weder Credentials überschreiben noch Erfolg melden.
- [x] 6.11 Review-Fix: Unveränderte `isTechnicalAccount`-Werte vor Update, Audit und Permission-Invalidierung aus dem Payload entfernen und reine No-op-Updates ohne Schreibnebenwirkungen behandeln.
- [x] 6.12 Review-Fix: Für die Standardausblendung nur technische Keycloak-Subjects leichtgewichtig laden und vollständige lokale Accountprojektionen erst für die tatsächlich paginierte Seite aufbauen.
