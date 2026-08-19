# Kanonischer Studio-Rollout für Dev, Staging und Production

Status: **verbindlicher Betriebsvertrag**

Dieses Dokument ist die einzige normative Bedienanleitung für reguläre Studio-Rollouts. Technische Wahrheit sind die Workflows [Build](../../.github/workflows/build.yml) und [Promote](../../.github/workflows/promote.yml). Andere Runbooks dürfen Diagnose, Recovery oder Infrastrukturaufbau beschreiben, aber keinen konkurrierenden Deploymentpfad definieren.

## Unveränderliche Grundregeln

- Ein App-Image wird genau einmal gebaut und anschließend über seinen SHA-256-Digest durch die Umgebungen befördert.
- Ausschließlich `.github/workflows/build.yml` darf das reguläre Studio-App-Image veröffentlichen; frühere Image-Build-/Release-Preparation-Workflows sind entfernt.
- Dev folgt automatisch auf einen erfolgreichen Push nach `main`.
- Staging wird vor Production mit demselben Digest vollständig verifiziert.
- Production wird ausschließlich manuell über das geschützte GitHub-Environment `prod` freigegeben.
- `auto` ist ausschließlich in Dev zulässig. Staging und Production verwenden `assert-none` oder `run`.
- Vor jedem Deployment nach Staging oder Production muss ein erfolgreich verifiziertes PostgreSQL-Backup vorliegen. Sobald `WASTE_POSTGRES_BACKUP_ENABLED=true` gesetzt ist, gilt dieses Gate getrennt für `sva_studio` und das vollständige Registry-Inventar aller `ready`- oder `disabled`-Waste-Tenant-Datenbanken.
- Backup, Migration, Bootstrap, Postconditions und Verifikation sind fail-closed: Ein Fehler blockiert alle nachfolgenden mutierenden Phasen.
- Secrets kommen ausschließlich aus dem jeweiligen GitHub-Environment. Sie werden weder in Workflow-Inputs noch in Logs, Reports oder Dokumentation geschrieben.
- `REDIS_SNAPSHOT_HMAC_SECRET` liegt je Umgebung als eigenständiges GitHub-Environment-Secret vor, wird vor jeder Mutation auf Mindeststärke geprüft und ausschließlich beim Stack-Render an die App übergeben. Es ist nicht Bestandteil von `APP_CONFIG` und darf nicht zwischen Dev, Staging und Production wiederverwendet werden.
- `STUDIO_JOB_WORKER_DB_PASSWORD` liegt in jedem GitHub Environment (`dev`, `staging`, `prod`) als eigenständiges Environment-Secret vor. Der Promote-Workflow fügt es der temporären Rollout-Konfiguration hinzu; das bestehende Secret `APP_CONFIG` bleibt unverändert. Der Bootstrap verwendet den Wert für den dedizierten Principal `sva_job_worker`; App und Provisioner benötigen ihn ausschließlich für ihre jeweilige Worker-Lane. Er muss mindestens 32 Zeichen lang sein und darf nicht mit `APP_DB_PASSWORD` oder `POSTGRES_PASSWORD` identisch sein.
- Direkte Portainer-Änderungen, Docker-Service-Updates, rohe `quantum-cli stacks deploy/update`-Aufrufe und `env:release:studio:local` sind kein regulärer Rolloutpfad.

## Umgebungsvertrag

<!-- prettier-ignore -->
| Umgebung | Stack | Root-URL | Auslösung | Modi | Backup |
| --- | --- | --- | --- | --- | --- |
| Dev | `studio-dev` | `https://studio-dev.smart-village.app` | automatisch nach erfolgreichem Build auf `main` | `migration_mode=auto`, `bootstrap_mode=auto` | kein Promote-Backup |
| Staging | `studio-staging` | `https://studio-staging.smart-village.app` | manuell über `Promote`, geschützt durch das Environment `staging` | `assert-none` oder `run` | vor jedem Deployment verpflichtend |
| Production | `studio` | `https://studio.smart-village.app` | manuell über `Promote`, geschützt durch das Environment `prod` | `assert-none` oder `run` | vor jedem Deployment verpflichtend |

## Explizite Tenant-Hostfreigabe

Die Registry-Aktivierung allein veröffentlicht keinen Tenant. Bis zu einer separat freigegebenen Wildcard-TLS-Lösung müssen drei unabhängige Gates erfüllt sein:

