# Change: Revisionsgebundene SSF-IAM-Permission-Projektion einführen

## Why

Der interne SSF-Runtime-Konfigurationsendpunkt ist implementiert, bleibt aber
absichtlich fail-closed, solange Studio keine verifizierte tenantweite
`authorizationRevision` bereitstellen kann. Für ein produktives Enablement
müssen Studio-IAM, die SSF-Claims im gemeinsamen Tenant-Realm und laufende
SSF-Sessions auf dieselbe materialisierte Permission-Projektion gebunden
werden.

## What Changes

- Studio materialisiert pro SSF-Tenant die effektiven SSF-Permissions im
  jeweiligen Tenant-Realm der gemeinsam von Studio und SSF verwendeten
  Keycloak-Instanz.
- Jede erfolgreiche Projektion erhält einen deterministischen
  `authorizationRevision`-Fingerprint.
- SSF-Benutzertoken tragen diese Revision; der Runtime-Endpunkt liefert sie nur
  nach verifizierter Projektion aus. Das installationsweite SSF-Service-Token
  authentifiziert ausschließlich das Backend und ist nicht tenantgebunden.
- Relevante Permission-Änderungen widerrufen bestehende SSF-Sessions und
  erzwingen eine erneute Tokenausstellung.
- Studio authentifiziert ausgehende Control-Plane-Aufrufe mit deploymentseitig
  bereitgestellten Credentials einer eigenen technischen Identität
  `sva-studio-ssf-control-plane`; der gegenläufige SSF-Runtime-Client wird
  nicht wiederverwendet. Eine neue generische Provisionierungsabstraktion ist
  nicht Teil dieses Changes.
- Reconcile, Retry, Audit, Readiness und Rollout-Evidenz werden im bestehenden
  Plugin-Lifecycle- und Promote-Pfad ergänzt.

## Out of Scope

- Änderungen am V1-Konfigurationsschema oder an `configurationRevision`
- ein zweiter Deploymentpfad
- lokale Testkonstanten oder gewünschte Permission-Mengen als produktive
  Projektionsrevision

## Dependencies

- `add-ssf-runtime-configuration-api`
- `add-plugin-tenant-lifecycle`
- der tenantlokale SSF-OIDC-Client aus `add-ssf-tenant-administration`; seine
  Provisionierung bleibt ein eigener, noch offener Lieferabschnitt
- der freigegebene Permission-Katalog des SSF-Plugins

## Success Criteria

- Claim, Host-Readiness und Runtime-Antwort verwenden für denselben Tenant
  exakt dieselbe verifizierte Revision.
- Der Studio-Consumer für den tenantgebundenen SSF-Sammelwiderruf ist
  produktionsfähig implementiert und gegen einen simulierten Provider
  vertraglich getestet, bevor SSF die Provider-Seite bereitstellt.
- Fehlende, veraltete oder gescheiterte Projektionen blockieren die
  Runtime-Konfiguration und neue SSF-Sessions.
- Permission-Änderungen machen alte Tokens und Sessions nachweisbar unwirksam.
- Zwei Tenant-Projektionen können sich weder in Keycloak noch in Studio
  gegenseitig beeinflussen.
