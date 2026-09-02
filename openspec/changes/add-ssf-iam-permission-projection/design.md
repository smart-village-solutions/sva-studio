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

Der Projektionsadapter deaktiviert dafür vor dem ersten Keycloak-Write nur den
tenantlokalen SSF-OIDC-Client und aktiviert ihn erst nach bestätigtem Read-back
und erfolgreichem SSF-Session-Widerruf wieder. Der Studio-Client und die
gemeinsame Realm-Sitzung werden dabei nicht verändert. Ein Fehler in einer
Phase lässt den SSF-Client deaktiviert und die Projektion nicht bereit.

Die noch offene produktive Clientauflösung darf weder Realm noch Client-ID aus
einem Projektionsauftrag übernehmen. Sie muss die kanonische Instanz und deren
Tenant-Realm aus der Instanz-Registry beziehen. Dieser Change führt dafür
bewusst keine neue generische Plugin-SDK- oder Provisionierungsschicht ein.

Die pluginseitige Widerrufsgrenze erzwingt bereits eine begrenzte Gesamtlaufzeit
und reicht ein `AbortSignal` an den künftigen Transportadapter weiter. Der
produktive SSF-Dienst stellt aktuell jedoch nur den sitzungsbezogenen Endpunkt
`DELETE /api/admin/session/{session_id}/terminate` bereit; sein Sessionmodell
kennt noch keinen Tenant. Der produktive Adapter bleibt deshalb bewusst offen,
bis SSF im Rahmen seiner Multi-Tenant-Fähigkeit einen authentifizierten,
idempotenten Sammelwiderruf mit expliziter Tenantbindung definiert. Aus einer
Studio-Instanz-ID werden weder Session-IDs erraten noch realmweite
Keycloak-Logouts abgeleitet.

### Studio veröffentlicht den SSF-Widerrufsvertrag als Consumer zuerst

Die fehlende Provider-Implementierung blockiert nicht den Abschluss der
Studio-Seite. Studio implementiert und testet vorab folgenden festen
Consumer-Vertrag:

```http
POST /internal/control-plane/v1/session-revocations
Authorization: Bearer <service-token>
X-Studio-Instance-Id: <canonical-instance-id>
X-Correlation-Id: <correlation-id>
Idempotency-Key: ssf-authorization:<sha256-of-instance-and-revision>
Content-Type: application/json

{
  "authorizationRevision": "sha256:<lowercase-hex>"
}
```

Der Provider antwortet mit `204 No Content` erst, wenn alle vor dem Aufruf
bestehenden Sessions genau dieses Tenants widerrufen sind. Ein wiederholter
Aufruf mit demselben Idempotency-Key und Payload ist erfolgreich und ebenfalls
`204`; derselbe Schlüssel mit abweichendem Payload ist ein Konflikt. Der
Vertrag enthält weder Benutzerkennungen noch Session-IDs und erlaubt keine
tenantübergreifende oder realmweite Operation.

Studio verwendet dafür eine eigene technische Identität
`sva-studio-ssf-control-plane`, deren Credentials deploymentseitig
bereitgestellt werden. Ihr Token besitzt die Audience
`ssf-control-plane`, die Action `ssf.sessions.revoke` und repräsentiert
ausschließlich Studio als aufrufendes Backend. Der vorhandene Client
`ssf-runtime` bleibt der gegenläufigen Kommunikation SSF → Studio vorbehalten.
Das installationsweite Token erhält keinen Tenantclaim; die Tenantbindung
entsteht aus dem durch die Studio-Registry bestätigten
`X-Studio-Instance-Id`-Wert und muss auf SSF-Seite gegen dessen eigenes
Tenantmodell aufgelöst werden.

Der serverseitige SSF-Plugin-Adapter besitzt Pfad, Request- und
Response-Vertrag, Idempotenzschlüssel sowie fachliche Fehlerabbildung. Ein
kleiner injizierbarer Client-Credentials-Provider liefert ihm kurzlebige
Tokens. Basis-URL, Token-URL, Client-ID und Secret stammen ausschließlich aus
Deploymentkonfiguration. Dafür wird weder das Plugin-SDK erweitert noch eine generische
Root-Client-Provisionierung eingeführt.

Der Aufruf respektiert das vorhandene `AbortSignal`; Timeout und Netzwerkfehler
werden durch den bestehenden Lifecycle erneut versucht. Der Adapter selbst
führt keine verschachtelte Retry-Schleife ein. `429` und `5xx` werden als
retrybar klassifiziert; `400`, `401`, `403`, `404` sowie ein
Idempotenzkonflikt bleiben blockiert. Bis ein echter SSF-Provider existiert,
beweist ein simulierter HTTP-Provider den Consumer-Vertrag. Produktives
Enablement und Staging-E2E bleiben gesperrt.

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
- Consumer-first kann bis zur SSF-Implementierung nur Studio-Vertragstreue,
  nicht die Provider-Konformität beweisen. Der exakte Staging-E2E bleibt daher
  ein separates Freigabegate.