1. Der vollständige Tenant-Host steht explizit in der Traefik-v1- und Traefik-v2+-Regel der Compose-Datei der Zielumgebung.
2. Die Änderung läuft mit dem regulären `Build`-/`Promote`-Pfad aus; der Tenant-Erstellungsprozess verändert Traefik nicht direkt.
3. Der Post-Deploy-Smoke weist HTTPS mit einem für den konkreten Host gültigen Einzelzertifikat sowie einen Login-Redirect mit demselben Rückkehr-Host nach.

Dev veröffentlicht zusätzlich `de-teststadt-dev.studio-dev.smart-village.app`, Staging zusätzlich `de-studio-sandbox.studio-staging.smart-village.app`. Die Production-Liste ist versioniert in `deploy/compose.prod.yaml`. Ergänzungen und Entfernungen an dieser Liste sind normale Konfigurationsänderungen und dürfen erst nach erfolgreichem Promote und Smoke in der Registry als extern betriebsbereit behandelt werden. Wildcard-DNS ist kein Freigabenachweis.

Die Backup-Endpunkte und Buckets sind fest an die Zielumgebung gebunden:

| Umgebung   | Endpoint                                                                  | Bucket                        |
| ---------- | ------------------------------------------------------------------------- | ----------------------------- |
| Staging    | `https://backup-studio-staging.smart-village.app/_ops/backup/v1/requests` | `studio-db-backup-staging`    |
| Production | `https://backup-studio.smart-village.app/_ops/backup/v1/requests`         | `studio-db-backup-production` |

Der zentrale Agent akzeptiert nur den engen, OIDC- und HMAC-gesicherten Vertrag `backup-and-verify`. Er stellt keine Remote-Shell bereit. Der S3-kompatible Speicher ist MinIO unter `https://fileserver.smart-village.app`; AWS CLI und S3 SDK dienen lediglich als kompatible Clients.

## Phase 1: Image bauen und Dev aktualisieren

Ein Push nach `main` startet [Build](../../.github/workflows/build.yml):

1. Finales Node-Runtime-Artefakt verifizieren.
2. Genau ein App-Image für `linux/amd64` bauen und nach GHCR pushen.
3. Imagevertrag und OCI-Revision binden.
4. `Promote` für `dev` mit dem vom Build ausgegebenen SHA-256-Digest und beiden Modi `auto` aufrufen.
5. Die OCI-Revision des tatsächlich live konfigurierten App-Images als effektive Deploy-Basis auflösen und Migration sowie Bootstrap anhand dieses vollständigen Diffs unabhängig bewerten. `github.event.before` bleibt nur die deklarierte Aufrufgrenze und darf eine ausgefallene Zwischen-Promotion nicht aus dem Risikobereich entfernen.
6. Erforderliche One-shot-Jobs vor dem App-Deploy ausführen.
7. Nur nach erfolgreichen Gates den Stack `studio-dev` aktualisieren.

Dev ist die schnelle Integrationsstufe. Der fehlende Datenbank-Backup-Schritt ist bewusst auf Dev begrenzt und darf nicht auf Staging oder Production übertragen werden.

## Phase 2: Denselben Digest nach Staging promoten

Der manuelle Workflow [Promote](../../.github/workflows/promote.yml) erhält:

- `environment=staging`
- den aus dem erfolgreichen Build stammenden Image-Ref beziehungsweise Digest
- `change_base` und `change_head` des tatsächlich im Image enthaltenen Änderungsbereichs
- je nach Diff `migration_mode` und `bootstrap_mode` als `assert-none` oder `run`

`assert-none` ist kein Skip: Sobald der Diff ein entsprechendes Risiko enthält, bricht das Gate ab. Dann muss der betreffende Modus bewusst auf `run` gesetzt werden.

Die Reihenfolge ist unveränderlich; nicht angeforderte One-shot-Jobs und deren Postconditions werden übersprungen:

