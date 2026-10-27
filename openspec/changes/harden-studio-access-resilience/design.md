# Design: Studio-Zugriffsresilienz

## Ausgangslage und führende Grenzen

Untersuchungsbasis ist Studio `ecedfa460`. Die folgenden Pfade sind vorhandene Erweiterungspunkte, keine Zusage einer bereits behobenen Laufzeitstörung:

| Grenze                        | Zuständiger Pfad                                                                                              | Belegte Lücke                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Session → Requestkontext      | `packages/auth-runtime/src/auth-server/session-resolution.ts`                                                 | Refresh-Fallback lässt `activeOrganizationId` weg.                                                       |
| Parallele Session-Writes      | `packages/auth-runtime/src/redis-session-store.ts`, `packages/iam-admin/src/organization-mutation-context.ts` | Read/Merge/Full-SET kann fremde Feldänderungen überschreiben.                                            |
| Organisationsreads → UI       | `apps/sva-studio-react/src/hooks/use-organization-context.ts`                                                 | Antwortübernahme ohne Identitäts-/Sequenzprüfung.                                                        |
| Session-Recovery → Access     | `providers/auth-session-effects.ts`, `providers/effective-access-provider.ts`, `router.tsx` im Studio         | Unverbundene Refresh-Trigger und eigener Route-Read.                                                     |
| Credentialstatus → API-Fehler | `packages/sva-mainserver/src/server/mutation-principal-actor.ts`                                              | `partial_credentials` fällt auf 403 zurück; frühe Responses bleiben ohne Ergebnislog.                    |
| API → SDK → Fehleranzeige     | `content-route-core.ts`, `packages/plugin-sdk/src/mainserver-request.ts`                                      | Request-ID wird nicht durchgängig transportiert.                                                         |
| Veralteter Editor             | `packages/plugin-sdk/src/mainserver-client.ts`                                                                | Context-Binding bleibt nach Stale-Antwort verwendbar; erneuter Save kann denselben Konflikt wiederholen. |

Der externe Mainserver ist eine Blackbox. Seine bestehenden Antworten werden an der Studio-Fassade klassifiziert; neue Anforderungen gelten nur für Studio-eigene Antworten, interne Zustände und Verbraucher. Kein Test setzt eine Upstream-Änderung voraus.

## Abschnitt 1: Ein beobachtbares Studio-Ergebnis

### Klassifikation und Korrelation

Bestehende `createApiError`-, `errorJson`-, HTTP-/SDK-Fehlermetadaten und Request-Context-Helfer werden additiv vereinheitlicht. Bestehende flache und strukturierte Error-Envelopes bleiben kompatibel; kein globaler Body-Shape-Wechsel. `X-Request-Id` ist für vom Studio beantwortete geschützte API-Requests verpflichtend, auch bei vorzeitigem Return. Die serverseitig erzeugte oder bereits sicher validierte ID wird unverändert für Antwort und Ergebnislog verwendet; eine echte Trace-ID bleibt optional.

| Klasse                   | Beispiel                                                               | Studio-Verhalten                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Authentifizierung        | ungültige/abgelaufene Session                                          | 401; bestehende begrenzte Session-Recovery.                                                                                           |
| Autorisierung            | Permission oder zulässiger Principal fehlt                             | 403; konkrete sichere Action-Diagnose, kein Rollen-Bypass.                                                                            |
| Kontextkonflikt          | `stale_mainserver_context`, Revision-/Scope-Mismatch                   | bestehender Konfliktstatus; maschinenlesbarer Recheck-Hinweis.                                                                        |
| Credential-Konfiguration | `missing_credentials`, `partial_credentials`                           | stabiler Konfigurationsfehler; `partial_credentials` wird explizit als 400 abgebildet, niemals als Principal-Verbot.                  |
| Organisations-Readiness  | keine Credentials oder vorhandene, noch nicht freigegebene Credentials | bestehender 409-Code bleibt kompatibel; sicherer `reasonCode` unterscheidet fehlend, unvollständig, Verifikation/Abgleich ausstehend. |
| Infrastruktur            | DB/IdP/Provider nicht erreichbar                                       | 5xx und belastbare Retry-Klasse; keine Umklassifikation in fehlende Rechte.                                                           |

