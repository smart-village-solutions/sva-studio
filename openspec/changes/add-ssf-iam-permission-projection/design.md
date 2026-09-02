## Context

Der Runtime-Konfigurations-Change akzeptiert ausschließlich eine hostseitig
verifizierte `authorizationRevision`. Er erzeugt bewusst keine Revision aus
Soll-Permissions, Cachezuständen oder Testwerten. Dieser Change schließt die
verbleibende produktive IAM-Grenze.

## Decisions

### Eine materialisierte Projektion ist die einzige Revisionsquelle

Studio berechnet die Revision aus der tatsächlich erfolgreich in den
Tenant-Realm der gemeinsam genutzten Keycloak-Instanz geschriebenen
Permission-Projektion. Erst ein
anschließender Read-back bestätigt die Revision als bereit. Gewünschter und
bestätigter Zustand bleiben getrennt.

Der plugin-eigene Zustand verwendet dafür eine monotone Generation und die
Phasen `pending`, `projecting`, `revocation_pending`, `ready` und `blocked`.
Eine neue Sollprojektion entfernt jede zuvor veröffentlichte Readiness sofort.
`ready` ist nur zulässig, wenn Sollrevision, Read-back-Revision und die Revision
des bestätigten Session-Widerrufs identisch sind.

Die IAM-Auslese bleibt eine generische Host-Capability. Das SSF-Plugin fordert
nur seine feste Permission-Allowlist an und übersetzt den zurückgegebenen,
unveränderten Keycloak-Subject selbst. Nur die tenantlokale Studio-Rolle
`system_admin` ergibt dabei die SSF-Persona `tenant_admin`; kundenspezifische
Rollen bleiben auch mit Verwaltungs-Permissions fachlich `user`.

Der vollständige externe Reconcile läuft unter einer tenantgebundenen
PostgreSQL-Advisory-Lock der SSF-Plugin-Datenbank. Damit können verschiedene
Tenants parallel verarbeitet werden, während Write, Read-back und Widerruf für
denselben Tenant serialisiert bleiben. Endet ein Worker oder seine Verbindung,
wird die Sperre automatisch freigegeben; ein Folgelauf darf deshalb auch einen
verwaisten Zustand `projecting` oder `revocation_pending` erneut idempotent
beanspruchen.

### Token und Runtime-Konfiguration müssen revisionsgleich sein

Studio und SSF verwenden für einen Tenant denselben Realm und damit dieselbe
Benutzeridentität. Das OIDC-`sub` eines Tenant-Benutzers gilt in beiden
Anwendungen unverändert; eine zweite Benutzerkorrelation existiert nicht.

SSF akzeptiert neue Benutzersessions nur, wenn der Claim des
Tenant-Benutzertokens der vom Studio gelieferten `authorizationRevision`
entspricht. Ein Mismatch ist ein Readiness- beziehungsweise
Reauthentifizierungsfall, kein Fallback. Das installationsweite
SSF-Service-Token wird vom technischen Client im Studio-Root-Realm ausgestellt
und weist nur Backend-Identität, Audience und Action nach. Es trägt keine
tenantbezogene Autorisierungsrevision; der angeforderte Tenant wird erst über
`X-Studio-Instance-Id` gebunden und Studio liest dessen bestätigte Revision
hostseitig.

### Änderungen widerrufen alte Sessions

Nach einer relevanten Permission-Änderung wird die neue Projektion bestätigt,
danach werden bestehende SSF-Sessions des Tenants über eine SSF-seitige,
tenantgebundene Sessiongrenze widerrufen. Ein reiner Permission-Wechsel darf
keinen realmweiten Keycloak-Benutzerlogout auslösen, weil derselbe Benutzer
auch Studio verwendet. Neue Tokens enthalten die neue Revision. Retry und
Teilfehler bleiben tenantgebunden, idempotent und auditierbar.

### Der bestehende Rolloutpfad bleibt maßgeblich

Bootstrap beziehungsweise Plugin-Lifecycle führen den Reconcile aus;
Staging-E2E weist Projektion, Tokenclaim, Runtime-Antwort und Widerruf für den
exakten Image-Digest nach. Production verwendet denselben Digest über den
kanonischen Promote-Workflow.

## Risks

- Ein Fehler zwischen Keycloak-Write, Read-back und Session-Widerruf kann einen
  Zwischenzustand erzeugen. Der Zustand bleibt deshalb nicht bereit, bis alle
  erforderlichen Nachbedingungen bestätigt sind.
- Revisionen dürfen keine PII oder frei wählbaren Tenantwerte in Logs und
  Metriklabels übertragen.
