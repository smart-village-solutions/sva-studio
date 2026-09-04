# Assurance: SSF-Runtime-Konfiguration V1

Dieses Dokument hält nur die systemübergreifenden Invarianten und ihre
geplanten Nachweise fest. Detailtests verbleiben in den jeweiligen Tasks.

| ID          | Invariante                                                                                                                       | Nachweis im ersten Slice                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSF-RT-01` | Ein Request kann ausschließlich den nach Service-Authentisierung hostgebundenen Tenant lesen.                                    | `packages/plugin-ssf/tests/postgresql.integration.test.ts`, `packages/auth-runtime/src/{ssf-runtime-plugin-service,plugin-server-handlers/dispatcher}.test.ts` und `apps/sva-studio-react/src/lib/ssf-runtime-endpoint.server.test.ts` |
| `SSF-RT-02` | Ohne gültiges Service-Token mit exaktem Issuer, Audience, Client und Action wird keine Plugin-Logik ausgeführt.                  | `packages/auth-runtime/src/{service-token,ssf-runtime-service-token,ssf-runtime-plugin-service}.test.ts`, Dispatcher-Spy und Endpoint-Integrationstest                                                                                 |
| `SSF-RT-03` | Ohne aktive Instanz, aktives Plugin, Readiness und verifizierte `authorizationRevision` wird keine Konfiguration ausgeliefert.   | `packages/plugin-ssf/tests/handler.test.ts` und `packages/auth-runtime/src/ssf-runtime-plugin-service.test.ts`                                                                                                                         |
| `SSF-RT-04` | Genau eine pluginlokale Auflösung implementiert Tenant → Server → Produktdefault und nachgelagerte Policies.                     | `packages/plugin-ssf/tests/resolver.test.ts`                                                                                                                                                                                           |
| `SSF-RT-05` | Nur wirksame Änderungen verändern `configurationRevision`.                                                                       | `packages/plugin-ssf/tests/{revision,resolver,handler}.test.ts` und der Write→Read-Integrationstest                                                                                                                                    |
| `SSF-RT-06` | Effektiv deaktivierte Gesprächsspeicherung liefert keine Frage und erlaubt keine abweichende Runtime-Semantik.                   | `packages/plugin-ssf/tests/{resolver,contracts}.test.ts`                                                                                                                                                                               |
| `SSF-RT-07` | HTML enthält keine unmittelbar ausführbaren Inhalte oder gefährlichen URL-Protokolle; zulässige externe Bilder bleiben erhalten. | `packages/plugin-ssf/tests/html.test.ts`                                                                                                                                                                                               |
| `SSF-RT-08` | Studio und Plugin liefern das feste V1-Schema innerhalb derselben Grenzen.                                                       | `packages/plugin-ssf/tests/{contracts,server}.test.ts` und `apps/sva-studio-react/src/lib/ssf-runtime-endpoint.server.test.ts`; Zod und OpenAPI importieren dieselben Konstanten.                                                      |
| `SSF-RT-09` | Ein erfolgreicher Write ist beim nächsten Read sichtbar; V1 besitzt keinen fachlichen Cache.                                     | `packages/plugin-ssf/tests/postgresql.integration.test.ts`                                                                                                                                                                             |
| `SSF-RT-10` | Logs, Metriken und Audit enthalten weder Token noch HTML noch Fremdtenantdaten.                                                  | `packages/auth-runtime/src/ssf-runtime-plugin-service.test.ts` prüft stabile Fehler und minimale Auditdaten; die Host-Response-Observability übernimmt nur validierte Revisionen und niedrig-kardinale Metrikattribute.                |
| `SSF-RT-11` | SSF-Persistenz nutzt im kanonischen Rollout ein getrenntes Migrations-, Backup- und Restore-Ziel und bleibt standardmäßig aus.   | `deploy/portainer/ssf-runtime-deployment.test.ts`, `deploy/backup-agent/agent.test.ts`, `scripts/ci/{backup-agent-contract,restore-agent-contract,submit-backup-agent-request,verify-backup-agent-capabilities}.test.ts`               |

## Liefergrenze

Der Merge dieses Changes beweist den Konfigurations- und API-Vertrag, aber
nicht die produktive SSF-Benutzerautorisierung. Der produktive Enablement-Nachweis
erfordert später zusätzlich:

- materialisierte `ssf_permissions`,
- eine verifizierte tenantweite `authorizationRevision`,
- Tenant-Benutzertokenclaim und Runtime-Revision mit identischem Wert,
- Session-Widerruf und erneute Tokenausstellung nach relevanten Änderungen.

Bis diese Nachweise vorliegen, bleibt die Runtime-Freigabe fail-closed.
Der freigegebene Nachfolge-Scope ist unter
[`add-ssf-iam-permission-projection`](../add-ssf-iam-permission-projection/proposal.md)
separat beschrieben.

Die getrackten Remote-Profile setzen `SSF_PLUGIN_DATABASE_ENABLED=false` und
`SVA_STUDIO_SSF_RUNTIME_ENABLED=false`. Der vorhandene Promote-Workflow führt
bei explizitem `SSF_POSTGRES_BACKUP_ENABLED=true` ein separates, verifiziertes
Backup der Plugin-Datenbank aus. Der kontrollierte Restore bindet dasselbe Ziel
an den festen Modus `ssf`; beide Pfade verwenden weiterhin den kanonischen
Rollout- beziehungsweise Recovery-Vertrag.