Jeder Status der bestehenden Principal-Auflösung wird exhaustiv abgebildet. Wo der bestehende Credential-Reader unterschiedliche Ursachen vor dem Mapper zusammenfasst, darf PR 1 sichere Grundcodes rein lesend additiv erhalten; die Entscheidung über Nutzbarkeit und jede Provisioning-/Recovery-Semantik bleiben unverändert. Freie Providertexte und Secretwerte werden weder als Diagnosefelder zurückgegeben noch operativ protokolliert. Überlappende Reader-/Mapper-Logs werden an der tatsächlich abschließenden Grenze konsolidiert.

### Ergebnisownership statt ausschließlich Exception-Logging

Die vorhandene Studio-Request-/Response-Grenze übernimmt den abschließenden Ergebnisnachweis auch dann, wenn ein Guard, CSRF-, Parse-, Principal- oder Readiness-Schritt eine `Response` zurückgibt. Exception- und Response-Pfad teilen dieselbe Ergebnisownership; vorhandene Security-/Audit-Ereignisse bleiben eigenständige Ereignisse und werden nicht entfernt.

Pflichtfelder: `event=studio.request.failed`, `request_id`, HTTP-Status, stabiler Fehlercode, sichere Route-Vorlage, Methode und Prüfphase. `instance_id`, Action und benötigter Principal-/Kontexttyp werden nur aus autoritativem Kontext ergänzt. Organisations-/Benutzer-IDs sind keine pauschalen Pflichtfelder; redigierte oder nicht identitätshaltige Generationen reichen, solange keine dokumentierte Betriebsnotwendigkeit besteht. Keine freien URLs, Querystrings, Bodies, Cookies, Token, Credential-Fingerprints oder Formulartexte im neuen Diagnosevertrag; keine hochkardinalen Log-Labels.

Für jeden zurückgegebenen Auth-, Autorisierungs-, Kontext-, Readiness- oder Infrastrukturfehler entsteht genau ein abschließendes operatives Ergebnisereignis: erwartete Ablehnungen höchstens `warn`, unerwartete 5xx als `error`. Normale Feldvalidierung wird nicht einzeln zentral gemeldet. Die Fehleranzeige erhält eine kopierbare Referenz mit lokalisierter, zugänglicher Ursache und Folgeaktion.

### Verbraucher und Abdeckung

| Studio-Eintritt                                            | Verpflichtender Nachweis in PR 1                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `/auth/me`, geschützte Auth-/Sessionhandler                | 401/5xx inklusive früher Middleware-Antwort korreliert.                                   |
| `/iam/authorize`, `/iam/me/permissions`, `/api/v1/iam/...` | Ablehnung, Kontext-/Dependency-Fehler und Exception; bestehende Auditspur erhalten.       |
| `/api/v1/mainserver/...`                                   | Principal-/Credential-Preflight, Ressourcenverbot, Upstream- und Folgeschrittfehler.      |
| Host-Dispatcher für Plugin-Handler                         | Frühe Tenant-/Modul-/Ressourcenablehnung vor Plugin-Ausführung.                           |
| Gemeinsame Studio-Clients und Plugin-SDK                   | Request-ID und Klassifikation gehen nicht durch Error-Factory/Übersetzung verloren.       |
| Root-ErrorBoundary und Browser-HTTP-Grenze                 | Browser-only-Fehler werden von bereits serverseitig gemeldeten Ergebnissen unterschieden. |

Diese Inventur liegt hier, nicht in einer neuen Registry oder einem neuen CI-Gate. Vor Umsetzung werden konkrete bestehende Tests je Zeile zugeordnet. Öffentliche Kalender, Webhooks, Scheduler und fremde Programme erhalten keinen pauschalen neuen Meldevertrag.

### Minimaler Browser-Meldepfad

Die gezeigten Browserlogger besitzen keinen zentralen Export. Unmittelbare Verbraucher sind Root-ErrorBoundary und gemeinsame HTTP-Clients bei Renderfehler, lokalem Timeout oder nicht beim Server angekommenem Netzwerkfehler. Daher wird im bestehenden Studio-Monitoring genau ein Host-Handler für `POST /api/v1/monitoring/client-errors` ergänzt; ein weiteres Telemetriepaket oder ein neuer Dienst wäre für diese Lücke nicht erforderlich.

