## ADDED Requirements

### Requirement: Persönliche Mainserver-Provisionierung benötigt kanonischen Read-back

Das System SHALL persönliche Mainserver-Credentials nach Create-, Einzel- und
Bulk-Provisionierung erst dann als erfolgreich ausweisen, wenn die kanonischen
Keycloak-Attribute geschrieben und über den instanzgebundenen Credential-
Reader vollständig mit passendem Credential-Fingerprint zurückgelesen wurden.

Ein fehlender, partieller, abweichender oder nicht verfügbarer Read-back SHALL
einen stabilen Credential-Readiness-Fehler erzeugen. Er SHALL weder den lokalen
Account deaktivieren oder löschen noch bestätigten Providererfolg als
Providerfehler umdeuten. Antworten, Audit und Logs SHALL keine Credentialwerte
oder vollständigen Benutzeridentitäten enthalten.

#### Scenario: Passender Read-back schließt Provisionierung ab

- **GIVEN** der Mainserver liefert vollständige persönliche Credentials
- **WHEN** Studio die kanonischen Attribute schreibt und dieselbe Credential-Version zurückliest
- **THEN** darf Studio die Mainserver-Credentials als `ready` melden
- **AND** enthält der Erfolgsnachweis keine Credentialwerte

#### Scenario: Partieller Read-back meldet keinen Erfolg

- **GIVEN** der Mainserver hat vollständige Credentials geliefert
- **WHEN** der Read-back nur Application-ID oder nur Application-Secret enthält
- **THEN** meldet Studio `partial` mit dem fehlenden Attributnamen
- **AND** bleibt der lokale Account erhalten

#### Scenario: Abweichende Version benötigt Reconciliation

- **GIVEN** Studio hat vollständige Credentials geschrieben
- **WHEN** der Read-back einen abweichenden Fingerprint liefert
- **THEN** meldet Studio `stale` statt Erfolg
- **AND** gibt es weder erwartete noch gelesene Credentialwerte aus

#### Scenario: Bulk-Ergebnisse bleiben principalisoliert

- **GIVEN** eine Bulk-Reprovisionierung verarbeitet mehrere Accounts
- **WHEN** ein Read-back fehlschlägt und ein anderer vollständig ist
- **THEN** führt Studio beide Ergebnisse mit eigenem stabilen Status
- **AND** blockiert der fehlerhafte Account den erfolgreichen nicht
