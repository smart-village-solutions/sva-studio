# Host-Zuordnung der eigenständigen Studio-/SSF-Installation

## Geltungsbereich und Zielbild

Diese einmalige Erstinstallation auf `root@136.243.39.147` unter
`/root/projects/sva-studio-ssf` ist unabhängig vom regulären Studio-Prod-Server.
Der [reguläre Studio-Rollout](../guides/studio-rollout-process.md) bleibt unverändert.
Die folgenden Werte beschreiben die geplante Umschaltung, keinen bereits erfolgten Rollout.

| Host                         | Dienst und Kontext                                                       |
| ---------------------------- | ------------------------------------------------------------------------ |
| `dialog.kassel.de`           | SSF-Einstieg, kein Studio-Root                                           |
| `studio.dialog.kassel.de`    | Studio-Root, Instanzverwaltung und globale SSF-Konfiguration             |
| `smartcity.dialog.kassel.de` | Studio-Tenant mit unveränderter ID `tenant-kassel`                       |
| `auth.dialog.kassel.de`      | gemeinsamer lokaler Keycloak; Studio-Realm `sva-studio`, SSF-Realm `ssf` |

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

Die Auth-Middleware weist Hosts außerhalb des konfigurierten Studio-Roots und gültiger Tenant-Hosts vor der Sitzungsauswertung zurück, auch wenn noch eine Sitzung vom früheren Root vorhanden ist.

Ohne `SVA_STUDIO_ROOT_HOST` gilt weiterhin `SVA_PARENT_DOMAIN` als Root. Die optionale Variable wird auch in den Compose-Profilen und im Remote-Konfigurationsvertrag weitergereicht. Der konfigurierte Root-Host sowie `studio` und `auth` sind in HTTP-, Worker- und Operator-CLI-Aufrufen für Tenant-Anlage und Host-Änderungen gesperrt; entsprechende statische Allowlist-Einträge führen zu einem Konfigurationsfehler.
Der interne Keycloak-Admin-Zugriff bleibt auf dem lokalen Docker-Netz.
Datenbank-, Redis-, OIDC- und Verschlüsselungsgeheimnisse werden unverändert übernommen.
Keine Passwörter zurücksetzen und keine zusätzlichen Tenant-Rollen vergeben.

### Eigenständiger Provisioning-Worker

Die Kasseler Installation benötigt neben dem App-Container zwingend einen eigenen
Keycloak-Provisioner. Der Worker gehört zu dieser Installation und darf nicht durch einen
Worker des regulären Studio-Stacks ersetzt werden: Er muss dieselbe Kasseler Datenbank,
Redis-Instanz und den lokalen Keycloak verwenden.

Der verbindliche Compose-Zusatz und sein fail-closed Startskript liegen unter
[`deploy/standalone/keycloak-provisioner.compose.yml`](../../deploy/standalone/keycloak-provisioner.compose.yml).
Vor dem Start wird `SVA_IMAGE_REF` auf denselben unveränderlichen Image-Digest gesetzt, den
auch der Kasseler App-Container verwendet. Die `runtime.env` muss im Compose-Projektordner
liegen und insbesondere die bestehenden `APP_DB_*`-, `POSTGRES_*`-, `REDIS_*`- und
`KEYCLOAK_PROVISIONER_*`-Werte der Kasseler Installation enthalten.

Bei einem Wechsel des Queue-Vertrags müssen App und Worker koordiniert aktualisiert werden:
Zuerst die App stoppen, damit sie keine neuen Aufträge annimmt. Den bisherigen Worker alle
bereits geplanten oder laufenden Aufträge abschließen lassen und diesen Zustand über die
Registry prüfen. Danach den Worker stoppen und beide Dienste gemeinsam mit demselben neuen
Digest starten. So verarbeitet weder ein alter Worker neue Aufträge noch ein neuer Worker
Aufträge im alten Format.

```bash
docker compose \
  -f app.compose.yml \
  -f keycloak-provisioner.compose.yml \
  stop app
# Registry prüfen: keine Provisioning-Läufe mit Status planned oder running.
docker compose \
  -f app.compose.yml \
  -f keycloak-provisioner.compose.yml \
  stop provisioner
./up.sh
docker compose \
  -f app.compose.yml \
  -f keycloak-provisioner.compose.yml \
  ps app provisioner
```

Overlay und `up.sh` werden dazu aus dem exakt freigegebenen Release-Stand in den eigenständigen
Compose-Projektordner übernommen. Das Startskript akzeptiert ausschließlich eine vollständige
Image-Referenz aus `ghcr.io/smart-village-solutions/sva-studio` mit `@sha256:` und bindet App
und Worker an exakt denselben Digest.
Ein Provisioning-Auftrag darf erst erneut eingereiht werden,
wenn `provisioner` läuft; bereits wartende Aufträge werden vom Worker selbst übernommen.