- Gültige Studio-Session, bestehende Same-Origin-/CSRF-Prüfung und serverseitige Instanzbindung; keine zusätzliche Admin-Permission für das Melden eigener Betriebsfehler.
- Striktes Schema, höchstens 2 KiB Payload; erlaubte Felder: zufällige `clientEventId`, freigegebene Fehlerklasse, statische Route-ID, Zeitpunkt und optionale sicher validierte `relatedRequestId`. Kein Freitext, Stack, Formularzustand oder Browser-Fingerprint.
- Ereignis `studio.client.failure_reported` mit `source=client`; Angaben bleiben unbestätigte Client-Beobachtungen und erzeugen keine autoritative Security-/Auditentscheidung. Die Empfangsanfrage besitzt eine eigene serverseitige Request-ID.
- Vorhandenen Rate-Limit-Pfad mit einem eigenen Telemetrie-Scope/Bucket verwenden: höchstens 20 Annahmen je authentifiziertem Account und Minute, ohne fachliche Read-/Write-Budgets zu verbrauchen. Deduplizierung ist atomar an serverbestimmte Instanz, Account und `clientEventId` gebunden; dieselbe ID wird je Scope im Fünf-Minuten-Fenster höchstens einmal als operatives Ereignis angenommen. Grenzüberschreitung liefert 429 ohne rekursive Fehlermeldung des Telemetrieclients.
- Annahmebudget und Deduplizierung werden bereits in PR 1 für die vorhandene unterstützte Prozess-/Deploymenttopologie nachgewiesen. Prozesslokale Zähler gelten nur bei belegtem Einzelprozessbetrieb als vollständiger Schutz; keine neue Skalierungstopologie oder allgemeine Koordinationsinfrastruktur.
- Im Browser höchstens zehn nicht sensitive Meldungen fünf Minuten im Speicher halten. Nach Offlinezustand oder Session-Recovery höchstens ein erneuter Versuch je Meldung; keine dauerhafte Queue, kein Polling, kein erzwungener Login durch Telemetrie. Bei Logout, User-/Tenantwechsel und Ablauf verwerfen.
- Eine bereits korrelierte API-Ablehnung wird nicht als zweiter Browser-Betriebsfehler gesendet. Ein Annahme-ACK bedeutet nicht „in Loki zugestellt“; gescheiterte Telemetrie darf die Fachaktion nicht blockieren.

### Abnahme von Diagnose

Unit-/Handler-Tests prüfen genau ein Ergebnisereignis und identische ID in Header, SDK und Anzeige. Ein gesondert freigegebener Staging-Nachweis löst eine sichere Ablehnung aus und findet dieselbe ID tatsächlich in Loki. Exportausfälle und verworfene Meldungen werden mit vorhandenen Monitoringmitteln erkennbar gemacht. Keine neue persistente Log-Infrastruktur und keine Zusage verlustfreier Zustellung.

## Abschnitt 2: Konsistenter Sessionzustand

### Autoritativer Zustand und atomare Änderungen

`Session.expiresAt`, absolute Maxdauer, Verschlüsselung, Widerrufsmarker und Session-Cookie bleiben führend wie in ADR-023. Der Refresh-Fallback bildet sein Ergebnis über denselben vollständigen Kontextpfad wie der Normalfall. Ein Dependency-Ausfall darf keinen persönlichen Kontext als Ersatz für eine gesetzte Organisation erfinden.

Der bestehende Redis-Store verwendet für Updates einen atomaren Compare-and-Set auf den tatsächlich gelesenen gespeicherten Stand. Nach einem Konflikt werden aktuelle Daten erneut gelesen und nur die eigenen Feldänderungen auf eine noch gültige, nicht gelöschte Session angewendet. Die Zahl der Wiederholungen ist begrenzt; nach erneutem Konflikt wird ein klassifizierter transienter Fehler zurückgegeben. Ein Redis-Fehler erlaubt keinen lokalen Erfolgsfallback. Gesondert gespeicherte Session-Control-/Widerrufsmarker gehören ebenfalls zum Commit-Nachweis: CAS ausschließlich auf dem Session-Key genügt nicht, wenn ein Marker die noch vorhandene Session inzwischen ungültig gemacht hat. Kein neuer allgemeiner Lock-Service und keine SQL-Tabelle.

