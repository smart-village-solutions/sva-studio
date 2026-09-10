# Change: Schlankes SSF-Mandantenverzeichnis bereitstellen

## Why

SSF benötigt ID, Namen und Realm der aktiven Mandanten dieser Studio-Installation
für seine eigene Login-Auswahl. Der vereinfachte Vertrag wurde im Dialog
freigegeben: nur aktive Registry-Einträge, keine zusätzliche SSF-Readiness,
keine Freigabeliste und kein Studio-Login-Handler.

## What Changes

- Interner GET-Endpoint `/internal/plugins/ssf/v1/admin-login-tenants` mit
  `contractVersion`, deterministischer `directoryRevision` und alphabetisch
  sortierten `tenants: [{id, displayName, realm}]`.
- Bestehende SSF-Service-Identität mit eigener Rolle
  `ssf.admin-login-directory.read`; keine Tenant-Bindung.
- Der Host liest seine Registry direkt; der tenantgebundene Plugin-Dispatcher
  bleibt unverändert. Der bestehende interne Ingress-Schutz gilt weiter.
- Bestehender Operator gleicht beide SSF-Leserollen ab.

## Impact

- Affected specs: `ssf-admin-login-directory` (neu).
- Affected code: `auth-runtime`, Studio-Serververdrahtung, SSF-Service-Client-Operator.
- Dokumentation: `docs/api/ssf-admin-login-mandanten-v1.md`,
  `docs/operations/ssf-runtime-service-identitaet.md`, arc42 Abschnitte 3, 5
  und 8.
- Keine Schemaänderung, keine SSF-Frontend-Änderung und kein Deployment.

## Invarianten und Nachweise

Authentifizierung und Directory-Rolle müssen vor dem Registry-Lesen erfolgreich
sein. Nur aktive Einträge und die zwei freigegebenen Felder dürfen die Grenze
passieren. Ausfälle ergeben `503`, eine tatsächlich leere Liste `200`.
Gezielte Unit-Tests, Ingress-Tests, Rollen-Abgleichstests, Type- und
Server-Runtime-Gates sichern diese Grenzen ab.
