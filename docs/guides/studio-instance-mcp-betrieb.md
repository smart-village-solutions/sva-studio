# Lokalen Instanz-MCP sicher betreiben

## Zweck

Der lokale stdio-MCP-Server stellt Codex und CLI-Clients die Studio-Instanz-Control-Plane bereit. Er spricht ausschließlich die konfigurierte Studio-API. Direkte Zugriffe auf Studio-Datenbank oder Keycloak-Admin-API gehören nicht zum Betriebsvertrag.

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

Beispiel für einen lokal verfügbaren `sva-studio-mcp`-Binary in der Codex-Konfiguration:

```toml
[mcp_servers.sva-studio-dev]
command = "sva-studio-mcp"

[mcp_servers.sva-studio-dev.env]
SVA_STUDIO_MCP_BASE_URL = "https://studio-dev.smart-village.app"
SVA_STUDIO_MCP_TOKEN_URL = "https://keycloak.smart-village.app/realms/studio-dev/protocol/openid-connect/token"
SVA_STUDIO_MCP_CLIENT_ID = "sva-studio-mcp"
SVA_STUDIO_MCP_CLIENT_SECRET_COMMAND = '["security","find-generic-password","-a","sva-studio-mcp","-s","sva-studio-mcp-studio-dev","-w"]'
```

Der Secret-Resolver ist ein JSON-Array aus Programm und Argumenten und wird ohne Shell ausgeführt. Alternativ ist `SVA_STUDIO_MCP_CLIENT_SECRET` nur als lokaler Fallback vorgesehen. Zeitgrenzen können über `SVA_STUDIO_MCP_READ_TIMEOUT_MS`, `SVA_STUDIO_MCP_MUTATION_TIMEOUT_MS`, `SVA_STUDIO_MCP_TOKEN_TIMEOUT_MS` und `SVA_STUDIO_MCP_DIAGNOSIS_TIMEOUT_MS` angepasst werden. `SVA_STUDIO_MCP_CA_FILE` ergänzt bei interner PKI eine CA-Datei; die TLS-Prüfung bleibt immer aktiv.

Der MCP-Prozess holt kurzlebige Access Tokens per Client-Credentials-Flow. Studio validiert diese über OIDC-Metadaten und JWKS; das MCP-Client-Secret wird nicht in den Studio-Stack kopiert. Fehlerausgaben müssen Authorization-Header, Tokens, Client-Secrets, Tenant-Secrets, Connection-Strings und Stacktraces redigieren.

## Risikostufen

- Read-/Diagnose-Tools benötigen nur Read-Actions und keine Bestätigung.
- Kontrollierte Mutationen benötigen eine action-spezifische Rolle, einen Idempotency-Key und eine Korrelations-ID.
- Kritische Mutationen benötigen zusätzlich einen aktuellen Vorab-Read oder Plan, eine noch gültige serverseitige Challenge und die exakte Bestätigungsphrase.

Der MCP wiederholt oder repariert Mutationen nicht selbstständig. `retryable: true` ist ein Hinweis für einen explizit ausgelösten, begrenzten Retry. Der Primärfehler bleibt auch dann maßgeblich, wenn eine nachgelagerte Diagnose fehlschlägt.

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
