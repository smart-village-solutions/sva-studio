# Change: Schlankes SSF-Mandantenverzeichnis bereitstellen

## Why

SSF benötigt ID, Namen, Realm und die öffentliche Studio-URL der aktiven
Mandanten dieser Studio-Installation für seine eigene Login-Auswahl. Issue #1319
ergänzt den bisherigen Vertrag:
Aktive Einträge werden erst nach vollständiger Provisionierung und verifizierter
SSF-Readiness veröffentlicht. Es entsteht kein Studio-Login-Handler.

## What Changes

- Interner GET-Endpoint `/internal/plugins/ssf/v1/admin-login-tenants` mit
  `contractVersion`, deterministischer `directoryRevision` und alphabetisch
  sortierten `tenants: [{id, displayName, realm, studioUrl}]`.
- `studioUrl` wird ohne zusätzliche Datenhaltung als HTTPS-URL aus dem
  kanonischen `primaryHostname` des Registry-Eintrags gebildet. Die additive
  Erweiterung bleibt für den bestehenden SSF-V1-Consumer kompatibel.
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
- Keine Schemaänderung, keine SSF-Consumer-/Frontend-Änderung und kein Deployment.

## Invarianten und Nachweise

Authentifizierung und Directory-Rolle müssen vor dem Registry-Lesen erfolgreich
sein. Nur aktive, loginbereite Einträge und die vier freigegebenen Felder dürfen
die Grenze passieren. Die URL muss dem Registry-`primaryHostname` entsprechen;
die `directoryRevision` muss URL-Änderungen abbilden. Ausfälle ergeben `503`,
eine tatsächlich leere Liste `200`.
Gezielte Unit-Tests, Ingress-Tests, Rollen-Abgleichstests, Type- und
Server-Runtime-Gates sichern diese Grenzen ab.
