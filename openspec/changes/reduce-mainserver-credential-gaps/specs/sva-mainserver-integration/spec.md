## ADDED Requirements

### Requirement: Credential-Fehler erhalten einen begrenzten stillen Wiederherstellungsversuch

Das System SHALL nach einem passenden Credential-Fehler im aktuellen autorisierten Inhaltskontext einmal still den bestehenden authentifizierten POST-Refresh für einen Wiederherstellungsversuch verwenden. Der Server SHALL Instanz, Account, aktive Organisation, Read-Sichten und Content-Berechtigung erneut bestimmen und SHALL keine beliebigen Zielaccounts oder Credentialgeber aus Clientangaben akzeptieren. GET, Login, Scheduler und Listenpolling SHALL keine Credential-Rücksicherung auslösen. Bereits laufende Arbeit SHALL wiederverwendet werden; erneutes Rendern oder Polling SHALL für dasselbe Fehlerergebnis keine weitere Recovery erzeugen. Der persistierte Sync-State und 15-Minuten-Cooldown SHALL auch über Prozesswechsel erhalten bleiben; ein initialer Versuch darf die Prüfung vorziehen, ein fehlgeschlagener Versuch SHALL keine wiederholte automatische Vorziehung begründen.

Das System SHALL persönliche Credentials einmal frisch aus dem instanzgebundenen Keycloak lesen und organisatorische Credentials ausschließlich nach dem Vertrag der lokalen Organisationsrücksicherung wiederherstellen. Es SHALL weder Mainserver-Provisionierung noch Keycloak-Writes, Credential-Rotation, Accountanlage oder Principal-Fallbacks ausführen. Die vorhandene technische Keycloak-Leseverbindung SHALL keine neue Bootstrap-/Wiederherstellungsidentität begründen.

#### Scenario: Persönliche Credentials sind beim erneuten Lesen vollständig

- **GIVEN** ein persönlicher Credential-Fehler betrifft den aktuellen autorisierten Inhaltskontext
- **WHEN** der stille POST-Refresh vollständige persönliche Attribute frisch aus Keycloak liest
- **THEN** darf Studio den Inhaltsabruf einmal erneut versuchen
- **AND** führt es weder Credential-Writes noch Mainserver-Provisionierung aus

#### Scenario: Persönliche Credentials fehlen weiterhin

- **GIVEN** der erneute Keycloak-Read bestätigt fehlende oder partielle persönliche Credentials
- **WHEN** der automatische Versuch endet
- **THEN** liefert Studio die präzise Supportmeldung mit der bestätigten Ursache
- **AND** versucht es weder Selbstprovisionierung noch eine andere Credential-Quelle

#### Scenario: Abhängigkeit ist nicht erreichbar

- **GIVEN** Keycloak oder die Organisationsdatenbank ist nicht belastbar lesbar
- **WHEN** der Wiederherstellungsversuch endet
- **THEN** meldet Studio Nichtverfügbarkeit statt bestätigtem Credential-Fehlen
- **AND** schreibt es keine Credentials und liefert den Supporthinweis

#### Scenario: Kontext oder Berechtigung ändert sich

- **GIVEN** eine stille Wiederherstellung wurde für einen Inhaltskontext begonnen
- **WHEN** Organisation, Session, Instanz oder Berechtigung vor der Fortsetzung wechseln beziehungsweise entfallen
- **THEN** verwirft Studio die alte Fortsetzung
- **AND** startet es keinen Abruf unter einer fremden oder veralteten Identität

#### Scenario: Polling oder ein weiterer Prozess beobachtet denselben Fehler

- **GIVEN** ein automatischer Versuch ist für das Fehlerergebnis bereits abgeschlossen oder läuft
- **WHEN** Polling, erneutes Rendern, ein weiterer Tab oder ein neu gestarteter Prozess den Zustand betrachtet
- **THEN** erzeugt dies keine zusätzliche automatische Cooldown-Vorziehung
- **AND** bleiben reguläre fällige Proben und ausdrücklich manuelles Aktualisieren möglich

### Requirement: Wiederherstellungserfolg und Inhaltsaktualisierung bleiben getrennt

Das System SHALL nach erfolgreichem Credential-Read-back den weiterhin autorisierten betroffenen Inhaltsabruf höchstens einmal wiederholen. Die lokale Rücksicherung SHALL ohne Mainserver-Provisionierungs- oder Identity-Aufruf erfolgen; die aktuelle externe Gültigkeit SHALL erst durch den regulären Inhaltsabruf beurteilt werden. Ein fehlgeschlagener Read-back oder erneuter Inhaltsfehler SHALL eine präzise Supportmeldung auslösen und SHALL weder einen weiteren Credential-Wechsel noch eine Reparaturschleife auslösen. Snapshot-Erhalt, Autorisierung, Principal- und Readiness-Grenzen SHALL unverändert gelten.

#### Scenario: Rücksicherung gelingt und Inhaltsabruf scheitert

- **GIVEN** die lokale Organisationsrücksicherung und ihr Read-back sind erfolgreich
- **WHEN** der einmal wiederholte Mainserver-Inhaltsabruf weiterhin fehlschlägt
- **THEN** weist Studio Rücksicherungserfolg und verbleibenden Inhaltsfehler getrennt aus
- **AND** schreibt es keine weiteren Credentials und liefert den Supporthinweis

#### Scenario: Rücksicherung ist erfolgreich und Read-back scheitert

- **GIVEN** die lokale Rücksicherung ist committed
- **WHEN** der kanonische Read-back nicht bestätigt werden kann
- **THEN** meldet Studio keinen erfolgreichen Inhaltsabgleich
- **AND** bleiben die gespeicherte Version und vorhandene Snapshots ohne kompensierende Löschung erhalten

#### Scenario: Wiederholung stellt aktuelle Inhalte bereit

- **GIVEN** die geprüften vorhandenen Credentials sind verwendbar
- **WHEN** der einmal wiederholte Abgleich und anschließende Read erfolgreich enden
- **THEN** zeigt Studio die aktuellen autorisierten Inhalte ohne Supportfehler an
- **AND** behauptet es keinen Erfolg allein aufgrund gelesener Credential-Attribute
