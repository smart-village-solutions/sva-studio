# SVA Studio MCP einrichten und nutzen

## Zweck

Der lokale stdio-MCP-Server stellt Codex und CLI-Clients die Studio-Instanz-Control-Plane bereit. Er spricht ausschließlich die konfigurierte Studio-API. Direkte Zugriffe auf Studio-Datenbank oder Keycloak-Admin-API gehören nicht zum Betriebsvertrag.

## Schnellstart

### Voraussetzungen

- Node.js und pnpm entsprechend der Workspace-Vorgaben,
- Zugriff auf die Zielumgebung und einen dafür ausgestellten Keycloak-Service-Account,
- eine lokale, nicht versionierte Ablage für das Client-Secret, vorzugsweise die OS-Keychain,
- ein gebautes MCP-Package:

```bash
pnpm install
pnpm nx run studio-mcp:build
```

### Secret lokal ablegen

Das Secret wird nur lokal unter einem eindeutigen Account- und Service-Namen abgelegt. Die verdeckte Eingabe verhindert, dass der Geheimwert als Shell-Argument oder in der History landet.

```bash
read -r -s -p "Client-Secret: " sva_mcp_secret
printf '\n'
security add-generic-password -U \
  -a "sva-studio-mcp" \
  -s "sva-studio-mcp-studio-dev" \
  -w "$sva_mcp_secret"
unset sva_mcp_secret
```

### Codex konfigurieren

Die folgende Konfiguration gehört in die lokale Codex-Konfiguration. Sie startet den gebauten Workspace-Binary über pnpm; ein global installiertes Binary ist nicht erforderlich.

```toml
[mcp_servers.sva-studio-dev]
command = "pnpm"
args = ["exec", "sva-studio-mcp"]

[mcp_servers.sva-studio-dev.env]
SVA_STUDIO_MCP_BASE_URL = "https://studio-dev.smart-village.app"
SVA_STUDIO_MCP_TOKEN_URL = "https://keycloak.smart-village.app/realms/studio-dev/protocol/openid-connect/token"
SVA_STUDIO_MCP_CLIENT_ID = "sva-studio-mcp"
SVA_STUDIO_MCP_CLIENT_SECRET_COMMAND = '["security","find-generic-password","-a","sva-studio-mcp","-s","sva-studio-mcp-studio-dev","-w"]'
```

Codex nach der Änderung neu starten oder die MCP-Serverkonfiguration neu laden. Der erste sichere Smoke-Test ist ein read-only Aufruf von `studio_instances_list` oder `studio_instance_diagnose` gegen eine bekannte Testinstanz. Bei einem Startfehler gibt der Prozess absichtlich keine Konfigurations- oder Secret-Details aus.

## Umgebungen und Keycloak

| Umgebung    | Root-Realm       | Client-ID        |
| ----------- | ---------------- | ---------------- |
| Entwicklung | `studio-dev`     | `sva-studio-mcp` |
| Staging     | `studio-staging` | `sva-studio-mcp` |
| Produktion  | `sva-studio`     | `sva-studio-mcp` |

Je Realm gilt:

- vertraulicher Client mit aktiviertem Service Account,
- Standard-, Direct-Grant- und Implicit-Flow deaktiviert,
- keine Redirect-URIs,
- auf 300 Sekunden begrenzte Access-Token-Laufzeit und an die Studio-Zielumgebung gebundene Audience,
- die Plattformrolle `instance_registry_admin` sowie alle vollständig qualifizierten MCP-Action-Rollen einschließlich `instance.confirmation.prepare`.

Das ist bewusst ein mächtiges Credential. Studio prüft trotzdem pro Route die konkrete Action und verlangt für kritische Mutationen zusätzlich eine einmalige Challenge.

Die drei Clients verwenden unterschiedliche Secrets. Ein Credential darf nie zwischen Umgebungen wiederverwendet werden.

## Lokale Konfiguration und Geheimnisse

Studio-Basis-URL, Realm, Client-ID und Client-Secret werden über OS-Keychain oder eine nicht versionierte lokale Umgebungskonfiguration an den MCP-Prozess gegeben. Secrets gehören nicht in `.codex/config.toml`, Shell-History, Repository-Dateien, Screenshots oder Betriebsberichte.

Falls ein `sva-studio-mcp`-Binary außerhalb des Workspace installiert ist, kann die oben gezeigte `command`-/`args`-Kombination durch `command = "sva-studio-mcp"` ersetzt werden. Die Umgebungsvariablen bleiben unverändert:

Der Secret-Resolver ist ein JSON-Array aus Programm und Argumenten und wird ohne Shell ausgeführt. Alternativ ist `SVA_STUDIO_MCP_CLIENT_SECRET` nur als lokaler Fallback vorgesehen. Zeitgrenzen können über `SVA_STUDIO_MCP_READ_TIMEOUT_MS`, `SVA_STUDIO_MCP_MUTATION_TIMEOUT_MS`, `SVA_STUDIO_MCP_PROCESS_TIMEOUT_MS`, `SVA_STUDIO_MCP_TOKEN_TIMEOUT_MS` und `SVA_STUDIO_MCP_DIAGNOSIS_TIMEOUT_MS` angepasst werden. `SVA_STUDIO_MCP_PROCESS_TIMEOUT_MS` begrenzt ausschließlich das Warten auf einen asynchronen Keycloak-Run und ist standardmäßig länger als ein einzelner Mutationsrequest. `SVA_STUDIO_MCP_CA_FILE` ergänzt bei interner PKI eine CA-Datei; die TLS-Prüfung bleibt immer aktiv.

Für persönliche Schnittstellen-Mutationen kann `SVA_STUDIO_MCP_INTERFACE_SECRET_COMMAND` einen lokalen Secret-Resolver konfigurieren. Das JSON-Array enthält Programm und Argumente und läuft ohne Shell; verfügbare Platzhalter sind `{contextId}`, `{interfaceType}`, `{interfaceId}`, `{field}` und `{secretRef}`. `{secretRef}` muss in mindestens einem Argument vorkommen. Das Programm gibt den Secret-Wert auf stdout aus; stdout und Fehlermeldungen werden nicht protokolliert. Der MCP ruft den Resolver je Secret-Feld auf und sendet den Wert anschließend nur im TLS-geschützten API-Request. MCP-Eingaben müssen stattdessen `{ "secretRef": "..." }` enthalten; Klartext wird lokal vor dem API-Aufruf abgewiesen. Die Referenz muss auf einen lokal erreichbaren Secret-Speicher zeigen.

Der MCP-Prozess holt kurzlebige Access Tokens per Client-Credentials-Flow. Studio validiert diese über OIDC-Metadaten und JWKS; das MCP-Client-Secret wird nicht in den Studio-Stack kopiert. Fehlerausgaben müssen Authorization-Header, Tokens, Client-Secrets, Tenant-Secrets, Connection-Strings und Stacktraces redigieren.

### Persönliche Plattform- und Tenant-Kontexte

Zusätzlich zum unveränderten servicegebundenen Instanz-MCP kann `SVA_STUDIO_MCP_PERSONAL_CONTEXTS` eine JSON-Liste explizit auswählbarer Plattform- und Tenant-Kontexte enthalten. Jeder Eintrag hat `id`, `name`, `kind`, `baseUrl`, `issuer`, `clientId` und bei `kind: "tenant"` außerdem `tenantId`. `baseUrl` muss der HTTPS-Ursprung der Studio-API und `issuer` der HTTPS-Realm-Issuer sein. Die Liste enthält keine Benutzer-Credentials oder Tokens. Personal-Tools werden nur registriert, wenn mindestens ein Kontext konfiguriert ist.

`studio_personal_contexts` zeigt die Auswahl, `studio_personal_login` startet für genau einen Kontext Authorization Code mit PKCE im lokalen Standardbrowser, und `studio_personal_logout` löscht dessen In-Memory-Anmeldung. Der lokale Callback ist fest an `http://127.0.0.1:8765/callback` gebunden, wie im Provisioning-Vertrag des persönlichen Clients. Nur ein MCP-Prozess kann diesen Port gleichzeitig besitzen; ein belegter Port beendet den Login geschlossen. Eine parallele zweite Anmeldung desselben Kontexts ist gesperrt, andere Kontexte bleiben unabhängig. State, Nonce und PKCE-Verifier gelten nur für den konkreten Loginversuch. Im Standardmodus `memory` bleiben Tokens im Prozessspeicher, werden vor Ablauf erneuert und bei Logout beziehungsweise Prozessende nach Möglichkeit widerrufen. macOS kann die persönliche Sitzung ausdrücklich im Schlüsselbund wiederverwenden (siehe unten).

#### Persönliche Sitzung auf macOS wiederverwenden

