## ADDED Requirements

### Requirement: Endgültig gelöschte Benutzer blockieren keine eindeutige aktuelle DataProvider-Bindung

Das System SHALL einen persönlichen DataProvider-Konflikt anlassbezogen im serverseitigen Identity-Guard automatisch auflösen dürfen, wenn die aktuelle Credential-Version durch den authentifizierten Identity-Endpunkt bestätigt ist und alle konkurrierenden aktuellen Bindungen ausschließlich zu endgültig gelöschten oder nach Hard Delete nicht mehr vorhandenen Benutzer-Accounts derselben Instanz gehören.

Die Auflösung SHALL die konkurrierende Evidenz als `historical` erhalten, die exakte aktuelle Bindung atomar auf `verified` setzen und den noch nicht an den Mainserver gesendeten Mutationsrequest ohne zusätzlichen UI-Schritt fortsetzen. Sie SHALL keinen externen Credential-Widerruf behaupten. Jeder aktive, gesperrte, vorläufig gelöschte, organisatorische oder nicht eindeutig klassifizierbare konkurrierende Principal SHALL die automatische Auflösung fail-closed verhindern.

#### Scenario: Einziger aktiver Benutzer setzt Mutation nach Selbstheilung fort

- **GIVEN** zwei persönliche Bindungen derselben Instanz beanspruchen konfliktbehaftet denselben DataProvider
- **AND** der konkurrierende Benutzer wurde endgültig gelöscht oder ist nach abgeschlossenem Hard Delete nicht mehr vorhanden
- **AND** der aktuelle Benutzer ist aktiv und sein Identity-Endpunkt bestätigt DataProvider und Credential-Version
- **WHEN** der aktuelle Benutzer eine Mainserver-Mutation auslöst
- **THEN** historisiert Studio die konkurrierende Bindung und verifiziert die exakte aktuelle Bindung atomar
- **AND** setzt es denselben Mutationsrequest ohne neuen UI-Schritt und ohne Wiederholung eines Provider-Writes fort

#### Scenario: Reversibel inaktiver Konkurrent bleibt fail-closed

- **GIVEN** eine konkurrierende Bindung gehört zu einem gesperrten oder nur vorläufig gelöschten Benutzer
- **WHEN** der aktuelle Benutzer eine Mainserver-Mutation auslöst
- **THEN** verändert Studio keine der konfliktbehafteten Bindungen
- **AND** lehnt es die Mutation weiterhin mit `mainserver_data_provider_identity_conflict` ab

#### Scenario: Organisationsbindung verhindert persönliche Selbstheilung

- **GIVEN** eine konkurrierende aktuelle Bindung desselben DataProviders gehört zu einer Organisation
- **WHEN** ein persönlicher Principal die automatische Auflösung auslösen würde
- **THEN** historisiert Studio keine Bindung
- **AND** bleibt der betroffene Scope fail-closed

#### Scenario: Historische externe Credentials werden erneut aktiv beobachtet

- **GIVEN** Studio hat die Bindung eines endgültig gelöschten Benutzers lokal als `historical` klassifiziert
- **WHEN** dieselbe externe Credential-Version später erneut als aktuelle Principal-Evidenz auftritt
- **THEN** behandelt Studio sie nicht allein aufgrund der früheren Historisierung als konfliktfrei
- **AND** erzeugt die widersprechende aktive Beobachtung erneut einen fail-closed Konflikt
