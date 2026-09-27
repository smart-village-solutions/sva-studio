# Host-Zuordnung der eigenständigen Studio-/SSF-Installation

## Geltungsbereich und Zielbild

Diese eigenständige Installation auf `root@136.243.39.147` unter
`/root/projects/sva-studio-ssf` ist unabhängig vom regulären Studio-Prod-Server.
Der [reguläre Studio-Rollout](../guides/studio-rollout-process.md) bleibt unverändert.
Kassel betreibt genau eine Studio-Instanz ohne separate Staging-Instanz. Die
folgenden Hostwerte stammen aus der ursprünglichen Umschaltplanung; vor einem
weiteren Release ist der tatsächliche Live-Zustand erneut zu prüfen.

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

### Eigenständiger Provisioner

Die Kasseler Installation benötigt neben dem App-Container zwingend einen eigenen
Keycloak-Provisioner. Er verarbeitet Hintergrundaufträge und stellt zugleich den internen,
ausschließlich über `http://provisioner:3000` erreichbaren Create-/Readiness-Endpunkt bereit;
seine eigene Runtime bearbeitet diese Requests lokal und leitet sie nicht erneut weiter.
Er darf nicht durch einen Worker des regulären Studio-Stacks ersetzt werden: Er muss dieselbe
Kasseler Datenbank, Redis-Instanz und den lokalen Keycloak verwenden.
Der SSF-Worker lädt beim Start denselben Plugin-IAM-, Lifecycle- und OIDC-Vertrag wie die
App; ohne diesen Prozess-Snapshot können explizit zugewiesene SSF-Instanzen nicht
provisioniert werden.

Der verbindliche Compose-Zusatz und sein fail-closed Startskript liegen unter
[`deploy/standalone/keycloak-provisioner.compose.yml`](../../deploy/standalone/keycloak-provisioner.compose.yml).
Vor dem Start wird `SVA_IMAGE_REF` auf einen unveränderlichen Digest aus
`ghcr.io/smart-village-solutions/sva-studio-ssf` gesetzt; App und Provisioner verwenden
denselben SSF-Digest. Die `runtime.env` muss im Compose-Projektordner
liegen und insbesondere die bestehenden `APP_DB_*`-, `POSTGRES_*`-, `REDIS_*`- und
`KEYCLOAK_PROVISIONER_*`-Werte der Kasseler Installation enthalten.

Bei einem Wechsel des Queue-Vertrags müssen App und Worker koordiniert aktualisiert werden:
Zuerst die App stoppen, damit sie keine neuen Aufträge annimmt. Den bisherigen Worker alle
bereits geplanten oder laufenden Aufträge abschließen lassen und diesen Zustand über die
Registry prüfen. Auch `requested`, `validated` und `provisioning` im Elternlauf sowie
`planned` und `running` im Keycloak-Kindlauf sind nach Snapshot-Version und
Verarbeitbarkeit zu unterscheiden. Historische `legacy`-Läufe dürfen nicht als
abgearbeitete Aufträge ausgegeben oder für den Release gelöscht werden; sie sind
gesondert zu dokumentieren. Danach den Worker stoppen und beide Dienste gemeinsam
mit demselben neuen Digest starten. So verarbeitet weder ein alter Worker neue
Aufträge noch ein neuer Worker Aufträge im alten Format.