1. Inputs, Git-Bindung, Image-Digest und OCI-Revision validieren.
2. Vorherigen Live-Digest und dessen OCI-Revision erfassen; nur diese Revision ist die effektive Basis der Diff-Gates.
3. Signierten Backup-Auftrag an den Staging-Agenten senden; bei aktiviertem Waste-Backup anschließend einen zweiten Auftrag mit `database: "waste"` ausführen. Der Agent entdeckt das vollständige Tenant-Inventar selbst und schreibt ein Manifest mit tenantgenauen Dump-Referenzen.
4. Terminales Ergebnis aus MinIO abwarten und das Dump-Objekt unabhängig per S3-`HEAD` verifizieren.
5. Migration ausführen, falls angefordert.
6. Bootstrap ausführen, falls angefordert.
7. Postconditions gegen Datenbank und aktuellen Runtime-Vertrag prüfen.
8. App-Stack `studio-staging` aktualisieren.
9. Swarm-Service-Updates und alle Services mit gewünschten Replicas terminal auswerten. Pausierte Updates oder fehlgeschlagene Tasks blockieren vor HTTP.
10. Erst nach erfolgreicher Swarm-Konvergenz den Runtime-Smoke für Root-Host, alle expliziten Tenant-Hosts, deren konkrete TLS-Zertifikate und einen unbekannten Host sowie den Live-Digest verifizieren.
11. Redigierte Staging-Paritätsevidenz für genau diesen Digest schreiben.

Migration und Bootstrap führen im jeweiligen One-shot denselben IAM-Datenbank-Verifier aus, den auch Container-Boot und `health/ready` verwenden. Der Verifier vergleicht den höchsten angewendeten Goose-Ledgerstand mit dem im Zielimage enthaltenen Migrations-Head und prüft anschließend die kritischen Tabellen, Spalten, Indizes und RLS-Verträge. `migration_drift` und `schema_drift` bleiben getrennte, maschinenlesbare Fehlerursachen; beide blockieren den nächsten Rolloutschritt. Ein neuerer Datenbankstand als der Image-Head wird akzeptiert, damit ein App-Rollback nach einer vorwärtskompatiblen Migration möglich bleibt.

Der Studio-Migrations-One-shot aktiviert den Waste-Schritt explizit mit `WASTE_TENANT_MIGRATIONS_ENABLED=true`; generische Runtime-Profile bleiben unabhängig von Waste-Secrets. Er wendet zuerst die versionierten Goose-Migrationen auf `sva_studio` an, aktualisiert anschließend das interne `graphile_worker`-Schema mit demselben privilegierten Migrationsprincipal und verarbeitet danach die Waste-Tenant-Migrationen. Erst nach erfolgreichem Abschluss reconciliert der separate Bootstrap die getrennten Rechte für `sva_app` und `sva_job_worker`; die laufende App führt keine Graphile-Migrationen aus. Der Waste-Schritt liest das vollständige Registry-Inventar aller `ready`- und `disabled`-Waste-Tenant-Datenbanken und wendet je Datenbank ausschließlich noch nicht protokollierte, im Zielimage versionierte Waste-Migrationen an. Datenbanknamen werden erneut aus der Instanz-ID abgeleitet und müssen exakt mit der Registry übereinstimmen. Jede Tenant-Datenbank führt ihren Stand in `public.sva_waste_schema_migrations`; die ausstehenden SQL-Schritte, ihre Verifikation und der Ledger-Eintrag laufen gemeinsam in einer Transaktion nach transaktionslokalem Wechsel in die jeweilige Owner-Rolle.

Der Schema-Builder für neue Waste-Tenants wird nicht auf Bestandsdatenbanken wiederholt. Destruktive Änderungen benötigen eine eigene Migration mit Preflight und expliziter Freigabe. Namensdrift, ein nicht lesbares Provisioner-Secret, SQL-Fehler oder eine fehlgeschlagene Verifikation rollen die aktuelle Tenant-Transaktion zurück und beenden den One-shot rot, bevor Bootstrap oder App-Deploy beginnen. Bereits erfolgreich migrierte andere Tenant-Datenbanken bleiben committed und werden bei einem Wiederanlauf anhand ihres Ledgers übersprungen und erneut verifiziert.

Der Bootstrap-Reconcile liest den im Release-Image kompilierten kanonischen Permission-Katalog. Für jeden Tenant aus `SVA_ALLOWED_INSTANCE_IDS` legt er fehlende aktive Core-Permissions sowie Permissions der bereits zugewiesenen Module an und ergänzt die standardmäßig vorgesehenen `system_admin`-Grants. Der Pfad ist additiv: Er löscht weder Permission-Definitionen noch Grants aufgrund einer Katalogentfernung. Die erfolgreiche Ausführung erzeugt pro Tenant das Audit-Ereignis `instance_permission_catalog_reconciled`; dessen Zähler sind Bestandteil der Rollout-Evidenz.

