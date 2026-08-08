# Mainserver-Vertrags- und Capability-Matrix

## Verbindliche Querschnittsregeln

- Jede Mutation benötigt die angegebene fully-qualified Action und einen expliziten `actingPrincipalType`.
- Bestehende Inhalte werden unmittelbar vor dem Write mit demselben gebundenen Credential-Kontext gelesen. Der Read liefert den sicherheitskritischen `dataProvider`; Projection und Cache autorisieren keine Mutation.
- Create bindet den Principal ausschließlich über `dataProvider.id` aus der Mutation-Response oder einem unmittelbaren Same-Credential-Re-Read.
- Ein bestätigter Provider-Erfolg bleibt fachlicher Erfolg. Lokale Projection-, Binding-, Audit- oder History-Fehler führen zu `reconciliation_required`.
- Hard Delete verwendet das persistierte Preimage und benötigt keinen Post-Delete-Read.
- Create ist ohne idempotenten Upstream-Schlüssel bei verlorener Response potenziell duplizierend. Projects verwenden dagegen `externalId` als stabilen Schlüssel.

## Reale Vertragsevidenz

Am 7. August 2026 wurde der aktuell konfigurierte Mainserver mit einem technischen
Credential ausschließlich lesend geprüft:

- OAuth-Tokenabruf: HTTP 200;
- GraphQL-Root-Abfrage: HTTP 200 mit Query-Root;
- `/data_provider.json`: HTTP 200 mit gültigem `data_provider`-Objekt, aber ohne stabile ID.

Damit ist der in diesem Change vorausgesetzte Übergangsvertrag real bestätigt. Der
destruktive Matrixlauf mit getrennten persönlichen und organisatorischen Credentials
für Create, Same-Credential-Read, Cross-Principal-Update, Status beziehungsweise
Visibility und Hard Delete steht weiterhin aus und wird nicht durch diesen Read-only-
Nachweis ersetzt.

## Typ-/Aktionsmatrix

