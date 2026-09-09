# SSF-Runtime-Service-Identität betreiben

## Zweck

Der vertrauliche Keycloak-Client `ssf-runtime` ist die einzige technische
Identität, mit der das SSF-Backend
`GET /internal/plugins/ssf/v1/runtime-configuration` aufruft. Er liegt im
Studio-Root-Realm derselben Installation und ist nicht tenantgebunden.

Der Client besitzt für die SSF-Anwendung genau:

- den verwalteten Audience-Mapper für `sva-studio-ssf-runtime`,
- die SSF-Client-Rolle `ssf.runtime-configuration.read`,
- einen aktivierten Service-Account.

Standard-, Implicit- und Direct-Access-Grant-Flows bleiben deaktiviert. Der
Client erhält keine menschliche Plattformrolle und keine weiteren
`ssf.*`-Actions.

Keycloak-eigene Default- und Realm-Rollen liegen außerhalb dieses Operators.
Die Runtime-Autorisierung wertet ausschließlich die genannte SSF-Action und
Audience aus.

## Umgebungsgrenze

Entwicklung, Staging und Produktion verwenden unterschiedliche Root-Realms
und Client-Secrets. Für eine eigenständige SSF-/Studio-Installation befindet
sich auch der Studio-Root-Realm im lokalen Keycloak dieser Installation. Die
Issuer-URL verweist niemals auf den zentralen Studio-Produktivserver.

| Wert | Studio-Konfiguration | SSF-Konfiguration |
| --- | --- | --- |
| Issuer | `SVA_STUDIO_SSF_RUNTIME_ISSUER` | daraus abgeleiteter Token-Endpunkt |
| Audience | `SVA_STUDIO_SSF_RUNTIME_AUDIENCE=sva-studio-ssf-runtime` | `sva-studio-ssf-runtime` |
| Client-ID | `SVA_STUDIO_SSF_RUNTIME_CLIENT_ID=ssf-runtime` | `ssf-runtime` |
| Client-Secret | nicht benötigt | geschütztes Deployment-Secret |

## Client idempotent einrichten

Voraussetzungen sind `kcadm.sh`, `jq`, ein bereits angelegter Studio-Root-Realm
und eine authentifizierte, nur lokal gespeicherte `kcadm`-Konfiguration. Der
Operator schreibt das generierte Secret ausschließlich in eine Datei mit Modus
`0600`; er gibt es nicht auf stdout aus.

```bash
export KCADM_CONFIG=/tmp/kcadm-ssf-runtime.config
export SSF_RUNTIME_ROOT_REALM=sva-studio
export SSF_RUNTIME_SECRET_OUTPUT=/tmp/ssf-runtime-client-secret

scripts/ops/ssf-runtime-service-client.sh reconcile
scripts/ops/ssf-runtime-service-client.sh verify
```

Die Secret-Datei wird unmittelbar in die geschützte SSF-Deploymentkonfiguration
übernommen und danach vom Operator gelöscht. Sie darf weder in Git noch in
Issues, Logs, Screenshots oder unverschlüsselte Betriebsberichte gelangen.

## Aktivierung und Smoke-Test

Studio erhält mindestens:

```env
SVA_STUDIO_SSF_RUNTIME_ENABLED=true
SVA_STUDIO_SSF_RUNTIME_ISSUER=https://<keycloak-host>/realms/<studio-root-realm>
SVA_STUDIO_SSF_RUNTIME_AUDIENCE=sva-studio-ssf-runtime
SVA_STUDIO_SSF_RUNTIME_CLIENT_ID=ssf-runtime
```

Der Nachweis erfolgt mit einem kurzlebigen Client-Credentials-Token, ohne Token
oder Secret auszugeben:

1. Token am veröffentlichten Token-Endpunkt beziehen.
2. Runtime-Endpunkt mit `Authorization`, `X-Studio-Tenant-Id` und
   `X-Correlation-Id` aufrufen.
3. `200`, `contractVersion: "1.0"` und eine mit dem Request identische
   `tenant.id` prüfen.
4. Je einen Aufruf ohne Action-Rolle und mit falscher Audience als `403`
   beziehungsweise `401` nachweisen.

Die Freigabe bleibt blockiert, solange SSF-Plugin-Datenbank, Tenant,
Plugin-Aktivierung oder bestätigte IAM-Projektionsrevision nicht bereit sind.
Ein `409 ssf_tenant_not_ready` ist dann ein korrekter fachlicher Gate-Befund,
aber noch kein erfolgreicher End-to-End-Nachweis.

## Rotation und Rollback

```bash
export SSF_RUNTIME_SECRET_OUTPUT=/tmp/ssf-runtime-client-secret-next
scripts/ops/ssf-runtime-service-client.sh rotate-secret
```

Keycloak invalidiert dabei das vorherige Secret. Deshalb wird die Rotation in
einem kurzen Wartungsfenster durchgeführt:

1. Runtime-Abruf in Studio deaktivieren oder SSF-Aufrufe pausieren.
2. Neues Secret erzeugen und geschützt in SSF einspielen.
3. Tokenbezug und Runtime-Smoke prüfen.
4. Runtime-Abruf wieder freigeben und die temporäre Secret-Datei löschen.

Scheitert der Smoke, bleibt der Runtime-Abruf deaktiviert. Der Operator erzeugt
ein neues Secret, spielt es erneut geschützt ein und wiederholt den Smoke. Ein
altes Secret wird nicht in Git oder einer zweiten Konfigurationsspur als
Rollbackkopie vorgehalten.

## Abnahme

Pro Umgebung werden ohne Geheimwerte festgehalten:

- Keycloak-Host und Root-Realm,
- Client-ID, Audience und Action,
- Zeitpunkt der erfolgreichen `verify`-Prüfung,
- Studio-Image-Digest und Konfigurationsrevision,
- HTTP-Status des positiven und der beiden negativen Runtime-Aufrufe.

Der reguläre Studio-Rollout bleibt an den
[Studio-Rollout-Prozess](../guides/studio-rollout-process.md) gebunden.
