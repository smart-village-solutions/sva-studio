# Assurance: SSF-Runtime-Konfiguration V1

Dieses Dokument hält nur die systemübergreifenden Invarianten und ihre
geplanten Nachweise fest. Detailtests verbleiben in den jeweiligen Tasks.

| ID          | Invariante                                                                                                                       | Nachweis im ersten Slice                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSF-RT-01` | Ein Request kann ausschließlich den nach Service-Authentisierung hostgebundenen Tenant lesen.                                    | `packages/plugin-ssf/tests/postgresql.integration.test.ts` belegt RLS und SQL-Prädikate; Header-/Dispatcher-Nachweis folgt mit der Plattformintegration. |
| `SSF-RT-02` | Ohne gültiges Service-Token mit exaktem Issuer, Audience, Client und Action wird keine Plugin-Logik ausgeführt.                  | `packages/auth-runtime/src/{service-token,ssf-runtime-service-token}.test.ts`; der Dispatcher-Spy folgt mit dem Service-Zugriffstyp.                     |
| `SSF-RT-03` | Ohne aktive Instanz, aktives Plugin, Readiness und verifizierte `authorizationRevision` wird keine Konfiguration ausgeliefert.   | `packages/plugin-ssf/tests/handler.test.ts` blockiert ungültige Revisionen vor dem Read; Instanz-/Aktivierungs-Gates folgen mit dem Host-Dispatcher.     |
| `SSF-RT-04` | Genau eine pluginlokale Auflösung implementiert Tenant → Server → Produktdefault und nachgelagerte Policies.                     | `packages/plugin-ssf/tests/resolver.test.ts`                                                                                                             |
| `SSF-RT-05` | Nur wirksame Änderungen verändern `configurationRevision`.                                                                       | `packages/plugin-ssf/tests/{revision,resolver,handler}.test.ts` und der Write→Read-Integrationstest                                                      |
| `SSF-RT-06` | Effektiv deaktivierte Gesprächsspeicherung liefert keine Frage und erlaubt keine abweichende Runtime-Semantik.                   | `packages/plugin-ssf/tests/{resolver,contracts}.test.ts`                                                                                                 |
| `SSF-RT-07` | HTML enthält keine unmittelbar ausführbaren Inhalte oder gefährlichen URL-Protokolle; zulässige externe Bilder bleiben erhalten. | `packages/plugin-ssf/tests/html.test.ts`                                                                                                                 |
| `SSF-RT-08` | Studio und Plugin liefern das feste V1-Schema innerhalb derselben Grenzen.                                                       | `packages/plugin-ssf/tests/contracts.test.ts`; Zod und OpenAPI importieren dieselben Konstanten.                                                         |
| `SSF-RT-09` | Ein erfolgreicher Write ist beim nächsten Read sichtbar; V1 besitzt keinen fachlichen Cache.                                     | `packages/plugin-ssf/tests/postgresql.integration.test.ts`                                                                                               |
| `SSF-RT-10` | Logs, Metriken und Audit enthalten weder Token noch HTML noch Fremdtenantdaten.                                                  | Folgt mit dem Host-Endpoint; der erste Slice veröffentlicht noch keine Request-Logs oder Auditereignisse.                                                |

## Liefergrenze

Der Merge dieses Changes beweist den Konfigurations- und API-Vertrag, aber
nicht die produktive SSF-Benutzerautorisierung. Der produktive Enablement-Nachweis
erfordert später zusätzlich:

- materialisierte `ssf_permissions`,
- eine verifizierte tenantweite `authorizationRevision`,
- Tokenclaim und Runtime-Revision mit identischem Wert,
- Session-Widerruf und erneute Tokenausstellung nach relevanten Änderungen.

Bis diese Nachweise vorliegen, bleibt die Runtime-Freigabe fail-closed.