```bash
docker compose \
  -f app.compose.yml \
  -f keycloak-provisioner.compose.yml \
  stop app
# Registry prüfen: keine noch verarbeitbaren, nichtterminalen Läufe;
# historische legacy-Läufe gesondert klassifizieren.
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
Compose-Projektordner übernommen. Der aktuelle Repo-Stand des Startskripts akzeptiert
vollständige unveränderliche Referenzen aus `ghcr.io/smart-village-solutions/sva-studio`
und `ghcr.io/smart-village-solutions/sva-studio-ssf` mit `@sha256:`. Der am 27. September 2026 auf Kassel vorgefundene ältere `up.sh` akzeptierte dagegen
nur das Standard-Repository. Vor dem SSF-Distributionswechsel muss daher die
freigegebene Skriptversion am Ziel verifiziert werden; `SVA_IMAGE_REF` muss den
geprüften SSF-Digest bezeichnen und App und Worker an genau diesen Digest binden.
Vor dem Start führt das Skript den einmaligen Dienst `migrate`
mit demselben Digest aus. Ein fehlgeschlagener IAM- oder SSF-Plugin-Migrationsschritt beendet
`up.sh`, bevor App und Provisioner aktualisiert werden.
Ein Provisioning-Auftrag darf erst erneut eingereiht werden,
wenn `provisioner` läuft; bereits wartende Aufträge werden vom Provisioner selbst übernommen.

Studio speichert den validierten Plugin-OIDC-Vertrag im Provisioning-Auftrag. Der Worker verwendet
genau diesen Snapshot für Keycloak-Abgleich und Status-Fingerprint. Unversionierte oder
unvollständige Aufträge werden abgewiesen und deshalb vor dem Versionswechsel mit dem bisherigen
Worker geleert. So bleibt ein Worker-Lauf auch bei getrennten App- und Worker-Prozessen auswertbar.
Erfolgsnachweis sind ein abgeschlossener Lauf mit Request-ID und anschließend der Live-Abgleich
der Realm-, Client- und Tenant-Admin-Struktur. Der Provisioner veröffentlicht keine Ports und erhält
keine Traefik-Router.

### SSF-Distributionswechsel und Freigabe (#1408)

Ein grüner Build des SSF-Images oder ein Rollout im regulären Studio-Swarm ist
kein Kasseler Staging-Nachweis. Vor jeder Mutation am einzigen Kasseler Ziel
müssen Release-Commit, verifizierter SSF-Image-Digest, OCI-Revision und
Distribution zusammenpassen. Das Image-Verify muss die positiven und negativen
Artefakt-Inventare sowie einen authentifizierten SSF-/Media-Modul-Smoke bestehen.
Die Release-Freigabe bewertet ausdrücklich das Restrisiko ohne unabhängiges
Kasseler Staging.

Unmittelbar vor dem Cutover sind Live-Digest, laufende Compose-Konfiguration,
betroffene Dienste und alle noch verarbeitbaren Provisionierungsaufträge erneut
lesend zu erfassen. Am 27. September 2026 liefen App und Provisioner noch mit
demselben Standard-Studio-Digest; die Studio-Datenbank meldete Goose-Version 97,
die getrennte SSF-Plugin-Datenbank Version 6. Der freigegebene Repo-Stand enthält
für Studio zusätzlich die Migrationen 98 und 99. Diese Momentaufnahme ersetzt
weder die erneute Prüfung noch eine Kompatibilitätsentscheidung: Migrationen
werden nicht automatisch zurückgerollt.

Nach dem oben beschriebenen Stop/Drain und vor dem Migrationsdienst müssen
aktuelle, geschützte Sicherungen der Datenbanken `sva_studio`, `sva_studio_ssf`
und `keycloak`, des persistenten Redis-Zustands, des dynamischen Traefik-Verzeichnisses
sowie der tatsächlich verwendeten Compose-/Runtime-Konfiguration vorliegen.
Sicherungsergebnisse sind über SHA-256, Archivlesbarkeit und einen isolierten
Test-Restore mit lesenden Struktur- und Bestandsprüfungen zu verifizieren. Für
die anschließende Anlage eines Test-Tenants sind auch die betroffene SSF-Backend-Datenbank
`ssf` und der Zertifikatszustand in den Rückweg einzubeziehen. Zugangsdaten und
Dump-Inhalte gehören nicht in CI-Artefakte oder Issue-Kommentare.

Der vor dem Cutover erfasste Standard-Digest ist nur ein zeitlich begrenzter
App-Rückweg: Die Migrationen 98/99 ergänzen eine Tabelle und ändern deren Policy,
und der bisherige Schema-Guard akzeptiert einen neueren Goose-Stand. Der bisherige
Worker beansprucht jedoch nur Create-Snapshots der Version `2.0`, während der
neue Stand auch `3.0` erzeugen kann. Sobald ein neuer `3.0`-Lauf oder andere
neue Schreibvorgänge begonnen haben, darf der alte Digest nicht als pauschal
sicherer Rollback gelten. Dann sind zuerst Aufträge und Datenänderungen zu
bewerten und ein kontrollierter Vorwärtsfix oder ein ausdrücklich entschiedener
Restore mit Verlustbewertung erforderlich. Keine automatische Down-Migration,
kein Löschen von Legacy-Läufen oder Volumes.

Go erst nach verifiziertem Image, freigegebenem Skript, geleertem verarbeitbarem
Auftragsbestand, aktuellem Test-Restore und dokumentiertem Rückweg. Andernfalls
bleiben App und Provisioner auf dem bisherigen Digest; `tenant-kassel` wird nicht
für den Test verändert. Nach dem Update müssen Live/Ready, identischer Digest
beider Dienste, authentifizierte SSF-/Media-Funktionen und die für [#1325](https://github.com/smart-village-solutions/sva-studio/issues/1325)
erforderliche Tenant-/IAM-Readiness am Kasseler Ziel nachgewiesen werden.

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
Vor dem Workerstart initialisiert der einmalige Compose-Dienst `ingress-dir-init`
den Hostpfad mit UID/GID 1000 und Modus `0750`; damit kann der als `node`
laufende Provisioner auch auf einer frischen Installation atomar schreiben.

Ein neuer Create-Lauf bleibt nach dem Schließen der Browserseite bestehen. Der
Worker verarbeitet Registry, Keycloak-Kindlauf, Plugin-Lifecycle, Router, TLS,
Modul-Readiness und öffentlichen Login-Redirect. Erst danach setzt er Instanz
und Lauf auf `active`. Retry-fähige Fehler erhalten `next_attempt_at`; eine
abgelaufene Lease wird erneut beansprucht. Snapshot-Drift, terminal blockierte
Readiness oder Ablauf der Deadline führen zu `failed`, ohne vorhandene
Registry-, Keycloak-, Secret- oder Router-Artefakte zu löschen.

Der Elternlauf enthält außerdem `pluginSnapshotVersion`, die vollständigen
Lifecycle-Verträge der effektiv aktiven Plugins und deren OIDC-Anforderungen.
Der eigenständige Provisioner bewertet ausschließlich diesen Snapshot. Eine
fehlende oder leere Composition endet mit
`provisioning_plugin_snapshot_missing`; fehlt eine erwartete effektive
Aktivierung, endet der Lauf mit `provisioning_plugin_activation_missing`. Ein
Retry mit vorhandenen OIDC-Verträgen bleibt ebenfalls geschlossen, wenn der
aktuelle Prozess keine OIDC-Vertragsquelle geladen hat oder eine bisherige
Client-ID nicht mehr deklariert. Das Entfernen solcher Clients erfordert einen
eigenen Retirement-Pfad.

Vor einem Queue-Vertragswechsel müssen alle alten `legacy`-Läufe geleert oder
bewusst als historische Evidenz belassen werden. Nur Create-Läufe mit
`snapshot_version = '2.0'` werden automatisiert beansprucht. Für Diagnose sind
Elternlauf-ID, `child_keycloak_run_id`, `step_key`, Lease, Attempts, Deadline,
Fehlercode und `terminal_evidence` gemeinsam auszuwerten. Ein Retry behält den
tenantbezogenen Sollzustand unverändert bei. Damit ein fehlgeschlagener Lauf
nach einem Release nicht dauerhaft auf einer veralteten technischen
Plugin-Revision wartet, bindet die Retry-Transaktion die Lifecycle- und
OIDC-Verträge der unveränderten Modulzuweisungen an den aktuell geladenen
Plugin-Snapshot und persistiert diese Revision atomar mit der Wiederaufnahme
des Elternlaufs. Geänderte OIDC-Verträge setzen den Elternlauf auf die
Registry-Stufe zurück und verwerfen seine bisherige Keycloak-Kindlauf-Referenz,
nachdem der neue Kindlauf persistiert wurde. Bis dahin bleibt eine vorhandene
Kindlauf-ID ausschließlich als Evidenz eines bereits vollzogenen
`new → existing`-Realm-Übergangs erhalten. Kann ein
Lifecycle-Intent wegen eines aktiven Jobs nicht vollständig persistiert werden,
bleibt der Elternlauf `failed`. Er wird in der
Instanz-Detailansicht über „Mandanten-Provisionierung erneut starten“ oder per
`POST /api/v1/iam/instances/:instanceId/provisioning/retry` mit Berechtigung
`instance.create` und einem frischen `Idempotency-Key` ausgelöst. Der
ursprüngliche Create-Key wird dabei serverseitig aus dem Elternlauf gelesen.
Der Retry persistiert vor der Antwort einen neuen Lifecycle-Reconcile-Intent
und setzt Fehler ab Modul-Readiness auf die Lifecycle-Stufe zurück.

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

### Separate SSF-Plugin-Datenbank und Benutzerfreigabe

Die Studio-SSF-Plugin-Datenbank ist von der Studio-IAM-Datenbank und der Datenbank
des eigenständigen SSF-Backends zu unterscheiden. Das tatsächliche Ziel wird aus
`SVA_STUDIO_SSF_DATABASE_URL` und `SVA_STUDIO_SSF_ROOT_DATABASE_URL` ermittelt,
ohne die Zugangsdaten auszugeben. In der Kasseler Installation liegt sie als
`sva_studio_ssf` am Studio-Postgres; die Backend-Datenbank `ssf` ist hierfür nicht
das Migrationsziel.

Ein Imagewechsel ersetzt den separaten Migrationsschritt nicht. `deploy/standalone/up.sh`
startet deshalb vor App und Provisioner den Dienst `migrate`. Dieser verwendet den
Goose-Ledger `public.goose_db_version`, das Verzeichnis
`packages/plugin-ssf/migrations` und den Migrator des freigegebenen Images. Die
bereits in `runtime.env` vorhandenen Runtime- und Root-Verbindungs-URLs liefern
die rollenbezogenen Kennwörter, ohne sie in eine zweite Konfiguration zu kopieren;
Benutzer und Datenbankname müssen zum erwarteten Ziel passen. Explizite
`SSF_PLUGIN_*_DB_PASSWORD`-Werte bleiben für andere Laufzeitprofile zulässig.
Ist zugleich eine Runtime-URL gesetzt, wird sie immer vollständig validiert und
ihr Kennwort ist für den verwendeten Runtime-Pool und die Migration autoritativ;
der separate Kennwortwert dient ausschließlich als Fallback ohne URL.
Bei der Wiederverwendung einer URL müssen zusätzlich Host und effektiver Port
mit `POSTGRES_HOST` und `POSTGRES_PORT` übereinstimmen, damit Migration,
Passwortrotation und Anwendung dasselbe PostgreSQL-Ziel verwenden.
URL-Queryparameter dürfen Host, Port, Benutzer, Kennwort, Datenbank oder einen
alternativen Verbindungsservice nicht überschreiben.
Runtime- und Root-Login müssen verschieden sein und dürfen weder dem
`POSTGRES_USER` noch den festen Gruppenrollen `ssf_plugin_tenant_runtime` und
`ssf_plugin_root` entsprechen. Der eingebaute PostgreSQL-Admin `postgres` ist
auch dann gesperrt, wenn `POSTGRES_USER` einen anderen Wert verwendet; der
Migrator prüft dies vor jedem Rollen-Write.
Existiert ein konfigurierter Login bereits, muss er schon Mitglied seiner
erwarteten SSF-Gruppenrolle sein. Andernfalls behandelt der Migrator ihn als
fremden Principal und bricht vor Passwort-, Attribut- oder Grant-Änderungen ab.
Auch ein bereits vorhandenes `NOLOGIN`-Rollenobjekt wird nicht in einen Login
umgewandelt, selbst wenn es Mitglied der erwarteten SSF-Rolle ist.
Bestehende Principals dürfen neben ihrer jeweils erwarteten SSF-Gruppenrolle
keine weitere direkte oder indirekte Rollenmitgliedschaft besitzen. Prüfung,
Kennwortrotation, Attributhärtung und Grants beider Principals laufen gemeinsam
in einer Transaktion; ein Fehler lässt daher auch das andere Kennwort unverändert.
Ein Runtime-Login mit effektivem Zugriff auf `ssf_plugin_root` und ein Root-Login
mit effektivem Zugriff auf `ssf_plugin_tenant_runtime` werden ebenfalls
abgewiesen; `NOINHERIT` verhindert den Zugriff über `SET ROLE` nicht.
Der Reconcile setzt beide Logins außerdem explizit auf `NOREPLICATION` und
`NOBYPASSRLS`.
`SSF_PLUGIN_DATABASE_NAME` muss außerdem von `POSTGRES_DB` verschieden sein und
darf weder `postgres` noch `template0` oder `template1` bezeichnen; diese Prüfung
erfolgt vor dem ersten Datenbankzugriff des SSF-Migrators.
Ein Fehler stoppt den Startpfad geschlossen.
Der reguläre Studio-Rollout bleibt im [Rollout-Prozess](../guides/studio-rollout-process.md)
beschrieben; eine zusätzliche Migrationsplattform ist dafür nicht erforderlich.

Migration `0006_ssf_authorization_subject_evidence.sql` ergänzt die generierte
Spalte `confirmed_has_subjects` und deren Spaltenleserecht für
`ssf_plugin_tenant_runtime`. Die Abnahme prüft Ledger, generierte Spalte und
den Tenant-Lesezugriff mit dem tatsächlich von Studio verwendeten `pg`-Treiber.
Die Login-Rolle `sva_ssf_runtime` verwendet `NOINHERIT` und aktiviert die
Funktionsrolle über die Verbindungsoption. Fehlende direkte Rechte der Login-Rolle
sind deshalb allein kein Fehlernachweis. Eine URL mit kodierter Rollenoption ist
für eine `psql`-Diagnose nicht ungeprüft wiederzuverwenden.

Die Organisationsauswahl verlangt zusätzlich mindestens einen aktiven,
SSF-berechtigten Benutzer in der bestätigten Autorisierungsprojektion. Eine
Migration erzeugt oder aktiviert keine Benutzer. Für Bestandskonten erfolgt die
Freigabe im zugehörigen Studio-Tenant über **Benutzer → Verwaltung → Status → Aktiv →
Speichern** oder den regulären IAM-Update-Endpunkt. Die Keycloak-basierte
Listenanzeige „Aktiv“ ersetzt nicht den Nachweis von `iam.accounts.status = 'active'`.
Die [Bootstrap-Regeln](./instance-keycloak-provisioning.md#rollen--und-rechte-modell)
beschreiben die automatische Aktivierung ausschließlich neu angelegter
Bootstrap-Administratoren.

Nach der Freigabe sind der Abschluss des SSF-Autorisierungsabgleichs, identische
Soll-/Ist-Revisionen, `confirmed_has_subjects = true`, die Veröffentlichung im
Directory und ein erfolgreicher Browser-Login gemeinsam nachzuweisen. Eine leere
Projektion bleibt auch nach Migration `0006` unveröffentlicht. Historische Konten
anderer Realms werden für diesen Nachweis nicht automatisch übernommen.

Bei einer neuen Kasseler Instanz führt der persistente Elternlauf vor der
Aktivierung außerdem den tenantlokalen Rollenabgleich und die Rechteprobe aus.
`active` ist deshalb erst zulässig, wenn `system_admin` synchronisiert ist und
der Tenant-Admin-Client den erforderlichen IAM-Zugriff erfolgreich bestätigt
hat. Diese beiden Postflight-Schritte verwenden denselben Retry- und
Deadline-Vertrag wie die übrigen Provisionierungsstufen; ein manueller
MCP- oder Doctor-Aufruf gehört nicht zum erfolgreichen Create-Pfad.

### Keycloak-Benutzerprofil für die SSF-Projektion

Vor der Projektion müssen im jeweiligen Tenant-Realm diese verwalteten
Benutzerattribute vorhanden sein:

| Attribut                     | Mehrwertig | Lesen / Schreiben      |
| ---------------------------- | ---------- | ---------------------- |
| `studio_tenant_id`           | nein       | ausschließlich `admin` |
| `ssf_roles`                  | ja         | ausschließlich `admin` |
| `ssf_permissions`            | ja         | ausschließlich `admin` |
| `ssf_authorization_revision` | nein       | ausschließlich `admin` |

Bei deaktivierten unverwalteten Attributen kann Keycloak Benutzer-Updates
annehmen, ohne die nicht deklarierten SSF-Attribute zu speichern. Der
Autorisierungsabgleich endet dann mit `target_readback_mismatch`.
Der SSF-Autorisierungsabgleich liest deshalb das Profil über
`GET /admin/realms/{realm}/users/profile`, ergänzt oder korrigiert ausschließlich
die vier verwalteten Attribute über den entsprechenden `PUT` und bestätigt sie
anschließend durch erneutes Lesen. Der Read-back bestätigt auch den semantischen
Erhalt bestehender Attribute, Gruppen und der übrigen Profilkonfiguration; von
Keycloak ergänzte Felder und reine Reihenfolgenänderungen sind zulässig. Der
Abgleich aktiviert keine allgemeine
Freigabe unverwalteter Attribute und erlaubt Endbenutzern keine Bearbeitung
dieser Berechtigungsfelder. Jeder spätere Projektions-Read-back prüft den
admin-only Zustand erneut. Eine nicht bestätigte Profiländerung oder späterer
Drift blockiert die Projektion. Siehe
[Keycloak-Benutzerprofile](https://www.keycloak.org/docs/latest/server_admin/#_user-profile).
Unmittelbar vor dem vollständigen Profil-PUT liest der Abgleich das Profil
erneut. Eine zwischenzeitliche semantische Änderung an fremden Attributen,
Gruppen oder Profilfeldern stoppt den Write als konkurrierende Änderung.
Verliert Keycloak trotz erfolgreichem PUT fremde Profilkonfiguration, bleibt die
Projektionsgeneration mit `target_integrity_failed` und terminaler Retry-Klasse
gesperrt. Nach der manuellen Profilreparatur ist ein expliziter Lifecycle-Abgleich
erforderlich; automatische Wiederholungen dürfen den beschädigten Zustand nicht
als bereit veröffentlichen.

Falls nach einer Benutzeraktivierung kein Abgleich läuft, kann eine authentifizierte
Root-Administratorsitzung auf dem Studio-Root den vorhandenen Endpunkt
`POST /api/v1/iam/instances/{instanceId}/plugin-readiness` mit
`{"pluginId":"ssf","operation":"reconcile"}` aufrufen. Der Aufruf benötigt
den normalen CSRF-Schutz (`X-Requested-With: XMLHttpRequest` und vertrauenswürdige
Origin). `202` bestätigt nur die Annahme; maßgeblich sind der abgeschlossene
Job und die anschließende Veröffentlichung. Technische Clients benötigen den
expliziten Scope `instance.pluginLifecycle.reconcile`.

Der öffentliche SSF-Directory-Aufruf verwendet die API-Basis aus dem tatsächlich
ausgelieferten Frontend. Am 14. September 2026 war dies
`https://ssf.smart-village.solutions/api/login/tenants`; derselbe Pfad auf dem
Frontend-Host lieferte HTML und war kein Directory-Nachweis.

### Browser- und Lifecycle-Vertrag

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
Dieser credentialgebundene Lauf ist ein Release- und Kassel-Enablement-Gate,
kein Schritt jeder Mandantenerstellung. Der Create-Lauf endet nach seinen
maschinenprüfbaren Postconditions terminal; der Provisioner erhält weder
Acceptance-Passwörter noch einen Benutzer-Credential-Lifecycle.