In der lokalen MCP-Umgebung `SVA_STUDIO_MCP_PERSONAL_SESSION_STORAGE = "keychain"` setzen und den MCP-Prozess neu starten. Ohne Einstellung bleibt `memory` aktiv. Danach einmal im gewünschten Kontext über `studio_personal_login` anmelden. Der Schlüsselbund speichert Refresh-Token und Identitätsbindung, keine Passwörter, Access-Tokens oder ID-Tokens. `security` erhält Geheimwerte nur über stdin; die Base64-Kodierung ist ein Transportformat, die Verschlüsselung übernimmt der OS-Schlüsselbund.

Nach einem Neustart restauriert der erste persönliche API-Aufruf ausschließlich seinen ausdrücklich gewählten Kontext durch OIDC-Refresh und Subject-Readback. Ein interaktiver Login entfernt vorher den alten gespeicherten Eintrag und startet bewusst eine neue Browser-Anmeldung. Die Kontextliste zeigt einen angemeldeten Account erst nach erfolgreicher Anmeldung oder Wiederherstellung. Pro Kontext wird genau die zuletzt ausdrücklich angemeldete Identität gespeichert; für einen Benutzerwechsel zuerst `studio_personal_logout` und danach `studio_personal_login` verwenden.

Logout löscht den Schlüsselbund-Eintrag und widerruft den Refresh-Token, auch wenn die Sitzung noch nicht restauriert wurde. Schlüsselbund-Ausfälle im Browser-Callback liefern HTTP 503 mit der technischen JSON-Antwort `{"error":"personal_session_store_unavailable"}`; Restore und Refresh erhalten denselben stabilen Code. Ein Providerfehler verhindert die lokale Löschung nicht; bei fehlgeschlagener Schlüsselbund-Löschung wird kein erfolgreicher persistenter Logout gemeldet. Im Keychain-Modus erhält ein normales Prozessende die gespeicherte Sitzung. Die Keycloak-Laufzeiten werden dadurch nicht verlängert; Ablauf oder Widerruf verlangt eine neue Anmeldung. Ungültige Bindung, abweichendes Subject oder fehlgeschlagener Refresh verwirft die gespeicherte Sitzung.

Vor Änderung oder Entfernung einer Kontextkonfiguration die gespeicherte Sitzung mit der alten Konfiguration abmelden. Der Lookup ist an die vollständige Kontextbindung gekoppelt; ohne vorherigen Logout verbleibt ein verschlüsselter Alt-Eintrag im Schlüsselbund, den die neue Konfiguration nicht verwenden kann. Ein Kontext darf nur von einem aktiven MCP-Prozess verwendet werden. Bei parallelen Prozessen können Refresh-Token-Rotationen kollidieren. Fehlender oder gesperrter Schlüsselbund und nicht unterstützte Plattformen melden `personal_session_store_unavailable`; kein automatisches Entsperren und kein Dateifallback. Die native CLI akzeptiert höchstens 4095 Bytes je Eingabezeile; größere kodierte Records werden vor dem Schreiben mit demselben stabilen Fehler abgewiesen, niemals gekürzt. `memory` deaktiviert die Nutzung vorhandener Einträge, löscht sie aber nicht: gespeicherte Sitzungen vor einem Wechsel des Modus über Logout entfernen.

`studio_personal_users_api` verwendet relative Pfade ohne führenden Schrägstrich. Es erlaubt die freigegebenen Einzelaktionen für Accounts, Rollen, Gruppen, Organisationen und Schnittstellen:

| Pfad unter `api/v1/` | Methoden / Aktionen                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `iam/users`          | `GET`, `POST`; am Account `GET`, `PATCH`, `DELETE`; `POST` auf `deactivate` und `send-password-setup-email`                  |
| `iam/roles`          | `GET`, `POST`; an der Rolle `PATCH`, `DELETE`                                                                                |
| `iam/groups`         | `GET`, `POST`; an der Gruppe `GET`, `PATCH`, `DELETE`; Rollen- und Mitgliedschaftszuordnung über die bestehenden Unterrouten |
| `iam/organizations`  | `GET`, `POST`; an der Organisation `GET`, `PATCH`, `DELETE`; Mitgliedschaften anlegen, ändern und entfernen                  |
| `interfaces/mainserver` | `GET`, `POST`; öffentliche Mainserver-Konfiguration (`graphqlBaseUrl`, `oauthTokenUrl`, `enabled`) |
| `interfaces`         | `GET`, `POST` mit `draft` und optionalem `existingId`; `DELETE interfaces/{interfaceId}`                                     |