Nur ein insgesamt erfolgreicher mutierender Staging-Lauf erzeugt die für eine mutierende Production-Promotion gültige Paritätsevidenz.

## Phase 3: Denselben Digest nach Production promoten

Production verwendet denselben Workflow und denselben bereits in Staging geprüften Digest. Zusätzlich gelten:

- Das GitHub-Environment `prod` muss ausdrücklich freigegeben werden.
- Für genau den Zieldigest muss die erfolgreiche Evidenz eines abgeschlossenen mutierenden Staging-Laufs vorliegen.
- Vor der ersten Production-Mutation muss der Production-Backup-Agent ein erfolgreiches und anschließend unabhängig verifiziertes Backup liefern.

Danach gilt dieselbe Reihenfolge wie in Staging: Backup → Migration → Bootstrap → Postconditions → App-Deploy → Runtime-Smoke → Digest-Prüfung.

Auch ein reines App-Deployment mit beiden Modi `assert-none` beginnt mit einem erfolgreich verifizierten Datenbank-Backup.
Migrationen, Bootstraps und Backups benötigen keinen Wartungsfenster-Verweis. Die technische Audit-Kette besteht aus GitHub-Run-ID, Commit, unveränderlichem Ziel-Digest, Environment-Freigabe, Backup-Ergebnis, Staging-Parität und den redigierten Evidenzartefakten.

## Konvergenz und Erfolgsdefinition

Vor der ersten Mutation läuft der repository-lokale Remote-Config-Builder zunächst im Shadow-Modus. Seine Quelle ist ausschließlich `config/runtime/remote/<umgebung>.vars`; `*.local.vars` sind als Remote-Quelle technisch gesperrt. Der Vergleich betrachtet Schlüsselmengen, nicht-sensitive Werte, Klassifikationen und externe Secret-Namen. Secret-Werte, Hashes und Wertlängen sind keine Evidenz. Bis zur ausdrücklich gestuften Umschaltung bleibt `APP_CONFIG` die autoritative Deploy-Ausgabe.

Die Umschaltung erfolgt ausschließlich über die geschützte GitHub-Environment-Variable `PROMOTE_CONFIG_BUILDER_MODE`. Ohne Wert beziehungsweise mit `shadow` bleibt `APP_CONFIG` maßgeblich und Builder-Probleme werden nur als Warnung erfasst. `authoritative` wählt das getrackte Profil plus geschützte Werte: vorrangig aus `PROMOTE_CONFIG_OVERRIDES`, während des Übergangs andernfalls ausschließlich aus den als `secret-value` oder `secret-reference` klassifizierten Einträgen des bestehenden `APP_CONFIG`. Nicht-sensitive Werte aus `APP_CONFIG` werden nie übernommen; unbekannte, falsch klassifizierte oder fehlende Werte stoppen vor jeder Remote-Mutation. Die Aktivierung erfolgt einzeln in Dev, danach Staging und zuletzt Production; ein Wert außerhalb von `shadow|authoritative` stoppt ebenfalls vor jeder Remote-Mutation.

Historische Connection-Strings wie `IAM_DATABASE_URL` und `REDIS_URL` gelten in der Übergangsphase als geschützte Werte und werden aus dem bestehenden Bundle übernommen. Frühere betriebliche Hilfswerte für Endpoint-, Image- oder Smoke-Auflösung sind dagegen nicht autoritativ: Der Promote-Workflow liefert diese Werte selbst, leitet sie aus dem Ziel ab oder verwendet die dokumentierten Runtime-Defaults. Solche klassifizierten Legacy-Werte werden deshalb nicht aus `APP_CONFIG` in das neue Bundle kopiert.

Der isolierte Candidate-One-shot läuft mit dem Zielimage vor Backup, Migration, Bootstrap und Deploy. Er besitzt kein Ingress, kein schreibbares Dateisystem und keine Linux-Capabilities. Seine Datenbankverbindung wird ausschließlich in einer `READ ONLY`-Transaktion verwendet. Geprüft werden Runtime-Profil, externe Secret-Mounts, der explizite Release-Tenant-Scope sowie die Entschlüsselbarkeit der aktiven Tenant-Secrets. Das erfolgreiche Pullen und Starten des temporären Stacks attestiert zugleich die Registry-Lesbarkeit des Zielimages. Der Stack wird nach terminalem Erfolg oder Fehler entfernt. `CANDIDATE_PREFLIGHT_GATE=enforce` aktiviert das Gate pro GitHub-Environment blockierend; bis dahin bleibt das Ergebnis beobachtend.

