# Change: Mainserver-Zugänge für Organisationen provisionieren

## Why

Persönliche Studioaccounts können bereits über den bestehenden Benutzer-Provisioning-Endpunkt des SVA Mainservers mit Mainserver-Credentials versorgt und später erneut provisioniert werden. Organisationen besitzen zwar einen geschützten Credential-Speicher, müssen ihre Zugangsdaten bislang aber manuell erhalten. Da der SVA Mainserver nicht verändert wird und sein Provisioning einen realen Keycloak-Benutzer voraussetzt, benötigt jede automatisch provisionierte Organisation einen zugeordneten Studio-/Keycloak-Account.

Das Studio muss zugleich ohne erreichbaren oder konfigurierten SVA Mainserver arbeitsfähig bleiben. Eine lokale Organisationserstellung darf deshalb nicht an Keycloak- oder Mainserver-Provisioning scheitern. Technische Accounts sollen als administrativ bearbeitbare Klassifikation modelliert, standardmäßig aus der Accountliste ausgeblendet und von den konfigurierten Kontolöschungsregeln ausgenommen werden.

## What Changes

- Accounts erhalten das persistierte, administrativ bearbeitbare Flag `isTechnicalAccount`; die Änderung des Flags hat keine automatische Auswirkung auf Login, Keycloak-Status, Rollen, Gruppen, Einladungen oder Mainserver-Provisioning.
- Die Accountliste blendet technische Accounts standardmäßig aus und bietet die Filteroption „Auch technische Accounts anzeigen“. Filterung, Gesamtzahl und Pagination werden serverseitig konsistent berechnet.
- Accounts mit aktivem technischem Flag werden von allen automatischen und manuell ausgelösten Läufen des konfigurierten Inaktivitäts-Lifecycles ausgenommen. Der separate privilegierte Admin-Hard-Delete bleibt zulässig, löst eine vorhandene Provisioning-Accountreferenz und wird nur während einer aktiven Provisioning-Lease vorübergehend abgewiesen.
- Nach erfolgreicher lokaler Organisationserstellung versucht Studio bei konfigurierter Integration best-effort, einen fest vorgegebenen technischen Studio-/Keycloak-Account zuzuordnen und denselben Mainserver-Benutzer-Provisioning-Endpunkt wie für persönliche Accounts aufzurufen. Die eng begrenzte interne Accounterstellung ist Bestandteil von `iam.org.write` und verleiht keine allgemeine Account-Create-Berechtigung.
- Nicht erreichbares oder nicht konfiguriertes Keycloak-/Mainserver-Provisioning macht die lokale Organisationserstellung weder rückgängig noch zu einem Fehler. Ein späterer, idempotenter Organisations-Provisioning-Endpunkt ermöglicht die Nachversorgung.
- Den Bootstrap-Token lädt Studio ausschließlich mit den persönlichen Mainserver-Credentials des handelnden Administrators. Der aktive Organisationskontext beeinflusst diese Credential-Auswahl nicht; ein Fallback auf Organisations-Credentials findet nicht statt.
- Die für den unveränderten Mainserver-Endpunkt benötigten Benutzerdaten werden deterministisch aus Organisation und Tenant abgeleitet; die E-Mail folgt grundsätzlich `<org-name>.<tenant-name>@smart-village.app`.
- Zurückgegebene Application-Credentials werden ausschließlich verschlüsselt organisationsbezogen gespeichert. Die laut Mainserver-API-Vertrag identische `data_provider_id` aus der Provisioning-Antwort begründet die Erstbindung; `/data_provider.json` bleibt für spätere Verifikation und Credential-Rotation maßgeblich.
- Der bestehende Organisations-Credential-Speicher wird um einen persistenten Provisioning-Zustandsautomaten, eine zeitlich begrenzte Operations-Lease und sichere Reconciliation-Metadaten erweitert.
- Parallele Requests, Prozessabbrüche, Lost Responses und der Hard Delete eines zugeordneten technischen Accounts werden deterministisch und ohne stilles Überschreiben bestehender Credentials oder DataProvider-Bindungen behandelt.
- Organisations-Provisioning, Retry-Ergebnisse und Änderungen des technischen Flags werden PII- und secret-minimiert auditiert.

## Impact

- Affected specs: `account-ui`, `iam-access-control`, `iam-core`, `iam-data-subject-rights`, `iam-organizations`, `iam-auditing`, `sva-mainserver-integration`
- Affected code: `apps/sva-studio-react`, `packages/core`, `packages/iam-admin`, `packages/auth-runtime`, `packages/routing`, `packages/sva-mainserver`, IAM-Migrationen und Schema-Snapshots
- Affected data: `iam.accounts`, `iam.organization_mainserver_credentials`, organisationsbezogene DataProvider-Bindings und technische Keycloak-Accountattribute
- Affected arc42 sections: `03-context-and-scope`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`
- Related GitHub issue: `#749` „Trennung von technischen und normalen Accounts“; der Implementierungs-PR muss das Issue explizit verknüpfen.
- Related active changes: `use-mainserver-data-provider-as-content-author` für die automatische organisationsbezogene DataProvider-Bindung; `add-bulk-mainserver-user-reprovision` für den bestehenden Benutzer-Reprovisioning-Vertrag