Beim Entfernen einer Gruppenmitgliedschaft benötigt `DELETE iam/groups/{groupId}/memberships` den JSON-Body `{ "keycloakSubject": "..." }`. Die übrigen freigegebenen DELETE-Aufrufe tragen keinen Body. Bulk-, Sync- und Mainserver-Provisionierungsaktionen sind nicht Teil dieses persönlichen MCP-Vertrags. Der Server prüft weiterhin die jeweilige Action, Tenant-Bindung, Lifecycle- und Löschschutzregeln sowie gegebenenfalls Fresh-Reauth.

Alle sechs aktuell in Studio unterstützten Schnittstellenarten können über den persönlichen MCP angelegt werden:

| Schnittstellenart | Anlegen/Speichern | Voraussetzung |
| --- | --- | --- |
| Mainserver | `POST api/v1/interfaces/mainserver` | `integration.manage`; öffentliche URLs und `enabled` |
| S3 | `POST api/v1/interfaces`, `draft.type="s3"` | `integration.manage`; lokale Secret-Referenz |
| Supabase | `POST api/v1/interfaces`, `draft.type="supabase"` | Zusätzlich zu `integration.manage` das zugewiesene Modul `waste-management`; lokale Secret-Referenzen |
| PostgreSQL | `POST api/v1/interfaces`, `draft.type="postgresql"` | `integration.manage`; lokale Secret-Referenz |
| Mailtransport | `POST api/v1/interfaces`, `draft.type="mailTransport"` | `integration.manage`; bei Authentifizierung lokale Secret-Referenz |
| Karten/Geocoding | `POST api/v1/interfaces`, `draft.type="mapGeocoding"` | `integration.manage`; bei benötigtem API-Key lokale Secret-Referenz |

Die allgemeinen POST-Aufrufe verwenden `{ "draft": { "type": "...", "name": "...", "enabled": true, "config": { ... } } }`; vorhandene Einträge werden über `existingId` aktualisiert. Secret-Felder werden als `{ "secretRef": "..." }` lokal aufgelöst; Klartext-Secrets dürfen nicht im MCP-Aufruf stehen. Die bestehenden Modul-, Ownership-, Validierungs- und Healthcheck-Regeln gelten für alle Arten. Pluginverwaltete Einträge werden weiter durch ihren zuständigen Plugin-Pfad verwaltet.

`GET api/v1/interfaces/mainserver` liefert die öffentliche Mainserver-Konfiguration oder `null`. `POST` akzeptiert ausschließlich `graphqlBaseUrl`, `oauthTokenUrl` und `enabled`; Instanz-IDs und Credentials werden nicht übergeben. Beide Methoden benötigen `integration.manage`, der Server bindet den Actor an den Tenant-Host und verwendet den vorhandenen Mainserver-Speicherpfad samt URL-/SSRF-Validierung. Die öffentliche HTTPS-OAuth-Token-URL bleibt im MCP lesbar; Werte mit URL-Credentials oder Query-/Fragment-Zusätzen werden weiterhin geschwärzt. Auth-Fehler behalten ihren stabilen Code und HTTP-Status. Ein erfolgreicher Save ist kein OAuth-/GraphQL-Verbindungsnachweis. Nach einem unklaren Ergebnis zuerst GET verwenden; Mutationen werden nicht automatisch wiederholt.

Der Interface-Read liefert nur tenantverwaltete Schnittstellen; Mainserver-Übersichten und pluginverwaltete Einträge sind ausgenommen. Pluginverwaltete Interfaces können über diesen allgemeinen Vertrag weder angelegt noch geändert oder gelöscht werden. Die HTTP-Antworten enthalten keine freien Healthcheck-Statusmeldungen, da diese Providerdetails enthalten können. Der Server erzwingt weiterhin `integration.manage`, bestehende Validierung, Verschlüsselung und Healthchecks. Pro Tenant ist nur eine Karten-/Geocoding-Konfiguration zulässig; Änderungen verwenden deren `existingId`. Ein eigener Kartenstil ohne aktivierte Geocoding-Funktionen besitzt keinen Geoapify-Verbindungsnachweis; `unknown` ist dabei kein erfolgreich ausgeführter Provider-Healthcheck.

Beim Entfernen einer Gruppenmitgliedschaft über `DELETE api/v1/iam/groups/{groupId}/memberships` ist ein JSON-Body mit `keycloakSubject` erforderlich. Nur diese DELETE-Route nimmt einen Body an; andere DELETE-Aufrufe bleiben ohne Body.

