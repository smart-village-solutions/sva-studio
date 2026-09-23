## ADDED Requirements

### Requirement: Account-Einladungen verwenden den wirksamen Studio-Text und bleiben Keycloak-owned

Das System SHALL Account-Einladungen weiterhin ausschließlich über Keycloaks
`execute-actions-email` mit `UPDATE_PASSWORD` versenden. Vor Create und Resend
MUST der aktuelle Realm-Readback der wirksamen, aus Instanzvorlage,
Servervorlage oder SVA-Standard aufgelösten Vorlage entsprechen; das Studio
darf den Aktionslink weder selbst erzeugen noch aus Keycloak auslesen.

#### Scenario: Bereits bestätigte wirksame Vorlage wird versendet

- **WHEN** die wirksame Vorlage im eindeutig zugeordneten Realm bereits vollständig bestätigt ist
- **AND** ein berechtigter Administrator beim Anlegen eines Accounts die Einladung auswählt oder sie später erneut sendet
- **THEN** ruft der Server weiterhin Keycloaks `execute-actions-email` mit `UPDATE_PASSWORD`, dem instanzgebundenen Login-Client und dem zulässigen Callback auf
- **AND** rendert und versendet Keycloak Betreff, Plaintext, HTML und den signierten Aktionslink aus dem bestätigten Realm-Zustand
- **AND** erhält das Studio den Aktionslink oder Token zu keinem Zeitpunkt

#### Scenario: Abweichender Realm wird für den Versand ausgerichtet

- **WHEN** der Realm-Readback von der wirksamen Vorlage abweicht
- **THEN** setzt der Server `emailTheme = sva-kern2` und schreibt ausschließlich die drei verwalteten Einladungsschlüssel
- **AND** liest er diese Werte kausal zurück
- **AND** ruft er `execute-actions-email` erst nach vollständiger Übereinstimmung auf

#### Scenario: Instanz ohne Individualvorlage erbt den Servertext

- **WHEN** für eine Instanz keine Individualvorlage gespeichert ist
- **THEN** verwendet der Server die aktuelle Servervorlage oder ersatzweise den eingebauten SVA-Standard
- **AND** kopiert er den Servertext nicht in den Instanzdatensatz
- **AND** stellt er den wirksamen Text erst für den konkreten Versand im Realm sicher

#### Scenario: Sicherstellung scheitert

- **WHEN** Keycloak den Write oder den abschließenden Readback der wirksamen Vorlage nicht bestätigt
- **THEN** ruft der Server `execute-actions-email` nicht auf
- **AND** meldet er einen stabilen, retrybaren Einladungsausfall ohne Templateinhalt, Token oder Empfänger-PII in Logs und Fehlerdetails
- **AND** bleibt ein zuvor erfolgreich angelegter Account bestehen

#### Scenario: Wiederholter Versand verwendet dieselbe Sicherheitsgrenze

- **WHEN** ein Administrator die Passwort-Einladung für einen bestehenden Account erneut sendet
- **THEN** verwendet der Resend denselben instanzgebundenen Vorlagen- und Realm-Readback wie die Einladung nach Accountanlage
- **AND** entsteht kein zweiter Mail-, Token- oder Fallbackpfad
