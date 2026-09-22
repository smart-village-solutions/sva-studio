## ADDED Requirements

### Requirement: Account-Einladungen verwenden den bestätigten Instanztext und bleiben Keycloak-owned

Das System SHALL Account-Einladungen weiterhin ausschließlich über Keycloaks
`execute-actions-email` mit `UPDATE_PASSWORD` versenden. Für eine Instanz mit
gespeicherter Individualvorlage MUST der aktuelle Realm-Readback vor Create und
Resend der kompilierten Vorlagenrevision entsprechen; das Studio darf den
Aktionslink weder selbst erzeugen noch aus Keycloak auslesen.

#### Scenario: Bestätigte Individualvorlage wird versendet

- **WHEN** für die aktive Instanz eine Individualvorlage gespeichert und im eindeutig zugeordneten Realm vollständig bestätigt ist
- **AND** ein berechtigter Administrator beim Anlegen eines Accounts die Einladung auswählt oder sie später erneut sendet
- **THEN** ruft der Server weiterhin Keycloaks `execute-actions-email` mit `UPDATE_PASSWORD`, dem instanzgebundenen Login-Client und dem zulässigen Callback auf
- **AND** rendert und versendet Keycloak Betreff, Plaintext, HTML und den signierten Aktionslink aus dem bestätigten Realm-Zustand
- **AND** erhält das Studio den Aktionslink oder Token zu keinem Zeitpunkt

#### Scenario: Custom-Drift blockiert nur die Einladung

- **WHEN** eine Individualvorlage gespeichert ist, der Realm-Readback aber abweicht oder nicht verfügbar ist
- **THEN** ruft der Server `execute-actions-email` nicht auf
- **AND** meldet er einen stabilen, retrybaren Einladungsausfall ohne Templateinhalt, Token oder Empfänger-PII in Logs und Fehlerdetails
- **AND** bleibt ein zuvor erfolgreich angelegter Account bestehen

#### Scenario: Bestandsinstanz ohne Individualvorlage behält den bisherigen Pfad

- **WHEN** für eine bestehende Instanz keine Individualvorlage gespeichert ist und noch keine ausdrückliche Standardprojektion erfolgte
- **THEN** bleibt der bisherige Keycloak-Einladungsversand unverändert verfügbar
- **AND** behauptet Studio keinen bestätigten SVA-Standardtext für diesen Realm

#### Scenario: Wiederholter Versand verwendet dieselbe Sicherheitsgrenze

- **WHEN** ein Administrator die Passwort-Einladung für einen bestehenden Account erneut sendet
- **THEN** verwendet der Resend denselben instanzgebundenen Vorlagen- und Realm-Readback wie die Einladung nach Accountanlage
- **AND** entsteht kein zweiter Mail-, Token- oder Fallbackpfad

