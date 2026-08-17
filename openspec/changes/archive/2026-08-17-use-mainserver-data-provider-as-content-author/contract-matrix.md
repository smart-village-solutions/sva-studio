# Mainserver-Vertrags- und Capability-Matrix

## Verbindliche Querschnittsregeln

- Jede Mutation benötigt die angegebene fully-qualified Action und einen expliziten `actingPrincipalType`.
- Bestehende Inhalte werden unmittelbar vor dem Write mit demselben gebundenen Credential-Kontext gelesen. Der Read liefert den sicherheitskritischen `dataProvider`; Projection und Cache autorisieren keine Mutation.
- Vor normalen Content-Creates bindet `/data_provider.json` die aktuelle Credential-Version. `dataProvider.id` aus Mutation-Response oder unmittelbarem Same-Credential-Re-Read bestätigt diese Bindung. Nur die gesonderte, vertraglich garantierte Benutzer-Provisioning-Antwort für neue Organisations-Credentials darf eine Erstbindung begründen.
- Ein bestätigter Provider-Erfolg bleibt fachlicher Erfolg. Lokale Projection-, Binding-, Audit- oder History-Fehler führen zu `reconciliation_required`.
- Hard Delete verwendet das persistierte Preimage und benötigt keinen Post-Delete-Read.
- Create ist ohne idempotenten Upstream-Schlüssel bei verlorener Response potenziell duplizierend. Projects verwenden dagegen `externalId` als stabilen Schlüssel.
- Die Autorenrichtlinie steuert den Create-Principal, nicht die Read-Sicht. Mit `accessScope = organization` umfasst diese unabhängig von `org_only` oder `org_or_personal` die eigenen und die Inhalte der aktiven Organisation; persönliche Inhalte anderer Mitglieder erfordern eine ausdrückliche `all`- oder Moderationsberechtigung.
- Persönliche und organisatorische Credential-Sichten werden getrennt synchronisiert und vor globaler Sortierung und Pagination dedupliziert vereinigt. Jeder Teilausfall wird unabhängig von vorhandenen alten Snapshots sichtbar als unvollständiges Ergebnis ausgewiesen und erweitert keine Mutationsberechtigung.

## Reale Vertragsevidenz

Am 7. August 2026 wurde der aktuell konfigurierte Mainserver mit einem technischen
Credential ausschließlich lesend geprüft:

- OAuth-Tokenabruf: HTTP 200;
- GraphQL-Root-Abfrage: HTTP 200 mit Query-Root;
- `/data_provider.json`: live bestätigt als HTTP-200-Objekt `{ "data_provider": { "id": 832, ... } }`; Ganzzahl-ID wird auf String normalisiert und war in zwei aufeinanderfolgenden Reads stabil. Persönliche/organisatorische Kardinalität und Credential-Rotation bleiben als reale Contract-Gates offen.
- Benutzer-Provisioning: Der Mainserver-API-Vertrag garantiert, dass `data_provider_id` der erfolgreichen Provisioning-Antwort mit `data_provider.id` aus `/data_provider.json` unter exakt den neu erzeugten Credentials identisch ist. Die reale persönliche/organisatorische Contract-Ausführung bleibt Teil des offenen destruktiven Matrixlaufs.

Damit ist der in diesem Change vorausgesetzte Übergangsvertrag real bestätigt. Vor dem
Production-Cutover bleibt ein begrenzter Staging-Canary mit getrennten persönlichen und
organisatorischen Credentials erforderlich. Er prüft beide Bindungen, je einen positiven
Create-/Bestandsmutationspfad, einen Cross-Principal-Negativfall, den unveränderten
ursprünglichen DataProvider und neue ungeklärte Reconciliation-Fälle. Die vorhandenen
typisierten Adapter-, Lifecycle- und Capability-Tests decken die übrigen Kombinationen ab;
ein destruktives reales Kreuzprodukt aller Content-Typen und Aktionen ist kein Cutover-Gate.

### Rebaseline vom 12. August 2026

Die getrackten Remote-Profile stehen aktuell in Development und Staging auf
`automatic`, während Production weiterhin `shadow` verwendet. Die Staging-Telemetrie
bestätigt Aufrufe im automatischen exakten Modus für den persönlichen Principal. Im
geprüften Zeitraum lag jedoch kein belastbarer Nachweis für eine Mutation mit
`actingPrincipalType = organization` vor. Loganzahlen sind wegen paralleler
DB-/OTEL-Ausleitung nicht als Anzahl eindeutiger Operationen zu interpretieren.

Damit belegt der aktuelle Staging-Zustand noch nicht die vollständige persönliche und
organisatorische Contract-Matrix. Der bereits konfigurierte automatische Modus ist jedoch
als Produktentscheidung akzeptiert und muss deshalb nicht allein wegen dieser offenen
Evidenz zurückgerollt werden. Vor einer Production-Aktivierung MUSS die offene Evidenz
nachgeholt werden.

Ein Teil der Staging-Logs trägt derzeit zusätzlich `environment = production`. Bis zur
Korrektur dieses Telemetriefehlers müssen Nachweise über die eindeutigen Stack- und
Service-Labels dem Staging-Deployment zugeordnet werden.

