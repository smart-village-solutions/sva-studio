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

| Umgebung | Root-Realm | Client-ID |
| --- | --- | --- |
| Entwicklung | `studio-dev` | `sva-studio-mcp` |
| Staging | `studio-staging` | `sva-studio-mcp` |
| Produktion | `sva-studio` | `sva-studio-mcp` |

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

Der MCP-Prozess holt kurzlebige Access Tokens per Client-Credentials-Flow. Studio validiert diese über OIDC-Metadaten und JWKS; das MCP-Client-Secret wird nicht in den Studio-Stack kopiert. Fehlerausgaben müssen Authorization-Header, Tokens, Client-Secrets, Tenant-Secrets, Connection-Strings und Stacktraces redigieren.

## Risikostufen

- Read-/Diagnose-Tools benötigen nur Read-Actions und keine Bestätigung.
- Kontrollierte Mutationen benötigen eine action-spezifische Rolle, einen Idempotency-Key und eine Korrelations-ID.
- Kritische Mutationen benötigen zusätzlich einen aktuellen Vorab-Read oder Plan, eine noch gültige serverseitige Challenge und die exakte Bestätigungsphrase.

Der MCP wiederholt oder repariert Mutationen nicht selbstständig. `retryable: true` ist ein Hinweis für einen explizit ausgelösten, begrenzten Retry. Der Primärfehler bleibt auch dann maßgeblich, wenn eine nachgelagerte Diagnose fehlschlägt.

Für gezielte Betriebsprüfungen stehen neben der aggregierten Diagnose eigenständige Tools für den aktuellen Keycloak-Status (`studio_instance_keycloak_status`), den Keycloak-Preflight (`studio_instance_keycloak_preflight`) und die tenantlokale IAM-Zugriffsprobe (`studio_instance_tenant_iam_access_probe`) bereit. Die ersten beiden sind Read-only; die Rechteprobe ist eine kontrollierte, auditierte Mutation mit der bestehenden Action `instance.diagnose`.

## Tool-Übersicht und benötigte Actions

| Bereich | MCP-Tools | Erforderliche Studio-Action |
| --- | --- | --- |
| Bestand und Evidenz | `studio_instances_list`, `studio_instance_get`, `studio_instance_audit`, `studio_instances_audit` | `instance.list`, `instance.read`, `instance.audit.read` |
| Diagnose | `studio_instance_diagnose`, `studio_instance_keycloak_status`, `studio_instance_keycloak_preflight` | `instance.diagnose` |
| Provisioning | `studio_instance_provisioning_plan`, `studio_instance_provisioning_execute`, `studio_instance_provisioning_run_get`, `studio_instance_reconcile` | `instance.provision.plan`, `instance.provision.execute`, `instance.provision.run.read`, `instance.reconcile` |
| Konfiguration und Module | `studio_instances_create`, `studio_instance_update`, `studio_instance_module_assign`, `studio_instance_iam_baseline_seed`, `studio_instance_admin_bootstrap` | `instance.create`, `instance.update`, `instance.module.assign`, `instance.iam.baseline.seed`, `instance.admin.bootstrap` |
| Tenant-IAM | `studio_instance_tenant_iam_access_probe`, `studio_instance_iam_roles_reconcile` | `instance.diagnose`, `instance.iam.roles.reconcile` |
| Kritische Aktionen | `studio_instance_activate`, `studio_instance_suspend`, `studio_instance_archive`, `studio_instance_module_revoke`, `studio_instance_secret_rotate` | jeweilige Action plus `instance.confirmation.prepare` |
| Geführter Ablauf | `studio_instance_process` | Kombination der für die gewählte Aktion benötigten Actions |

Die Tools mit kritischer Aktion verlangen immer zuerst `studio_instance_critical_action_prepare`. Dessen `challengeId` und die zurückgegebene Bestätigungsphrase werden unverändert an das eigentliche Tool übergeben. Challenges sind kurzlebig, zustandsgebunden und nur einmal verwendbar.

## Häufige Abläufe

### Tenant sicher anlegen

1. Mit `studio_instance_process` im Modus `create` den vollständigen Registry-Vertrag einschließlich Tenant-Admin-Profil und der gewünschten `moduleIds` übergeben.
2. Bei `status: awaiting_human_action` zuerst den aktuellen Zustand mit `studio_instance_get` prüfen.
3. `instance.status.activate` über `studio_instance_critical_action_prepare` vorbereiten und anschließend mit `studio_instance_activate` bestätigen.
4. Mit `studio_instance_diagnose` oder den gezielten Status- und Preflight-Tools die Abnahme dokumentieren.

### Fehlerhaften Tenant reparieren

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
- `repair` arbeitet auf einer vorhandenen Instanz über den bestehenden Reconcile-Vertrag; `adapt` ergänzt nur fehlende Module einschließlich ihrer IAM-Basis und Admin-Struktur.
- Der Prozess verfolgt den gestarteten Keycloak-Run nur innerhalb seines lokalen Zeitbudgets mit gedrosseltem Backoff und gibt bei noch laufendem oder fehlgeschlagenem Run einen handlungsfähigen Zwischen- beziehungsweise Blockierungszustand zurück.
- Nach einem erfolgreichen Run gleicht er zuerst den instanzgebundenen Rollen-Katalog ab, führt dann eine tenantlokale Rechteprobe aus und liest den aktuellen Detail-/Doctor-Zustand. Historische Preflight-Evidenz ist kein Abschlussnachweis.
- Der Keycloak-Worker persistiert den nach der Mutation gelesenen Status als `status_snapshot` im Provisioning-Run. Dieser Postflight ist von seinem historischen `worker_preflight_snapshot` getrennt; der MCP bewertet den Abschluss zusätzlich anhand des aktuellen Detail-Reads.
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
5. Bei einem Runtime-Problem den vorherigen freigegebenen Studio-Image-Digest deployen.

Browser-Session, CSRF und Fresh-Reauth bleiben von diesem Rollback unberührt. Additive Challenge-Daten können ungenutzt bestehen bleiben; während eines Incidents wird keine Down-Migration erzwungen.

## Verifikationsmatrix im Repository

- Package-nahe Unit- und Type-Tests zuerst über die jeweiligen Nx-Targets ausführen.
- Für serverseitig geladene Packages zusätzlich das jeweilige `check:runtime`-Target ausführen.
- Vor affected Unit-Runs den Scope mit `pnpm nx show projects --affected --withTarget=test:unit --base=origin/main` messen.
- Vor PR-Freigabe `pnpm test:pr`, vor einem Studio-Rollout zusätzlich `pnpm test:release:studio` ausführen.
- OpenSpec mit `openspec validate add-studio-instance-create-mcp --strict` und die Ablage mit `pnpm check:file-placement` prüfen.