Es gibt keinen Hostwechsel über Tool-Eingaben, keine Weiterleitung an andere Hosts, keine automatische Wiederholung von Mutationen und keinen Rückfall auf das Service-Credential. Nach einem unklaren Mutations-Ergebnis muss zuerst der autorisierte Zustand gelesen werden. Diese lokale Fähigkeit ersetzt weder die Realm-Einrichtung noch den Live-Nachweis; persönliche Keycloak-Clients bleiben bis zur erfolgreichen API-/MCP-Abnahme inaktiv.

### Einrichtung und Übergabe abnehmen

1. Technische Instanzaktivierung, HTTPS-Host und persönlichen PKCE-/API-Zugriff getrennt nachweisen. Dauerhafte Provider-Freigaben werden erst nach dem erfolgreichen Zugriffsnachweis beibehalten; Kunden-Admins erhalten dadurch keine MCP-Freigabe.
2. Beauftragte Schnittstellen, Organisationen, Rollen, Gruppen und Accounts anlegen und nachlesen. Ohne Mainserver bleiben abhängige Module aus; die Organisation meldet `integration_not_configured`, ohne einen technischen Mainserver-Account anzulegen.
3. Bei Mainserver-Anbindung dessen eigenen Schnittstellendialog verwenden. Studio-Realm und Mainserver-Kommune müssen dieselbe Identität adressieren: Eine erfolgreiche OAuth-/GraphQL-Probe mit Zugangsdaten einer anderen Kommune genügt nicht. Organisations-Provisionierung bis `ready` und den technischen Zugang bis zur Provider-Identität prüfen. Nach einem Fehler zuerst Status und korrelierte Logs lesen; die vorhandene Browseraktion kann die Provisionierung ausdrücklich wieder aufnehmen.
4. Den ersten Kunden-Admin mit `sendPasswordSetupEmail=false` und `invitationPurpose=studio` anlegen und `not_requested` prüfen. Erst nach den Einrichtungsprüfungen `POST iam/users/{userId}/send-password-setup-email` ausführen.
5. Die Antwort `sent`, den tatsächlichen Maileingang und die erste Kundenanmeldung getrennt dokumentieren. Ohne Zustellungs-/Anmeldenachweis bleibt die Übergabe offen. Selbstlöschung, geschützte Admin-Löschung und zulässige Deaktivierung/Löschung werden mit isolierten Testobjekten geprüft.