Studio speichert den validierten Plugin-OIDC-Vertrag im Provisioning-Auftrag. Der Worker verwendet
genau diesen Snapshot für Keycloak-Abgleich und Status-Fingerprint. Unversionierte oder
unvollständige Aufträge werden abgewiesen und deshalb vor dem Versionswechsel mit dem bisherigen
Worker geleert. So bleibt ein Worker-Lauf auch bei getrennten App- und Worker-Prozessen auswertbar.
Erfolgsnachweis sind ein abgeschlossener Lauf mit Request-ID und anschließend der Live-Abgleich
der Realm-, Client- und Tenant-Admin-Struktur. Der Worker veröffentlicht keine Ports und erhält
keine Traefik-Router.

Der bestehende Docker-Provider-Router enthält derzeit die expliziten
Bestandshosts. Neue Tenant-Hosts werden nach dem koordinierten Enablement nicht
mehr durch manuelles Umschreiben dieser Regel ergänzt, sondern durch einen
höher priorisierten Router aus dem File Provider:

```text
(Host(`studio.dialog.kassel.de`) || Host(`smartcity.dialog.kassel.de`)) && !PathPrefix(`/internal/`)
```

Der Kassel-Overlay
[`deploy/standalone/kassel-ingress.compose.yml`](../../deploy/standalone/kassel-ingress.compose.yml)
aktiviert den Modus `kassel-traefik-file` für App und Provisioner. Nur der
Provisioner mountet das dynamische Verzeichnis mit Schreibrecht. Der zugehörige
Traefik aus dem SSF-Repository mountet dasselbe Verzeichnis read-only. Der
providerqualifizierte Zielservice `sva-studio-ssf@docker` wurde gegen die
laufende Kasseler Containerkonfiguration geprüft.

Ein neuer Create-Lauf bleibt nach dem Schließen der Browserseite bestehen. Der
Worker verarbeitet Registry, Keycloak-Kindlauf, Plugin-Lifecycle, Router, TLS,
Modul-Readiness und öffentlichen Login-Redirect. Erst danach setzt er Instanz
und Lauf auf `active`. Retry-fähige Fehler erhalten `next_attempt_at`; eine
abgelaufene Lease wird erneut beansprucht. Snapshot-Drift, terminal blockierte
Readiness oder Ablauf der Deadline führen zu `failed`, ohne vorhandene
Registry-, Keycloak-, Secret- oder Router-Artefakte zu löschen.

Vor einem Queue-Vertragswechsel müssen alle alten `legacy`-Läufe geleert oder
bewusst als historische Evidenz belassen werden. Nur Create-Läufe mit
`snapshot_version = '2.0'` werden automatisiert beansprucht. Für Diagnose sind
Elternlauf-ID, `child_keycloak_run_id`, `step_key`, Lease, Attempts, Deadline,
Fehlercode und `terminal_evidence` gemeinsam auszuwerten. Ein Retry darf nur
denselben unveränderten Soll-Snapshot fortsetzen.

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

## Login-Baseline und Veröffentlichung (#1319)

Die App erhält zusätzlich `SVA_STUDIO_SSF_LOGIN_ORIGIN=https://dialog.kassel.de`.
Der Host leitet daraus ausschließlich `ssf-frontend`, die Web-Origin
`https://dialog.kassel.de` und den Redirect `https://dialog.kassel.de/login/*` ab.
Ohne explizite Konfiguration bleibt die SSF-Login-Freigabe gesperrt. Der
Ressourcenclient `ssf` bleibt getrennt und deaktiviert; Studio-Clients und
Secrets werden nicht für den Browserclient wiederverwendet.

Vor neuen Aufträgen mit Browservertrag 2.0 müssen App und separater Provisioner
auf demselben kompatiblen Stand laufen. Der koordinierte Queue-Drain aus dem
Worker-Abschnitt gilt weiterhin. Der Worker liest die bereits validierte
Konfiguration aus dem Auftrag und benötigt keine eigene Origin-Ableitung.

Der neue erforderliche Lifecycle-Check `ssf.loginReady` ändert die
Lifecycle-Vertragsrevision. Der bestehende Fleet-Reconcile übernimmt damit
auch Bestandsmandanten. Er provisioniert die Clients und `ssf.tenants`, stellt
die benutzerbezogene IAM-Projektion her und bestätigt erst danach die gemeinsame
Readiness. Manuelle Hardcoded-Mapper für dieselben Browserclaims werden durch
die deklarative Benutzerprojektion ersetzt; andere Client-Mapper bleiben erhalten.

Der kanonische [Rollout-Prozess](../guides/studio-rollout-process.md) bleibt
maßgeblich. Die Freigabe benötigt einen echten Zwei-Realm-Nachweis:
Directory-Auswahl → Keycloak-Login → SSF-Callback → Gateway-Akzeptanz, mit aktueller
Tenant-/Audience-/Rollenbindung und derselben Authorization-Revision wie die
Runtime-Antwort. Ein grüner lokaler Vertragstest ersetzt diesen Nachweis nicht.