`promote_mode=standard` verlangt für Production bereits vor Backup oder Deploy `health/ready` mit HTTP 200. Ein degradierter Ausgangszustand benötigt `promote_mode=recovery`, einen dokumentierten Grund und die Freigabe des geschützten Environments; Backup, Staging-Digest-Parität und sämtliche Nachprüfungen bleiben dabei unverändert. Production prüft die Staging-Parität bei jedem Promote, also auch bei einem reinen App-Deployment.

Vor dem ersten Agent-Auftrag fragt der Workflow den geschützten read-only Capability-Endpunkt ab. Protokollversion 2, Agent-Revision, benötigte Ergebnisfelder sowie Studio- und gegebenenfalls Waste-Unterstützung müssen live vorhanden sein. Bis zum nachgewiesenen Producer-Rollout bleibt der Schritt beobachtend; erst `BACKUP_CAPABILITY_GATE=enforce` im geschützten Environment aktiviert ihn blockierend.

Docker-Swarm-Dienste dürfen nach einem Update längere Zeit benötigen, bis alle Probes stabil sind. Die bisherige HTTP-Warmup-Grenze von bis zu fünf Minuten reicht dafür nicht immer aus. Swarm-Konvergenz und HTTP-Warmup sind deshalb getrennte Gates: Zuerst pollt `Promote` ausschließlich allowlistete Service-, Replica-, Update- und Task-Zustände. Erst wenn alle gewünschten Replicas laufen und kein Update mehr aktiv oder pausiert ist, beginnt der Runtime-Smoke mit standardmäßig bis zu 50 Erreichbarkeitsprüfungen im Abstand von zehn Sekunden. Deshalb gilt:

1. Ein unmittelbar nach dem Deploy fehlschlagender Smoke wird nicht durch weitere Mutationen „repariert“.
2. Zuerst Service-Update und Tasks innerhalb des eigenen Swarm-Zeitfensters prüfen; `PROMOTE_SWARM_CONVERGENCE_TIMEOUT` beziehungsweise `PROMOTE_INTERNAL_ERROR` verhindert jeden externen Smoke.
3. In Production danach `health/live`, `health/ready`, den Release-Blocking-Tenant-Login-Redirect (`de-studio-sandbox`) und den Live-Digest erneut prüfen. Weitere Tenant-Redirects bleiben operativ überwacht, blockieren aber nicht. Staging verwendet den allgemeinen Runtime-Smoke ohne verpflichtenden Tenant-Scope.
4. Bleibt ein Fehler bestehen, ist der Rollout rot und wird diagnostiziert oder auf den vorherigen Digest zurückgeführt.
5. Ein Workflow-Retry ist erst nach dokumentierter Ursache beziehungsweise bestätigtem reinen Konvergenzfehler zulässig.

Fehlgeschlagene Migration-, Bootstrap- und Candidate-One-shots werden weiterhin terminal bereinigt. Vor dem Cleanup wird jedoch eine redigierte Evidenz mit Jobart, Failure-Klasse, Stack-/Task-ID, Terminalzustand und Exit-Code geschrieben. Freie Task-Messages, Container-Logs, SQL-Text, URLs, PII und Secret-Werte bleiben ausgeschlossen. Bei einer fehlgeschlagenen Migration muss vor jedem Retry zunächst der bereits erreichte Datenbank- und Ledgerstand festgestellt werden.

Ein regulärer Production-Rollout ist nur erfolgreich, wenn der GitHub-Workflow grün ist, der erwartete Digest live läuft, `live` und `ready` HTTP 200 liefern und der Release-Blocking-Tenant-Smoke für `de-studio-sandbox` bestanden ist. Weitere Tenant-Smokes sind operative Signale und keine Release-Blocker.

Ein kontrollierter Datenbankrestore besitzt strengere Nachbedingungen als ein regulärer Rollout: Der Backup-Agent muss die statischen ACLs des Runtime-Principals rekonstruiert und datenbanknah validiert haben. Nach dem Neustart muss der Restore-Workflow zusätzlich mit dem geschützten Restore-Smoke-Zugang einen nicht degradierten `/auth/me`-Zustand und HTTP 200 für `/iam/me/permissions` nachweisen. Fehlt einer dieser Nachweise, bleibt der Restore rot und die Anwendung wird wieder stillgelegt.

