# Host-Zuordnung der eigenständigen Studio-/SSF-Installation

## Geltungsbereich und Zielbild

Diese einmalige Erstinstallation auf `root@136.243.39.147` unter
`/root/projects/sva-studio-ssf` ist unabhängig vom regulären Studio-Prod-Server.
Der [reguläre Studio-Rollout](../guides/studio-rollout-process.md) bleibt unverändert.
Die folgenden Werte beschreiben die geplante Umschaltung, keinen bereits erfolgten Rollout.

| Host | Dienst und Kontext |
| --- | --- |
| `dialog.kassel.de` | SSF-Einstieg, kein Studio-Root |
| `studio.dialog.kassel.de` | Studio-Root, Instanzverwaltung und globale SSF-Konfiguration |
| `smartcity.dialog.kassel.de` | Studio-Tenant mit unveränderter ID `tenant-kassel` |
| `auth.dialog.kassel.de` | gemeinsamer lokaler Keycloak; Studio-Realm `sva-studio`, SSF-Realm `ssf` |

`studio` und `auth` dürfen nicht als Tenant-Hostnamen angelegt werden.
Die Hostbezeichnung ist nicht die Tenant-ID: Der interne SSF-Vertrag verwendet weiterhin
`tenant-kassel`. Bei einer normalen Instanzaktualisierung ohne Änderung der Basisdomain
bleibt der abweichende primäre Host erhalten.

## DNS und TLS

Die vorhandenen CNAMEs `dialog.kassel.de` und `*.dialog.kassel.de` zeigen auf
`kassel.smartspeechflow.de`. Der Benutzer muss am Ziel ergänzen:

```dns
kassel.smartspeechflow.de. IN A 136.243.39.147
```

Am 9. September 2026 lieferten öffentliche Resolver für dieses Ziel weder A noch AAAA.
Die CNAMEs allein reichen daher nicht. Für die vier Zielhosts müssen vollständige
DNS-Auflösung und Erreichbarkeit auf TCP 80/443 vor der Umschaltung geprüft werden.
Traefik verwendet den vorhandenen Resolver `le` mit TLS-ALPN-Challenge und stellt
Einzelzertifikate für die expliziten Hosts aus. Ein Wildcard-DNS-Eintrag ist kein
Wildcard-Zertifikat. Ein AAAA-Eintrag ist nur mit tatsächlich erreichbarem IPv6-Ziel zulässig.

## Studio-Konfiguration

```dotenv
SVA_PARENT_DOMAIN=dialog.kassel.de
SVA_STUDIO_ROOT_HOST=studio.dialog.kassel.de
SVA_PUBLIC_HOST=studio.dialog.kassel.de
SVA_PUBLIC_BASE_URL=https://studio.dialog.kassel.de
SVA_AUTH_ISSUER=https://auth.dialog.kassel.de/realms/sva-studio
SVA_AUTH_REDIRECT_URI=https://studio.dialog.kassel.de/auth/callback
SVA_AUTH_POST_LOGOUT_REDIRECT_URI=https://studio.dialog.kassel.de/
IAM_CSRF_ALLOWED_ORIGINS=https://studio.dialog.kassel.de,https://smartcity.dialog.kassel.de
SVA_STUDIO_SSF_RUNTIME_ISSUER=https://auth.dialog.kassel.de/realms/sva-studio
```

Ohne `SVA_STUDIO_ROOT_HOST` gilt weiterhin `SVA_PARENT_DOMAIN` als Root. Die optionale Variable wird auch in den Compose-Profilen und im Remote-Konfigurationsvertrag weitergereicht. Der konfigurierte Root-Host sowie `studio` und `auth` sind für Tenant-Anlage und Host-Änderungen gesperrt; entsprechende statische Allowlist-Einträge führen zu einem Konfigurationsfehler.
Der interne Keycloak-Admin-Zugriff bleibt auf dem lokalen Docker-Netz.
Datenbank-, Redis-, OIDC- und Verschlüsselungsgeheimnisse werden unverändert übernommen.
Keine Passwörter zurücksetzen und keine zusätzlichen Tenant-Rollen vergeben.

Der Studio-Traefik-Router erhält ausschließlich folgende Regel:

```text
(Host(`studio.dialog.kassel.de`) || Host(`smartcity.dialog.kassel.de`)) && !PathPrefix(`/internal/`)
```

Der vorhandene Keycloak-Router erhält die Host-Regel für `auth.dialog.kassel.de`.
Der SSF-Einstieg erhält einen eigenen Router für `dialog.kassel.de` auf den bestehenden
SSF-Frontend-Dienst. Bestehende SSF-API-/Frontend-Routen und deren Verbraucher müssen
vor Ablösung inventarisiert werden; Studio erhält weder Catch-all noch Wildcard-Router.

