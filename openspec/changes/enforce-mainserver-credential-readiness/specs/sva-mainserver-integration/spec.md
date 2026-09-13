## ADDED Requirements

### Requirement: Mainserver-Consumer prüfen principalgebundene Credential-Readiness

Das System SHALL vor einem Mainserver-Consumer-Aufruf den Credential-Zustand
des exakten Instanz- und Principal-Scopes als `ready`, `missing`, `partial`,
`stale` oder `unavailable` bestimmen. Nur `ready` SHALL einen Token-, Identity-
oder GraphQL-Aufruf erlauben. Kein nicht bereiter Scope SHALL durch Root-,
Shared- oder fremde Principal-Credentials ersetzt werden.

Readiness, Logs, API, Audit und Betriebsnachweise SHALL keine Credentialwerte,
Tokens oder vollständigen Benutzeridentitäten enthalten.

#### Scenario: Partielles Credential blockiert den Upstream

- **GIVEN** für einen Projection-Scope fehlt eines der beiden erforderlichen Mainserver-Attribute
- **WHEN** ein Refresh für diesen Scope beginnt
- **THEN** klassifiziert Studio den Zustand als `partial` und nennt nur den fehlenden Attributnamen
- **AND** startet es keinen Mainserver-Aufruf und verwendet keinen anderen Principal

#### Scenario: Provider-Ausfall ist nicht gleich fehlendes Credential

- **GIVEN** Keycloak oder die organisationsgebundene Datenbank ist nicht belastbar lesbar
- **WHEN** Studio Credential-Readiness bestimmt
- **THEN** liefert es `unavailable` statt `missing`
- **AND** behauptet es keine negative Presence ohne erfolgreichen Read-back

### Requirement: Dauerhafte Credential-Fehler werden persistent gedrosselt

Das System SHALL `missing`, `partial` und `stale` mit stabilem Fehlercode und
Zeitpunkt im vorhandenen principal-isolierten Projection-Sync-State
persistieren und frühestens nach 15 Minuten automatisch erneut prüfen.
`unavailable` und technische Netzwerkfehler SHALL den vorhandenen kurzen
technischen Retry behalten.

Ein manueller Refresh MAY die Prüfung vorziehen, SHALL das Credential-Gate aber
nicht umgehen. Ein Credential-Fehler SHALL vorhandene partielle oder
vollständige Snapshots weder löschen noch fälschlich finalisieren.

#### Scenario: Dauerhafter Fehler wird nicht minütlich erneut versucht

- **GIVEN** ein Projection-Scope ist vor weniger als 15 Minuten mit `missing`, `partial` oder `stale` fehlgeschlagen
- **WHEN** der 60-Sekunden-Scheduler den Scope betrachtet
- **THEN** startet er keinen neuen Mainserver-Aufruf
- **AND** bleibt der persistierte letzte Fehler maßgeblich

#### Scenario: Prozessneustart erhält den Cooldown

- **GIVEN** ein dauerhafter Credential-Fehler wurde persistiert
- **WHEN** die Runtime vor Ablauf der Fälligkeit neu startet
- **THEN** rekonstruiert sie die Entscheidung aus dem Projection-Sync-State
- **AND** behandelt eine neue prozesslokale Target-Registrierung nicht als neue Fälligkeit

#### Scenario: Alter Snapshot bleibt lesbar

- **GIVEN** ein vollständiger oder partieller Mainserver-Snapshot ist vorhanden
- **WHEN** der nächste Refresh wegen nicht bereiter Credentials blockiert wird
- **THEN** bleiben die vorhandenen autorisierten Zeilen lesbar
- **AND** erfolgen weder Finalisierung noch Löschabgleich