| Content-Typ   | Studio-Action                        | Mainserver-Operation                                  | Pre-Read         | DataProvider-Vertrag                                                         | Lifecycle und Idempotenz                                       | Cross-Principal und Reconciliation                             | Capability                          |
| ------------- | ------------------------------------ | ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------- |
| News          | `news.create`                        | `SvaMainserverCreateNews`                             | nein             | Response oder Same-Credential-Re-Read bindet Principal                       | nicht idempotenter Create; Lost Response wird journalisiert    | Create-Provider-Konflikt erzeugt `reconciliation_required`     | aktiv                               |
| News          | `news.update`                        | `SvaMainserverCreateNews` mit ID                      | ja               | Read und Response selektieren `dataProvider`; Update darf ihn nicht ändern   | Read-Merge-Write; Visibility ist ein korrelierter Zweitschritt | exakter Scope oder credential-sichtbare Kompatibilität         | aktiv                               |
| News          | `news.delete`                        | `SvaMainserverDestroyNews`                            | ja               | Preimage-Provider wird vor Delete persistiert                                | Hard Delete; Operation/Tombstone idempotent finalisierbar      | kein Post-Read; verlorene Response bleibt `unknown`            | aktiv                               |
| Events        | `events.create`                      | `SvaMainserverCreateEvent`                            | nein             | Response oder Re-Read bindet Principal                                       | nicht idempotenter Create                                      | Konflikt erzeugt lokale Reconciliation                         | aktiv                               |
| Events        | `events.update`                      | `SvaMainserverCreateEvent` mit ID                     | ja               | typisierter Read/Response-Provider                                           | Read-Merge-Write                                               | Cross-Principal nur nach Same-Credential-Read                  | aktiv                               |
| Events        | `events.delete`                      | `SvaMainserverDestroyRecord`                          | ja               | Provider aus Preimage                                                        | Hard Delete                                                    | Tombstone; kein Post-Read                                      | aktiv                               |
| POI           | `poi.create`                         | `SvaMainserverCreatePoi`                              | nein             | Response oder Re-Read bindet Principal                                       | nicht idempotenter Create                                      | Konflikt erzeugt lokale Reconciliation                         | aktiv                               |
| POI           | `poi.update`                         | `SvaMainserverCreatePoi` mit ID                       | ja               | typisierter Read/Response-Provider                                           | Read-Merge-Write                                               | Cross-Principal nur nach Same-Credential-Read                  | aktiv                               |
| POI           | `poi.delete`                         | `SvaMainserverDestroyRecord`                          | ja               | Provider aus Preimage                                                        | Hard Delete                                                    | Tombstone; kein Post-Read                                      | aktiv                               |
| Generic Item  | `generic-items.create`               | `SvaMainserverCreateGenericItem`                      | nein             | Response oder Re-Read bindet Principal                                       | ohne `externalId` potenziell duplizierend                      | Konflikt erzeugt lokale Reconciliation                         | aktiv                               |
| Generic Item  | `generic-items.update`               | `SvaMainserverCreateGenericItem` mit ID               | ja               | typisierter Read/Response-Provider                                           | Payload Read-Merge-Write                                       | Cross-Principal nur nach Same-Credential-Read                  | aktiv                               |
| Generic Item  | `generic-items.delete`               | `SvaMainserverDestroyRecord`                          | ja               | Provider aus Preimage                                                        | Hard Delete                                                    | Tombstone; kein Post-Read                                      | aktiv                               |
| FAQ           | `faq.create/update/delete`           | Generic-Item-Operationen                              | wie Generic Item | wie Generic Item                                                             | `genericType = FAQ`; sonst gleicher Vertrag                    | wie Generic Item                                               | aktiv                               |
| Cockpit Cards | `cockpit-cards.create/update/delete` | Generic-Item-Operationen                              | wie Generic Item | wie Generic Item                                                             | `genericType = COCKPIT_CARD`; sonst gleicher Vertrag           | wie Generic Item                                               | aktiv                               |
| Projects      | `projects.create`                    | `SvaMainserverCreateGenericItem`                      | nein             | Response oder Re-Read bindet Principal                                       | `externalId` ist stabiler Create-/Reconciliation-Schlüssel     | Konflikt erzeugt lokale Reconciliation                         | aktiv                               |
| Projects      | `projects.update`                    | `SvaMainserverCreateGenericItem` mit ID               | ja               | Provider bleibt ausschließlich Mainserver-Feld                               | Payload Read-Merge-Write plus Visibility-Zweitschritt          | beide Schritte verwenden denselben Principal-Kontext           | aktiv                               |
| Projects      | `projects.delete`                    | `SvaMainserverCreateGenericItem` mit ID               | ja               | Provider aus Preimage                                                        | Soft Delete im Payload plus Visibility-Zweitschritt            | kein Hard-Delete-Tombstone; Partial Success wird journalisiert | aktiv                               |
| Surveys       | `surveys.create`                     | `SvaMainserverCreateOrUpdateSurvey` ohne ID           | nein             | Response oder Re-Read darf eine neue Bindung beweisen                        | Upsert-Create ohne belegten Idempotenzschlüssel                | Konflikt erzeugt lokale Reconciliation                         | aktiv, Contract-Evidenz nachzuholen |
| Surveys       | `surveys.update`                     | `SvaMainserverCreateOrUpdateSurvey` mit ID            | ja               | Provider-Selektion ist typisiert; Immutabilität ist upstream nicht bestätigt | Upsert                                                         | bis zum realen Nachweis fail-closed                            | `surveys.update` erforderlich       |
| Surveys       | `surveys.delete`                     | `SvaMainserverCreateOrUpdateSurvey` mit Destroy-Input | ja               | Provider aus Preimage; Löschsemantik upstream zu bestätigen                  | Hard-Delete-Verhalten nicht real bestätigt                     | bis zum realen Nachweis fail-closed                            | `surveys.delete` erforderlich       |
| Surveys       | `surveys.moderate`                   | Release/Delete Free-Text-Response                     | ja               | Survey-Provider aus Pre-Read                                                 | untergeordnete Mutation, kein Providerwechsel erwartet         | bis zum realen Cross-Principal-Nachweis fail-closed            | `surveys.moderate` erforderlich     |

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

## Komposition mit parallelen Changes

- `make-mainserver-content-authoritative`: Mainserver-Existenz und Provider-Erfolg bleiben fachlich autoritativ; Binding, Journal, Reference, Projection und History sind rekonstruierbare Folgearbeit.
- `update-mainserver-editor-resilience`: Der verpflichtende Same-Credential-Pre-Read ist zugleich Quelle für Read-Merge-Write und DataProvider-Autorisierung. Es gibt keinen zweiten Read mit anderem Credential-Kontext.
- `standardize-plugin-content-history`: Das Mutation-Journal ist Operations- und Reconciliation-Nachweis, keine zweite sichtbare History. Erfolgreiche Studio-Mutationen finalisieren weiterhin genau einen host-owned History-Eintrag mit `coverage = studio_mutations`.
