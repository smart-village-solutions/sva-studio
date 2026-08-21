# Inventur der serverseitigen Logging-Diagnostik

Stand: 21. August 2026

## Änderungsbasis

Der Implementierungszweig basiert auf `origin/main` am Commit `210a87f6b`. Damit ist der aktuelle Code des weitgehend abgeschlossenen Changes `refactor-iam-content-list-projection` enthalten. Der weiterhin aktive Change `refactor-cross-cutting-runtime-guardrails` wurde gegen seinen aktuellen Vertrag geprüft: Diese Änderung bleibt transportneutral und verändert weder OTEL-Bootstrap noch Exporter oder den normativen Production-Transport.

## Produktive Ausgangsstichprobe

Die Baseline wurde im Loki-Datasource `7k9q2XRGz` für `{swarm_service="studio_app"}` erhoben. Der feste Zeitraum ist `2026-08-20T20:00:00Z` bis `2026-08-21T20:00:00Z`. Gezählt wurden erfolgreich als JSON geparste Ereignisse im beobachteten Modus `console_to_loki`; Rohzeilen und sensible Werte wurden nicht in den Bericht übernommen.

- Gesamtmenge: 31.017 strukturierte Ereignisse
- Level: 17.121 `info` (55,20 %), 13.521 `debug` (43,59 %), 354 `error` (1,14 %), 21 `warn` (0,07 %)
- Request-Korrelation über alle strukturierten Ereignisse: 442 von 31.017 (1,43 %)
- HTTP-nahe Ereignisse mit befülltem `method`: 6.820; davon mit Request-ID: 0 (0,00 %)
- Identitätshaltiges Feld `projection_scope_key`: 2.954 Vorkommen; Werte wurden nicht exportiert

### Häufigste Messages

| Message                                      | Anzahl |
| -------------------------------------------- | -----: |
| `SVA Mainserver credential cache hit`        |  6.512 |
| `SVA Mainserver GraphQL operation succeeded` |  3.799 |
| `SVA Mainserver token cache hit`             |  3.798 |
| `Routing handler dispatched`                 |  3.404 |
| `Routing handler completed`                  |  3.404 |
| `Loading SVA Mainserver instance config`     |  2.968 |
| `SVA Mainserver instance config loaded`      |  2.968 |
| `mainserver_projection_page_loaded`          |  2.952 |
| `SVA Mainserver credential cache miss`       |    241 |
| `SVA Mainserver credentials loaded`          |    241 |

### Bekannte Doppellogs

Im selben Zeitraum traten `tenant_auth_resolution_failed` und `Auth route failed during tenant auth resolution` jeweils 171-mal auf. Das ist die gleiche Fehlerklasse an innerer und äußerer Grenze. Außerdem erschienen `Auth callback failed` und `tenant_auth_callback_result` für denselben seltenen Callback-Fehler jeweils einmal. Die Umsetzung entfernt die inneren kanonischen Fehlerereignisse und behält je Kette das Ergebnis an der Routengrenze.

## Ownership- und Level-Inventur

| Ereignisklasse                            | Verantwortliche Grenze                              | Vorher                                                             | Ziel                                                                                            | Erlaubter Kontext                                                                                  |
| ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| unbehandelter HTTP-Dispatchfehler         | Server-Entry beziehungsweise fachliche Routengrenze | Request-Kontext abhängig vom Dispatcher                            | genau ein kanonisches Endereignis                                                               | Request-ID, optionale echte Trace-ID, Route, Methode, stabiler Fehlercode                          |
| Auth-Konfigurations- und Tenant-Auflösung | äußere Auth-Routengrenze                            | innere Auflösung und Route konnten denselben Fehler protokollieren | innere Schicht klassifiziert und propagiert; Route protokolliert einmal                         | Host, Pfad, Scope, Status, stabiler Reason-Code; keine vollständige URL oder Provider-Beschreibung |
| Auth-Callback                             | Callback-Routengrenze                               | mehrere Fehlerereignisse pro Ergebnis                              | ein `tenant_auth_callback_result`                                                               | Status, Retry-Klasse, stabiler OAuth-Code, sichere Pfade                                           |
| Mainserver-Read                           | Mainserver-Routengrenze                             | Erfolg und Pagination auf `info`                                   | `debug`                                                                                         | Operation, Inhaltsart, Anzahl, Request-/Trace-ID im Body                                           |
| Mainserver-Mutation                       | Mainserver-Routengrenze                             | `info`                                                             | `info` bleibt erhalten                                                                          | Operation, Ergebnis, technische Inhalts- und Instanz-ID                                            |
| Mainserver-Fehler                         | Mainserver-Routengrenze                             | überwiegend `warn`, zusätzliche Client-Fehlerlogs                  | erwartbarer 4xx `warn`, interner beziehungsweise 5xx `error`, kein doppeltes Client-Endereignis | stabiler Fehlercode, HTTP-Status, Operation, Request-/Trace-ID                                     |
| Retry                                     | ausführender Mainserver-Client                      | `warn` mit teilweise freiem Fehlertext                             | eigenes begrenztes `warn`-Ereignis                                                              | Retry-Klasse, Delay, Status oder Error-Typ; kein freier Provider-Text                              |
| Cache, Token, Credential, Config, Health  | jeweilige Runtime-Komponente                        | teilweise `info`                                                   | `debug`                                                                                         | Cache-Zustand, Operation, technische Instanz-ID                                                    |
| Job-Abbruchabfrage                        | Job-Ausführungskontext                              | Fehler verworfen                                                   | höchstens eine Warnung und eine Recovery je Ausführung                                          | Job-/Execution-ID, stabiler Fehlercode, Folgebehandlung                                            |
| Persistenz des Job-Fehlerzustands         | Job-Lifecycle-Orchestrator                          | nur geworfener Sekundärfehler                                      | eigenes sekundäres `error`-Ereignis                                                             | Job-/Execution-ID, stabiler Fehlercode, Finalitätsflag                                             |

## Datenschutzgrenze

- Schlüssel werden für Redaction hinsichtlich Groß-/Kleinschreibung und `-`, `_`, `.` normalisiert.
- Account-, Actor-, Subject-, User-, Session- und Credential-Aliase sowie `projection_scope_key` werden redigiert.
- HTTP-Metadaten verwenden ausschließlich query-freie Pfade.
- Request-, Trace-, Job- und Execution-IDs bleiben im Log-Body und werden nicht als OTEL-/Loki-Labels zugelassen.
- Request-Payloads, Tokens, vollständige URLs und freie Provider-Fehlerbeschreibungen bleiben ausgeschlossen.

## Laufzeitabnahme

Vor einem Rollout sind dieselben Abfrageklassen für Gesamtmenge, Level-Verteilung, Request-Korrelation, Top-Messages und bekannte Doppellogs mit festen Zeitgrenzen zu sichern. Nach dem Rollout wird der identische Zuschnitt wiederholt. Eine Freigabe setzt voraus, dass HTTP-Ereignisse eine Request-ID tragen, vorhandene Trace-IDs valide sind, repräsentative Fehlerketten genau ein kanonisches Endereignis erzeugen und routinemäßige Reads nicht mehr auf `info` erscheinen.