## Backup- und Rollback-Grenzen

- Das Promote-Backup ist ein PostgreSQL-Custom-Dump, kein Snapshot des gesamten Systems.
- Keycloak, MinIO-Objekte und weitere externe Systeme sind nicht automatisch Bestandteil dieses Dumps.
- Ein App-Rollback ist ausschließlich für das Paar aus vorherigem unveränderlichem Digest und der exakt dazugehörigen versionierten nicht-sensitiven Config-Revision zulässig. Der erfolgreiche Promote berechnet diese Revision aus dem tatsächlich selektierten Deploy-Bundle – im Shadow-Modus ausdrücklich nicht aus dem nur beobachteten Candidate – und bindet sie über das Service-Label `sva.config.revision` an den laufenden App-Service. Die finale Prüfung liest Digest und Config-Revision aus demselben Service-Snapshot zurück; nur diese Live-Bindung darf den Rollback speisen.
- Sobald in Staging oder Production bereits ein Live-Digest vorhanden ist, blockiert eine fehlende oder ungültige gebundene Config-Revision jeden weiteren mutierenden Promote vor Backup und Mutation – unabhängig davon, ob der Zieldigest gleich bleibt oder wechselt und ob Standard oder Recovery gewählt ist. Es gibt keinen stillen Legacy-Seed; ein einmaliger Übergang benötigt einen separat geprüften Plan. Nur das disposable Dev-Environment darf im Standardmodus ohne vorherige Bindung weiterlaufen.
- Fehlt das Label, ist seine Revision ungültig oder lässt sich die Bindung zum vorherigen Live-Digest nicht eindeutig nachweisen, gilt **STOP**: Der Workflow bricht fail-closed vor jeder Mutation ab. Aktueller Git-Stand, historische Artefakte, lokale `*.local.vars` oder eine rekonstruierte Revision sind kein Ersatz; der Vorfall benötigt einen separat geprüften Recovery-Plan.
- Das geschützte Override-Bundle und Secret-Werte werden für diesen Vertrag weder historisiert noch automatisch zurückgesetzt. Ist eine Secret-Rotation mit dem vorherigen Digest und seiner Config-Revision inkompatibel, gilt ebenfalls **STOP** bis ein separat geprüfter Recovery-Plan die Kompatibilität und die zulässige Wiederherstellung festlegt.
- Auch dieser Plan darf keinen zweiten Deploypfad einführen: App-Mutationen bleiben an den geschützten `Promote`-Workflow mit unveränderten Backup-, Paritäts- und Post-Deploy-Gates gebunden.
- Erfolgreich angewandte Datenbankmigrationen werden niemals automatisch zurückgerollt.
- Nicht rückwärtskompatible Migrationen benötigen vor dem Rollout einen separat geprüften Restore-Plan.
- Die Workflows **Staging Backup Drill** und **Production Backup Drill** prüfen Backups ohne Migration, Bootstrap oder App-Deployment; sie ersetzen keinen Promote-Lauf.

## Einmaliger Staging-Übergang für ein fehlendes Live-Config-Label

Der H4-Übergang ist ausschließlich für den bekannten Legacy-Zustand vorgesehen, in dem `studio-staging` bereits den unveränderten Zieldigest ausführt, am App-Service aber noch kein Label `sva.config.revision` vorhanden ist. Ein vorhandenes ungültiges oder gültiges Label ist nicht seedbar. Dev, Production, Recovery, ein Digestwechsel sowie Migration oder Bootstrap sind ausgeschlossen; beide Läufe verwenden `promote_mode=standard`, denselben Digest, `change_base=change_head` und jeweils `assert-none`.

Der geschützte Zwei-Run-Handshake wird ausschließlich manuell über `workflow_dispatch` des bestehenden Workflows `Promote` ausgeführt:

1. Zuerst einen Staging-Standard-Promote im expliziten Modus `prepare-staging-live-config-label` mit den genannten Grenzen und ohne Run-Referenz starten. Ein eigenes Preparation-Gate muss den atomaren Live-Snapshot als Same-Digest und Labelzustand `missing` attestieren; `valid`, `invalid` oder ein Digestwechsel stoppen früher. Nur danach muss der Lauf exakt mit `PROMOTE_RECOVERY_CONTEXT_INVALID` am Recovery-Vertrag enden. Backup, Candidate, Migration, Bootstrap, Deploy und Staging-Parität dürfen in diesem Vorlauf nicht begonnen haben. Die schema-strikte, redigierte Fehlerevidenz dieses exakten Runs und Attempts mit festem Preparation-Marker ist die einzige zulässige Seed-Autorisierung.
2. Unmittelbar danach einen neuen `workflow_dispatch` mit dem expliziten Modus `seed-staging-live-config-label` und der genauen Run-ID sowie dem Attempt des Vorlaufs starten. Es darf kein anderer `Promote` dazwischen liegen: Workflow-ID muss identisch und die Run-Nummer des Prepare-Laufs exakt der Vorgänger des aktuellen Seed-Runs sein. Der Workflow prüft den abgeschlossenen fehlgeschlagenen `Promote`-Run auf `main`, sein eindeutiges nicht abgelaufenes Evidenzartefakt, die einzelne Root-JSON-Datei, identische Source-, Digest- und Config-Grenzen sowie die vollständige erwartete Gatematrix. Aktueller Run, Prepare-Run, Attempt, Vorgängerbeziehung, Artefakt und Live-Snapshot werden nach dem Download erneut gebunden.
3. Nur wenn das Label weiterhin fehlt und derselbe Digest live ist, ergänzt das vor dem Source-Wechsel konservierte H4-Controller-Overlay ausschließlich `sva.config.revision` am Staging-App-Service. Ein struktureller Rendervergleich muss jede weitere Änderung ausschließen. Unmittelbar vor dem Deploy werden Digest und fehlendes Label erneut gemeinsam gelesen.
4. Prepare und Seed verlangen den gemäß ADR-048 kanonischen Backup-Executor `agent`; eine fehlende Variable wird auf diesen Standard normalisiert, `temporary` und unbekannte Werte blockieren. Der Seed-Lauf bleibt an kanonische Main-E2E-Evidenz, Candidate, blockierende Backup-Capability, frische verifizierte Studio- und gegebenenfalls Waste-Backups, Deploy, Swarm-Konvergenz, Runtime-Smoke sowie den gemeinsamen finalen Digest-/Config-Readback gebunden. Weder Prepare noch Seed erzeugen eine Production-fähige Staging-Parität.

Die Evidenz hält die separate allowlistete Seed-Autorisierung fest, synthetisiert aber weder `previousConfigRevision` noch einen Rollback-Kandidaten; beide Werte bleiben leer. Nach erfolgreichem Seed ist das Label gültig vorhanden und jeder weitere Seed-Versuch muss fail-closed enden. Der historische erfolgreiche Staging-Run `32212677551` darf ausschließlich als read-only Cross-Check bekannter Source-, Digest- und Config-Werte dienen; er ist keine Autorisierung und darf nicht als Seed-Referenz verwendet werden.

## Diagnose und Recovery

Lokale Befehle wie `env:status:*`, `env:doctor:*`, `env:precheck:*` und `env:smoke:*` bleiben für read-only Diagnose zulässig. Direkte Service-, Stack- oder Portainer-Mutationen sind ausschließlich Incident-Recovery, müssen auf den expliziten Zielstack begrenzt und anschließend durch den kanonischen `Promote`-Vertrag reconciled und verifiziert werden.

Historische Reports unter `docs/reports/`, zeitgebundene Staging-Unterlagen unter `docs/staging/`, PR-Dokumente unter `docs/pr/`, Planungsunterlagen unter `docs/superpowers/` und archivierte OpenSpec-Changes sind Evidenz, aber keine Bedienanleitung.

## Verbindliche Referenzen

- Workflow: [`.github/workflows/build.yml`](../../.github/workflows/build.yml)
- Workflow: [`.github/workflows/promote.yml`](../../.github/workflows/promote.yml)
- Backup-Drills: [Staging](../../.github/workflows/staging-backup-drill.yml) und [Production](../../.github/workflows/production-backup-drill.yml)
- Architektur: [`07-deployment-view.md`](../architecture/07-deployment-view.md)
- Sicherheits- und Evidenzvertrag: [`08-cross-cutting-concepts.md`](../architecture/08-cross-cutting-concepts.md)
- Backup-Entscheidung: [`ADR-048`](../adr/ADR-048-zentraler-backup-agent-mit-gehaertetem-https-trigger.md)
- Infrastruktur, Diagnose und Restore: [`swarm-deployment-runbook.md`](./swarm-deployment-runbook.md)