## Keycloak und Registry

Vor jeder Änderung die konkreten Realm-/Clientobjekte und Registry-Zeilen geschützt sichern.
Der bestehende Client `sva-studio` im Realm `sva-studio` benötigt explizit:

- Redirect-URIs: `https://studio.dialog.kassel.de/auth/callback` und
  `https://smartcity.dialog.kassel.de/auth/callback`.
- Web Origins: `https://studio.dialog.kassel.de` und `https://smartcity.dialog.kassel.de`.
- Post-Logout-Redirects: `https://studio.dialog.kassel.de/` und
  `https://smartcity.dialog.kassel.de/` im Clientattribut
  `post.logout.redirect.uris`, getrennt durch `##`.

Die gemeinsamen Login-Clientdaten erzeugen keine gemeinsame Sitzung und keine
Tenant-Berechtigungen aus `instance_registry_admin`. Plattform-Logins filtern technische
Plattformrollen; Tenant-Rechte kommen weiterhin aus dem Tenant-IAM.

In einer Transaktion nur `iam.instances.id = 'tenant-kassel'` und dessen Hostzeilen
korrigieren: Parent-Domain `dialog.kassel.de`, primärer Host
`smartcity.dialog.kassel.de`, Auth-Issuer
`https://auth.dialog.kassel.de/realms/sva-studio`. Den alten Studio-Root-Alias entfernen.
ID, Fachdaten, Mitgliedschaften, Module und verschlüsselte Secrets erhalten.
Kein Schemaeingriff und keine Neuprovisionierung des Tenants.

Keycloak `KC_HOSTNAME`, Realm-Frontend-URLs, SSF-Client-Redirects sowie SSF-API-Issuer
müssen konsistent auf den neuen Auth-Host zeigen. Der bestehende SSF-API-Issuer ist
`https://auth.kassel.smartspeechflow.de/realms/ssf`; der Studio-Service-Token-Issuer
verwendet dagegen den Realm `sva-studio`. Browser-Konfiguration im SSF-Frontend kann
im Image gebunden sein und muss separat geprüft werden. Ohne diese Prüfung keine Umschaltung.

## Reihenfolge, Nachweise und Rückweg

1. PR-HEAD mit gezielten Tests, Pflicht-Gates und GitHub-Checks prüfen und exakt diesen
   Stand mergen. Das daraus gebaute OCI-Image samt Revision über seinen Digest verifizieren.
2. DNS, TLS-Verfahren, SSF-Verbraucher und die vollständigen Konfigurationsänderungen prüfen.
3. Geschützte Sicherungen von Compose, Runtime-Env, betroffenen Keycloak-Objekten und
   Registry-Zeilen erstellen. Aktuellen Image-Digest und laufende Containerkonfiguration sichern.
4. Die zusammenhängende Host-/Issuer-Umschaltung und Registry-Korrektur durchführen;
   Studio mit dem verifizierten unveränderlichen Image starten.
5. Frischen Root-Login und echte Instanzverwaltung sowie globale SSF-Konfiguration prüfen.
   Tenant-Auflösung, getrennte Berechtigungen, Callback und Logout auf beiden Hosts prüfen.
6. Aus dem SSF-API-Container den unveränderten internen Plugin-Pfad aufrufen:
   gültiges Service-Token, `X-Studio-Tenant-Id: tenant-kassel` und ein gültiger
   `X-Correlation-Id` ergeben 200;
   ohne Token 401. Öffentlich bleibt `/internal/plugins/ssf/v1/runtime-configuration`
   auf beiden Studio-Hosts durch den Ingress gesperrt.
7. Bei Fehlern betroffene Registry-Zeilen, Keycloak-Objekte, Env und Compose aus den
   Sicherungen wiederherstellen und den vorherigen Digest starten. Keine Datenbank
   neu anlegen oder Volumes löschen. Alte Host-/Issuer-Routen müssen für den Rückweg
   erreichbar bleiben; alte Sessions erfordern gegebenenfalls einen frischen Login.

Der vor der Umschaltung am 9. September 2026 live verifizierte Studio-Rückweg ist
`ghcr.io/smart-village-solutions/sva-studio@sha256:6de47254ded734dc848798b3ab7aa13494aebef673be952c7eded1316ceb0f06`,
OCI-Revision `4985a80e4296af4ab2051d0aa927b901fdfb08bd` (PR #1295).
Dieser historische Wert muss unmittelbar vor einem tatsächlichen Rollout erneut geprüft werden.