Token-Refresh darf nicht mit einem veralteten Tokenpaket nach einem konkurrierenden erfolgreichen Refresh committen. Innerhalb des vorhandenen Sessionpfads werden Refreshes für dieselbe Session zusammengeführt und vor externem Refresh beziehungsweise nach dem Warten aktuelle Daten gelesen. Bei Koordination über einen vorhandenen Redis-Claim sind Ablauf, Owner-Prüfung und Löschung zu beachten; eine abgelaufene Claim allein berechtigt keinen späteren veralteten Commit.

Die Implementierung beginnt mit einem Nachweis der tatsächlich unterstützten App-Prozesstopologie aus dem bestehenden Deploymentvertrag. Prozesslokales Single-flight darf nur für eine belegte Einzelprozess-Topologie als vollständige Refresh-Koordination gelten. Mehrere unterstützte Prozesse benötigen dieselbe Invariante an Redis, aber kein neues Mehrreplika-Betriebsmodell und keine synthetische Skalierungsplattform. Ist der notwendige Schutz im bestehenden Store nicht möglich, Abschnitt stoppen und den Entwurf verkleinern.

### Organisationswechsel im Browser

Der bestehende Organisationsprovider führt Identität und Sequenz gemeinsam. Reads und Writes dürfen nur für den aktuellen Benutzer, Tenant und die aktuelle Anfragegeneration publizieren. Wechsel werden serialisiert; ein überholter GET darf einen bestätigten Wechsel nicht zurücksetzen. Logout und Userwechsel invalidieren laufende Ergebnisse. Bei unklarem Write-Ergebnis wird zuerst der aktuelle Kontext gelesen; ein Organisationswechsel wird nicht blind erneut geschrieben.

### Zu prüfende Interleavings

- Refresh A und Organisationswechsel B lesen denselben Sessionstand; beide Commit-Reihenfolgen erhalten Token und Organisation.
- Zwei Refreshes im Ablaufzeitfenster führen zu einem maßgeblichen neuen Tokenstand.
- Logout/Widerruf liegt zwischen Read und Commit: kein Wiederanlegen oder Wiederbeleben; zusätzlich ein geänderter separater Control-Marker bei noch vorhandenem Session-Key.
- Temporärer Refreshfehler vor Ablauf erhält Organisation; nach fachlichem Ablauf keine Freigabe.
- Alter Kontext-GET endet nach neuem Kontext-PUT; neuer Zustand bleibt sichtbar.
- Zwei Wechsel, Logout oder anderer Benutzer derselben Instanz überholen einen laufenden Read.

## Abschnitt 3: Aktuelle UI-Entscheidung und sichere Wiederaufnahme

### Ein Snapshot für Routen und Aktionen

Der bestehende EffectiveAccessProvider bleibt einziger Browserowner der effektiven Rechte. Auth-Refresh, Organisationsread und Access-Read bleiben getrennte Schritte, erhalten aber eine gemeinsame nachvollziehbare Identitäts-/Kontextgeneration. Route-Guards konsumieren dieselbe aufgelöste Quelle; der bisherige unabhängige Route-Read wird im selben PR ersetzt. Kein neuer Provider und kein Ableiten von Freigaben aus `/auth/me.permissionActions`.

Bei Fokus/Wiederaufnahme, erfolgreicher Session-Recovery, Identitäts-/Tenant-/Organisationswechsel und lokalen IAM-Mutationen wird einmal je Anlassgruppe revalidiert. Nach tatsächlicher Wiederaufnahme bleibt die alte Generation bis zum Recheck nicht mutierbar. Gleichnamige Rollen oder Module verhindern die Revalidierung nicht. Während Wechsel/Recheck bleiben bestehende lesbare Flächen und ungespeicherte Eingaben erhalten; Mutationen sind fail-closed.

### Fehlergesteuerte Recovery