## Typ-/Aktionsmatrix

| Content-Typ   | Studio-Action                        | Mainserver-Operation                                  | Pre-Read         | DataProvider-Vertrag                                                          | Lifecycle und Idempotenz                                       | Cross-Principal und Reconciliation                             | Capability                                                              |
| ------------- | ------------------------------------ | ----------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| News          | `news.create`                        | `SvaMainserverCreateNews`                             | nein             | Identity bindet vorab; Response oder Same-Credential-Re-Read bestätigt        | nicht idempotenter Create; Lost Response wird journalisiert    | Create-Provider-Konflikt erzeugt `reconciliation_required`     | aktiv                                                                   |
| News          | `news.update`                        | `SvaMainserverCreateNews` mit ID                      | ja               | Read und Response selektieren `dataProvider`; Update darf ihn nicht ändern    | Read-Merge-Write; Visibility ist ein korrelierter Zweitschritt | exakter Scope oder credential-sichtbare Kompatibilität         | aktiv                                                                   |
| News          | `news.delete`                        | `SvaMainserverDestroyNews`                            | ja               | Preimage-Provider wird vor Delete persistiert                                 | Hard Delete; Operation/Tombstone idempotent finalisierbar      | kein Post-Read; verlorene Response bleibt `unknown`            | aktiv                                                                   |
| Events        | `events.create`                      | `SvaMainserverCreateEvent`                            | nein             | Identity bindet vorab; Response oder Re-Read bestätigt                        | nicht idempotenter Create                                      | Konflikt erzeugt lokale Reconciliation                         | aktiv                                                                   |
| Events        | `events.update`                      | `SvaMainserverCreateEvent` mit ID                     | ja               | typisierter Read/Response-Provider                                            | Read-Merge-Write                                               | Cross-Principal nur nach Same-Credential-Read                  | aktiv                                                                   |
| Events        | `events.delete`                      | `SvaMainserverDestroyRecord`                          | ja               | Provider aus Preimage                                                         | Hard Delete                                                    | Tombstone; kein Post-Read                                      | aktiv                                                                   |
| POI           | `poi.create`                         | `SvaMainserverCreatePoi`                              | nein             | Identity bindet vorab; Response oder Re-Read bestätigt                        | nicht idempotenter Create                                      | Konflikt erzeugt lokale Reconciliation                         | aktiv                                                                   |
| POI           | `poi.update`                         | `SvaMainserverCreatePoi` mit ID                       | ja               | typisierter Read/Response-Provider                                            | Read-Merge-Write                                               | Cross-Principal nur nach Same-Credential-Read                  | aktiv                                                                   |
| POI           | `poi.delete`                         | `SvaMainserverDestroyRecord`                          | ja               | Provider aus Preimage                                                         | Hard Delete                                                    | Tombstone; kein Post-Read                                      | aktiv                                                                   |
| Generic Item  | `generic-items.create`               | `SvaMainserverCreateGenericItem`                      | nein             | Identity bindet vorab; Response oder Re-Read bestätigt                        | ohne `externalId` potenziell duplizierend                      | Konflikt erzeugt lokale Reconciliation                         | aktiv                                                                   |
| Generic Item  | `generic-items.update`               | `SvaMainserverCreateGenericItem` mit ID               | ja               | typisierter Read/Response-Provider                                            | Payload Read-Merge-Write                                       | Cross-Principal nur nach Same-Credential-Read                  | aktiv                                                                   |
| Generic Item  | `generic-items.delete`               | `SvaMainserverDestroyRecord`                          | ja               | Provider aus Preimage                                                         | Hard Delete                                                    | Tombstone; kein Post-Read                                      | aktiv                                                                   |
| FAQ           | `faq.create/update/delete`           | Generic-Item-Operationen                              | wie Generic Item | wie Generic Item                                                              | `genericType = FAQ`; sonst gleicher Vertrag                    | wie Generic Item                                               | aktiv                                                                   |
| Cockpit Cards | `cockpit-cards.create/update/delete` | Generic-Item-Operationen                              | wie Generic Item | wie Generic Item                                                              | `genericType = COCKPIT_CARD`; sonst gleicher Vertrag           | wie Generic Item                                               | aktiv                                                                   |
| Projects      | `projects.create`                    | `SvaMainserverCreateGenericItem`                      | nein             | Identity bindet vorab; Response oder Re-Read bestätigt                        | `externalId` ist stabiler Create-/Reconciliation-Schlüssel     | Konflikt erzeugt lokale Reconciliation                         | aktiv                                                                   |
| Projects      | `projects.update`                    | `SvaMainserverCreateGenericItem` mit ID               | ja               | Provider bleibt ausschließlich Mainserver-Feld                                | Payload Read-Merge-Write plus Visibility-Zweitschritt          | beide Schritte verwenden denselben Principal-Kontext           | aktiv                                                                   |
| Projects      | `projects.delete`                    | `SvaMainserverCreateGenericItem` mit ID               | ja               | Provider aus Preimage                                                         | Soft Delete im Payload plus Visibility-Zweitschritt            | kein Hard-Delete-Tombstone; Partial Success wird journalisiert | aktiv                                                                   |
| Surveys       | `surveys.create`                     | `SvaMainserverCreateOrUpdateSurvey` ohne ID           | nein             | Identity-ID bindet vorab; Response oder Re-Read bestätigt den Content-Inhaber | Upsert-Create ohne belegten Idempotenzschlüssel                | Konflikt erzeugt lokale Reconciliation                         | durch bewusste Produktentscheidung aktiv; reale Evidenz wird nachgeholt |
| Surveys       | `surveys.update`                     | `SvaMainserverCreateOrUpdateSurvey` mit ID            | ja               | Provider-Selektion ist typisiert; Immutabilität ist upstream nicht bestätigt  | Upsert                                                         | bis zum realen Nachweis fail-closed                            | `surveys.update` erforderlich                                           |
| Surveys       | `surveys.delete`                     | `SvaMainserverCreateOrUpdateSurvey` mit Destroy-Input | ja               | Provider aus Preimage; Löschsemantik upstream zu bestätigen                   | Hard-Delete-Verhalten nicht real bestätigt                     | bis zum realen Nachweis fail-closed                            | `surveys.delete` erforderlich                                           |
| Surveys       | `surveys.moderate`                   | Release/Delete Free-Text-Response                     | ja               | Survey-Provider aus Pre-Read                                                  | untergeordnete Mutation, kein Providerwechsel erwartet         | bis zum realen Cross-Principal-Nachweis fail-closed            | `surveys.moderate` erforderlich                                         |