Die Produktionsabnahme des Changes ist im [Abnahmenachweis](../../openspec/changes/extend-tenant-setup-management/design.md#produktionsabnahme-abschnitt-5-nachweise-2026-10-08) festgehalten. Der reguläre Rollout folgt weiterhin ausschließlich dem [Studio-Rollout-Prozess](../guides/studio-rollout-process.md).

## Risikostufen

- Read-/Diagnose-Tools benötigen nur Read-Actions und keine Bestätigung.
- Kontrollierte Mutationen benötigen eine action-spezifische Rolle, einen Idempotency-Key und eine Korrelations-ID.
- Kritische Mutationen benötigen zusätzlich einen aktuellen Vorab-Read oder Plan, eine noch gültige serverseitige Challenge und die exakte Bestätigungsphrase.

Der MCP wiederholt oder repariert Mutationen nicht selbstständig. `retryable: true` ist ein Hinweis für einen explizit ausgelösten, begrenzten Retry. Der Primärfehler bleibt auch dann maßgeblich, wenn eine nachgelagerte Diagnose fehlschlägt.

Für gezielte Betriebsprüfungen stehen neben der aggregierten Diagnose eigenständige Tools für den aktuellen Keycloak-Status (`studio_instance_keycloak_status`), den Keycloak-Preflight (`studio_instance_keycloak_preflight`) und die tenantlokale IAM-Zugriffsprobe (`studio_instance_tenant_iam_access_probe`) bereit. Die ersten beiden sind Read-only; die Rechteprobe ist eine kontrollierte, auditierte Mutation mit der bestehenden Action `instance.diagnose`.

## Tool-Übersicht und benötigte Actions

| Bereich                  | MCP-Tools                                                                                                                                                    | Erforderliche Studio-Action                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Bestand und Evidenz      | `studio_instances_list`, `studio_instance_get`, `studio_instance_audit`, `studio_instances_audit`                                                            | `instance.list`, `instance.read`, `instance.audit.read`                                                                  |
| Diagnose                 | `studio_instance_diagnose`, `studio_instance_keycloak_status`, `studio_instance_keycloak_preflight`                                                          | `instance.diagnose`                                                                                                      |
| Provisioning             | `studio_instance_provisioning_plan`, `studio_instance_provisioning_execute`, `studio_instance_provisioning_run_get`, `studio_instance_reconcile`             | `instance.provision.plan`, `instance.provision.execute`, `instance.provision.run.read`, `instance.reconcile`             |
| Konfiguration und Module | `studio_instances_create`, `studio_instance_update`, `studio_instance_module_assign`, `studio_instance_iam_baseline_seed`, `studio_instance_admin_bootstrap` | `instance.create`, `instance.update`, `instance.module.assign`, `instance.iam.baseline.seed`, `instance.admin.bootstrap` |
| Tenant-IAM               | `studio_instance_tenant_iam_access_probe`, `studio_instance_iam_roles_reconcile`                                                                             | `instance.diagnose`, `instance.iam.roles.reconcile`                                                                      |
| Kritische Aktionen       | `studio_instance_activate`, `studio_instance_suspend`, `studio_instance_archive`, `studio_instance_module_revoke`, `studio_instance_secret_rotate`           | jeweilige Action plus `instance.confirmation.prepare`                                                                    |
| Geführter Ablauf         | `studio_instance_process`                                                                                                                                    | Kombination der für die gewählte Aktion benötigten Actions                                                               |

Die Tools mit kritischer Aktion verlangen immer zuerst `studio_instance_critical_action_prepare`. Dessen `challengeId` und die zurückgegebene Bestätigungsphrase werden unverändert an das eigentliche Tool übergeben. Challenges sind kurzlebig, zustandsgebunden und nur einmal verwendbar.
Für `studio_instance_secret_rotate` muss zusätzlich der unmittelbar zuvor mit `studio_instance_provisioning_plan` gelesene `planFingerprint` übergeben werden.

## Häufige Abläufe

### Tenant sicher anlegen

1. Mit `studio_instance_process` im Modus `create` den vollständigen Registry-Vertrag einschließlich Tenant-Admin-Profil und der gewünschten `moduleIds` übergeben.
2. Bei der Planbestätigung den zurückgegebenen `planFingerprint` und `idempotencyKey` unverändert an den nächsten Aufruf übergeben; anschließend den aktuellen Zustand mit `studio_instance_get` prüfen.
3. `instance.status.activate` über `studio_instance_critical_action_prepare` vorbereiten und anschließend mit `studio_instance_activate` bestätigen.
4. Mit `studio_instance_diagnose` oder den gezielten Status- und Preflight-Tools die Abnahme dokumentieren.

### Fehlerhaften Tenant reparieren

Bei `realmMode="existing"` kann der Realm bereits vorhanden sein, während seine Studio-Clients noch fehlen. Für diesen Bootstrap wird der Plan über den Provisioner aus dem aktuellen Keycloak-Zustand gelesen. Ein nachweislich fehlender Login-Client benötigt vor der Anlage kein Registry-Secret: Der Worker legt die Clients an, liest ihre Secrets anschließend intern aus und speichert sie verschlüsselt in der Registry. Ein Lauf gilt erst nach erfolgreicher Secret-Übernahme als abgeschlossen; MCP-Ausgaben enthalten keine Geheimwerte.

In Production müssen Plan, `studio_instance_provisioning_execute`, `studio_instance_secret_rotate` und `studio_instance_provisioning_run_get` denselben Provisioner-Control-Plane-Pfad verwenden. Execute-Aufrufe, Secret-Rotation samt Bestätigungs-Challenge und Keycloak-Run-Reads werden deshalb über den internen Proxy weitergeleitet; die Authentifizierungs-, Session- und CSRF-Header werden zur erneuten Prüfung mitgeführt. Für die Ergebnisprüfung den Keycloak-Run lesen; der allgemeine Parent-Create-Run ist ein anderer Lauftyp.

Existiert der Login-Client bereits und fehlt seine lesbare Registry-Credential, bleibt die reguläre Provisionierung blockiert. Dafür ist der bestehende kontrollierte Credential-Recovery-Pfad erforderlich. Dasselbe gilt nach einem fehlgeschlagenen Secret-Sync, wenn die Clients bereits angelegt wurden. Ein fehlgeschlagener Lauf wird mit einem neu gelesenen Plan und einer neuen Idempotenz-ID erneut gestartet; sein alter Fingerprint wird nicht wiederverwendet.

Die Recovery-Zulässigkeit wird mit einem aktuellen Provisioner-Preflight geprüft. Nur der Blocker `tenant_secret` darf dabei durch die bestätigte Rotation behoben werden. Ein historischer Bootstrap-Snapshot, fehlende Live-Evidenz oder weitere aktuelle Blocker autorisieren keinen Recovery-Lauf.

Ein mit `adoptExisting=true` bereits übernommener Admin kann erneut abgeglichen werden, wenn die E-Mail weiterhin eindeutig ist und alle Studio-Ownership-Marker exakt zu dieser Instanz und `tenant_admin` passen. Username, E-Mail, Aktivierungsstatus und fremde Rollen bleiben erhalten. Fremde oder partielle Ownership sowie mehrdeutige E-Mail-Treffer blockieren vor Keycloak-Schreibvorgängen.

1. Mit `studio_instance_diagnose`, `studio_instance_keycloak_status` und `studio_instance_keycloak_preflight` die aktuelle Evidenz lesen.
2. Bei Rollen- oder Zugriffsproblemen `studio_instance_iam_roles_reconcile` und anschließend `studio_instance_tenant_iam_access_probe` ausführen.
3. Bei Keycloak-Drift `studio_instance_process` im Modus `repair` verwenden; laufende oder fehlgeschlagene Runs mit `studio_instance_provisioning_run_get` verfolgen.
4. Erst bei grünem Doctor und notwendiger menschlicher Freigabe aktivieren.

### Modul ergänzen oder entziehen

1. Neue Module über `studio_instance_process` im Modus `adapt` oder gezielt über Zuweisung, IAM-Basis und Admin-Bootstrap ergänzen.
2. Für einen Modulentzug immer zuerst eine Challenge vorbereiten und dann `studio_instance_module_revoke` mit der exakten Phrase ausführen.
3. Anschließend Detail, Audit und Tenant-IAM-Zugriffsprobe kontrollieren.

## Geführter Instanzprozess

Der MCP-Server `sva-studio-mcp` stellt ergänzend zu den Einzeltools das Tool `studio_instance_process` bereit. Es verwendet die Modi `create`, `repair` und `adapt` und ruft dabei ausschließlich die bestehenden Studio-API-Verträge für Registry, Modulzuweisung, IAM-Basis, Admin-Struktur, Keycloak-Provisioning, instanzgebundenen Rollenabgleich, Rechteprobe und Detaildiagnose auf. Der Rollenabgleich verwendet die dedizierte Action `instance.iam.roles.reconcile`; eine Browser-Session oder eine pauschale IAM-Admin-Berechtigung ist dafür nicht erforderlich.

- `create` verlangt zusätzlich den bestehenden Create-Vertrag und legt die Registry-Instanz idempotent an.
- Unterbricht `create` für die menschliche Planbestätigung, gibt der Prozess den dabei verwendeten `idempotencyKey` zurück. Der bestätigende Folgeaufruf muss ihn zusammen mit dem `planFingerprint` wiederverwenden.
- `repair` arbeitet auf einer vorhandenen Instanz über den bestehenden Reconcile-Vertrag; `adapt` ergänzt nur fehlende Module einschließlich ihrer IAM-Basis und Admin-Struktur.
- Der Prozess verfolgt den gestarteten Keycloak-Run nur innerhalb seines lokalen Zeitbudgets mit gedrosseltem Backoff und gibt bei noch laufendem oder fehlgeschlagenem Run einen handlungsfähigen Zwischen- beziehungsweise Blockierungszustand zurück.
- Nach einem erfolgreichen Run gleicht er zuerst den instanzgebundenen Rollen-Katalog ab, führt dann eine tenantlokale Rechteprobe aus und liest den aktuellen Detail-/Doctor-Zustand. Historische Preflight-Evidenz ist kein Abschlussnachweis.
- Der Keycloak-Worker liest den Keycloak-Zustand nach der Mutation genau einmal und leitet daraus Status, Preflight und Plan für den gemeinsamen `status_snapshot` ab. Der Postflight ist von den historischen Worker-Snapshots getrennt; der MCP bewertet den Abschluss zusätzlich anhand des aktuellen Detail-Reads.
- Bei einem neuen Realm ist ein Provisioning-Run erst erfolgreich, wenn das Login-Client-Secret und – falls konfiguriert – das Tenant-Admin-Client-Secret verschlüsselt in der Registry gespeichert wurden. Nach einem erfolgreichen Create wird der Realm als Bestands-Realm geführt; spätere `repair`- und `adapt`-Läufe verwenden daher den Modus `existing`.
- `completed: true` bedeutet ausschließlich, dass die Instanz `active` ist und die abgenommenen Doctor-Achsen bereit sind. Ein technisch fertiger Tenant im Status `requested` liefert stattdessen `awaiting_human_action`, `completed: false` und die nächste Action `instance.status.activate`.

Die Aktivierung führt der Prozess nie selbst aus. Sie bleibt eine separate kritische Mutation mit aktuellem Vorab-Read, serverseitiger Challenge, Bestätigungsphrase, Idempotenz und Audit.

## Verifikation vor Freigabe

Die Freigabe erfolgt nacheinander für Entwicklung, Staging und Produktion. Pro Umgebung:

1. Kill-Switch deaktiviert lassen und Client-Metadaten, Service-Account, Audience sowie Action-Rollen read-only prüfen.
2. Server- und MCP-Artefakt deployen beziehungsweise lokal installieren.
3. Kill-Switch aktivieren und Liste, Detail, Audit und Diagnose gegen eine bekannte Testinstanz aufrufen.
4. Eine idempotente kontrollierte Mutation an einer eindeutig markierten Testinstanz ausführen und wiederholen; der zweite Aufruf muss denselben fachlichen Vorgang referenzieren.
5. Eine kritische Testmutation erst mit ungültiger und danach mit gültiger Challenge/Phrase prüfen. Replay muss abgelehnt werden.
6. Audit anhand `requestId`, MCP-Korrelation, Maschinenakteur und Action prüfen.
7. OTEL-Metriken und Spans auf erwartetes Ergebnis sowie Redaction prüfen.

Erst nach erfolgreicher Evidenz wird die nächste Umgebung freigegeben.

## Telemetrie und Alarmierung

Metriken unterscheiden Action, Risikostufe, Ergebnis und stabilen Fehlercode. Zusätzlich werden Diagnose-Timeouts/-Teilfehler sowie Challenge-Ausstellung, Erfolg, Ablauf, Replay und Zustandskonflikt gezählt. Instanz-ID, Token-Subject, Idempotency-Key und freie Fehlermeldungen sind keine Metrik-Labels.

Spans und Audit sind über `requestId` und MCP-Korrelation verbunden. Das Token-Subject wird nur als notwendiger Audit-Akteur gespeichert und nicht als hochkardinales Telemetrieattribut verwendet.

Alarmiert werden insbesondere:

- gehäufte Authentisierungs- oder Autorisierungsablehnungen,
- `internal_unclassified`,
- Diagnoseausfälle,
- Challenge-Replays und Zustandskonflikte,
- gehäufte Fehler kritischer Mutationen.

## Secret-Rotation

1. Neues Client-Credential im betroffenen Realm ausstellen, ohne das alte sofort zu entfernen.
2. Lokale Keychain oder Secret-Konfiguration aktualisieren.
3. Neues Access Token beziehen und einen Read-only-Smoke ausführen.
4. Eine Audit-Korrelation für den neuen Maschinenzugriff prüfen.
5. Altes Credential widerrufen und verifizieren, dass es kein Token mehr erhält.

Secretwerte werden bei keinem Schritt ausgegeben oder in einen Bericht übernommen.

## Incident und Rollback

1. Den MCP-Kill-Switch der betroffenen Studio-Umgebung deaktivieren.
2. Kompromittierte Credentials widerrufen oder den Client deaktivieren.
3. Lokale MCP-Konfiguration entfernen beziehungsweise stoppen.
4. Audit und OTEL anhand der letzten bekannten Korrelationen untersuchen.
5. Bei einem Runtime-Problem den vorherigen freigegebenen Studio-Image-Digest nach dem Recovery-Vertrag des [kanonischen Studio-Rollouts](../guides/studio-rollout-process.md) wiederherstellen.

Browser-Session, CSRF und Fresh-Reauth bleiben von diesem Rollback unberührt. Additive Challenge-Daten können ungenutzt bestehen bleiben; während eines Incidents wird keine Down-Migration erzwungen.

## Verifikationsmatrix im Repository

- Package-nahe Unit- und Type-Tests zuerst über die jeweiligen Nx-Targets ausführen.
- Für serverseitig geladene Packages zusätzlich das jeweilige `check:runtime`-Target ausführen.
- Vor affected Unit-Runs den Scope mit `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main` messen.
- Vor PR-Freigabe `pnpm test:pr` ausführen. Der reguläre Umgebungsrollout folgt ausschließlich dem [kanonischen Studio-Rollout](../guides/studio-rollout-process.md); `pnpm test:release:studio` ist nur eine optionale lokale Vollprüfung.
- OpenSpec mit `openspec validate add-studio-instance-create-mcp --strict` und die Ablage mit `pnpm check:file-placement` prüfen.