- Ressourcen-/Ownership-403: konkrete Aktion ablehnen und erklären; kein globaler Access-Refetch und kein Session-Login allein aufgrund des Status.
- Explizite Scope-/Snapshot-Stale-Codes: zentral dedupliziert invalidieren; nach abgeschlossenem Versuch kein automatischer zweiter Durchlauf ohne neuen Anlass oder Nutzeraktion.
- `stale_mainserver_context`: Context-Binding und betroffene Ressourcen-Capabilities sofort verwerfen, aktuellen Organisationskontext und danach Detail/Access neu lesen; schreibende Wiederholung ausschließlich nach erneuter ausdrücklicher Nutzeraktion.
- Im anderen Tab gewechselte Organisation: kein stilles Umschreiben des bestehenden Entwurfs auf einen anderen Principal. Ursache und aktueller Kontext werden angezeigt; der Nutzer bestätigt den Wechsel vor einem erneuten Save oder kehrt bewusst zurück. Form-/Medienrevision und bestehender Verlassensschutz bleiben erhalten.
- Bei unklarem oder bestätigtem Upstream-Ergebnis bestehendes Journal/Read-back verwenden. Ein Telemetrie- oder nachgelagerter Projectionfehler rechtfertigt kein zweites Create.

### Readiness vor Create

Die bestehende Studio-Principal-/Kontextprojektion liefert für den ausgewählten Principal eine sichere lokale Readiness samt Grundcode; keine Secretwerte. Technische globale Mutation-Capabilities bleiben Fähigkeiten des Adapters und werden nicht zu einer Ownership-Aussage umgedeutet. Berechtigungsprüfung, Autorenpolicy und Readiness sind additive Voraussetzungen.

Fehlt die Permission, wird die ausführbare Aktion ausgeblendet. Besteht das Recht, aber die lokale Anbindung ist nicht bereit, bleibt der Entwurf zugänglich und Save wird begründet gesperrt. Nach expliziter Behebung/Neuladen wird neu geprüft. Die Projektion startet weder Credential-Recovery noch Tokenprobe, Provisionierung oder Mutation beim externen Mainserver. Lokales `ready` ist keine Garantie für den nächsten Upstream-Aufruf; der Server prüft vor jedem tatsächlichen Schreiben erneut.

### Nachweismatrix

Mindestens: `system_admin` mit vollständigen und fehlenden Grants; Custom-Role mit Read-only beziehungsweise Create; eigene/organisationsgebundene Ressourcenrechte; fehlendes Modul; persönlicher und organisatorischer Principal; `org_only` und `org_or_personal`; ready/partial/nicht verifiziert; Dependency-Ausfall; zwei Tabs; Ablauf während Editor und Save. Gleichartige Standard-Content-Plugins werden über bestehende gemeinsame SDK-/Host-Grenzen geprüft; plugin-eigene Abweichungen erhalten gezielte Tests, keinen pauschalen Formularumbau.

## Lieferfähigkeit, Dokumentation und Rollout

Abschnitt 1 ändert die Entscheidung über Berechtigungen noch nicht; Abschnitt 2 funktioniert mit der heutigen UI; Abschnitt 3 konsumiert beide vorhandenen Verträge. Daher sind drei sequenzielle PRs mit jeweils aktuellem `main` als Basis belastbar und ein Stack ist unnötig. Keine Folgeimplementierung auf bekannt rotem Abschnittsstand.

Jeder PR aktualisiert die betroffenen arc42-Abschnitte 04/05/06/08, erforderliche ADR-Fortschreibungen samt 09 und konkrete Runbooks/UI-Dokumentation. Fehlerreferenzen und Readiness-Hinweise werden in Deutsch und Englisch gepflegt. `docs/reference/ui-access-server-enforcement.md` und ADR-050 stimmen nach PR 3 mit der gewählten Ressourcen-403-Policy überein.

Rollout nur über den bestehenden Build→Dev→Staging→Production-Prozess. Vor Live-Fehlerinjektion werden Umgebung, Account und Wirkung konkret freigegeben. Keine externen Mainserver-Writes durch diesen Proposal-Auftrag. Die Implementierung führt Redis-Kompatibilität und Rollback ohne Änderung der fachlichen Ablaufgrenze nach; für additive Browser-/Fehlermetadaten bleibt der alte Verbraucherpfad kompatibel.
