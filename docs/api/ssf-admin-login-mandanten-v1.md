# SSF-Mandantenverzeichnis für den Login (V1)

Das SSF-Backend liest die aktiven Mandanten der aktuellen Studio-Installation.
SSF stellt die öffentliche Login-Auswahl bereit und startet selbst den OIDC-Flow.
Studio erzeugt für diesen Vertrag weder Login-URLs noch OIDC-Requests.

```http
GET /internal/plugins/ssf/v1/admin-login-tenants
Authorization: Bearer <SSF service token>
X-Correlation-Id: <id>
```

```json
{
  "contractVersion": "1.0",
  "directoryRevision": "sha256:…",
  "tenants": [
    {
      "id": "tenant-kassel",
      "displayName": "Stadt Kassel",
      "realm": "kassel-ssf-2025"
    }
  ]
}
```

## Auswahl und Felder

- Quelle ist die lokale Studio-Mandanten-Registry (`iam.instances`).
- Ausschließlich Einträge mit `status: active` werden ausgegeben.
- Keine zusätzliche SSF-Aktivierungs-, Readiness-, Testmandanten- oder Freigabelistenprüfung.
- `id` ist die stabile `instanceId`, `displayName` die Bezeichnung und `realm`
  der `authRealm` aus der Registry.
  SSF darf den Realm nicht aus der Mandanten-ID ableiten.
- Sortierung nach `displayName` mit deutscher Kollation, bei Gleichstand nach `id`.
- Keine weiteren Mandantenfelder, Admin-URLs oder Credentials werden ausgegeben.
- Eine leere Liste ist eine gültige Antwort mit `contractVersion`,
  `directoryRevision` und `tenants: []`.
- `directoryRevision` ist `sha256:` plus der SHA-256-Hash der kanonisch
  sortierten JSON-Darstellung von `tenants`. Sie bleibt bei unverändertem
  öffentlichen Verzeichnis stabil und ändert sich mit dessen Inhalt.
- Antworten tragen `Cache-Control: no-store`; SSF kann anhand der Revision
  selbst entscheiden, ob es eine unveränderte Liste weiterverwendet.

## Service-Zugriff und Fehler

Der Abruf erfolgt ausschließlich serverseitig über die private Verbindung zu
Studio. Der vorhandene interne Ingress-Schutz weist Requests mit `Forwarded`
oder `X-Forwarded-*` mit `404` ab. Ein Tenant-Header ist nicht erforderlich.

Die bestehende [SSF-Service-Identität](../operations/ssf-runtime-service-identitaet.md)
wird anhand Signatur, Ablaufzeit, Issuer, Audience und Client-ID geprüft. Dieser
Endpoint verlangt die eigene Client-Rolle `ssf.admin-login-directory.read`.
`ssf.runtime-configuration.read` allein reicht nicht aus.

| HTTP | `error.code`                        | Bedeutung                                                                            |
| ---- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| 401  | `service_authentication_invalid`    | Fehlendes oder ungültiges Service-Token                                              |
| 403  | `service_action_forbidden`          | Directory-Leseberechtigung fehlt                                                     |
| 503  | `admin_login_directory_unavailable` | Service-Konfiguration, Identitätsprüfung oder Registry vorübergehend nicht verfügbar |

Fehler enthalten zusätzlich `error.correlationId`. Ein gültiger
`X-Correlation-Id` (maximal 128 druckbare ASCII-Zeichen) wird übernommen;
ansonsten dient die Studio-Request-ID als Diagnosebezug. Andere HTTP-Methoden
liefern `405` mit `Allow: GET`. Fehler werden nicht als leere Liste maskiert.

SSF bildet aus dem Realm seinen eigenen Login-Einstieg und erzeugt pro Anmeldung
`state`, `nonce`, PKCE und die passende Redirect-URI. Studio-/Keycloak-Service-
Credentials gelangen niemals in den Browser. Die SSF-Login-Seite ist außerhalb
dieses Studio-Änderungsumfangs.
