## ADDED Requirements

### Requirement: Mainserver-Identitätskonflikte bleiben bis zur operativen Korrektur fail-closed

Das System SHALL einen upstream gemeldeten `local_user_conflict` als dedizierten, nicht automatisch wiederholbaren `mainserver_user_conflict` mit Request-ID ausgeben. Studio SHALL weder die Mainserver-Subject-Bindung verändern noch den Konflikt automatisch erneut provisionieren. Für die operative Zuordnung SHALL dieselbe normalisierte E-Mail-Adresse innerhalb derselben Instanz als ausreichendes Identifikationsmerkmal gelten.

#### Scenario: Mainserver meldet eine abweichende historische Subject-Bindung

- **GIVEN** E-Mail und Ziel-Subject werden an die bestehende Mainserver-Provisionierung übergeben
- **WHEN** der Mainserver `local_user_conflict` meldet
- **THEN** antwortet Studio mit `mainserver_user_conflict` und der Request-ID
- **AND** speichert Studio keine neuen persönlichen Credentials
- **AND** startet Studio keinen automatischen Rebind oder erneuten Provisionierungsversuch

#### Scenario: E-Mail-Abgleich ist nicht eindeutig

- **WHEN** der Mainserver-Betrieb keine eindeutige Gleichheit der normalisierten E-Mail innerhalb derselben Instanz feststellt
- **THEN** bleibt der Konflikt unverändert bestehen
- **AND** erfolgt keine operative Subject-Änderung

#### Scenario: Operative Korrektur ist nachgewiesen

- **GIVEN** der Mainserver-Betrieb hat die lokale `User`-/`Member`-Zuordnung kontrolliert korrigiert
- **WHEN** ein berechtigter Administrator die bestehende Reprovisionierung erneut ausführt
- **THEN** verarbeitet Studio die unveränderte Mainserver-Provisioning-Antwort
- **AND** persistiert erfolgreiche persönliche Credentials wie bisher ausschließlich serverseitig in Keycloak