## Separate Lifecycle-Autorisierung

Eine Update-Berechtigung ersetzt kein Lifecycle-Recht. Wenn eine Mutation zugleich
Fachdaten und Lifecycle ändert, müssen die fachliche Action und jede zutreffende
Lifecycle-Action mit demselben `MutationPrincipalContext`, demselben Pre-Read und
demselben DataProvider erlaubt sein. Fehlt eine der Actions, findet kein
Provider-Write statt.

| Übergang                                                                     | zusätzliche Action                 | betroffene Adapter                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| Entwurf oder unsichtbar → veröffentlicht beziehungsweise sichtbar            | `content.publish`                  | News, Events, POI, Generic Item, FAQ, Cockpit Cards, Projects, Surveys                  |
| beliebiger aktiver Zustand → archiviert                                      | `content.archive`                  | Projects, Surveys und Adapter mit explizitem Archivstatus                               |
| archiviert → Entwurf                                                         | `content.restore`                  | Projects, Surveys und Adapter mit explizitem Archivstatus                               |
| veröffentlicht beziehungsweise sichtbar → Entwurf beziehungsweise unsichtbar | `content.changeStatus`             | News, Events, POI, Generic Item, FAQ, Cockpit Cards, Projects, Surveys                  |
| Hard Delete                                                                  | jeweilige Plugin-Action `*.delete` | News, Events, POI, Generic Item, FAQ, Cockpit Cards, Surveys                            |
| Projects Soft Delete                                                         | `projects.delete`                  | Projects; Payload-Marker und Visibility-Zweitschritt bleiben eine korrelierte Operation |

Unveränderte Status- oder Visibility-Werte erzeugen keine zusätzliche
Lifecycle-Prüfung. Das Journal verwendet bei kombinierten Mutationen die letzte
Lifecycle-Action als korrelierte Action-ID; das Audit enthält sowohl die
fachliche als auch jede zusätzliche Autorisierungsentscheidung.

## Capability-Aktivierung

Unbestätigte Kombinationen werden über `SVA_MAINSERVER_CONFIRMED_CAPABILITIES` aktiviert. Der Wert ist eine kommaseparierte Liste fully-qualified Actions. Die Freigabe darf erst nach einem realen Contract-Lauf mit persönlichen und organisatorischen Credentials erfolgen; ein leerer oder ungültiger Wert erweitert keine Fähigkeit.

Die effektiven Capabilities werden dem authentifizierten Client über
`GET /api/v1/mainserver/mutation-capabilities` bereitgestellt. Eine vorhandene IAM-Action reicht
für eine unbestätigte Mainserver-Mutation nicht aus. Listenaktionen und Editor bleiben für diese
Action deaktiviert, solange sie nicht effektiv aktiviert ist oder der Capability-Vertrag nicht
geladen werden kann.

## Komposition mit parallelen Changes

- `make-mainserver-content-authoritative`: Mainserver-Existenz und Provider-Erfolg bleiben fachlich autoritativ; Binding, Journal, Reference, Projection und History sind rekonstruierbare Folgearbeit.
- `update-mainserver-editor-resilience`: Der verpflichtende Same-Credential-Pre-Read ist zugleich Quelle für Read-Merge-Write und DataProvider-Autorisierung. Es gibt keinen zweiten Read mit anderem Credential-Kontext.
- `standardize-plugin-content-history`: Das Mutation-Journal ist Operations- und Reconciliation-Nachweis, keine zweite sichtbare History. Erfolgreiche Studio-Mutationen finalisieren weiterhin genau einen host-owned History-Eintrag mit `coverage = studio_mutations`.
