## ADDED Requirements

### Requirement: Gleiche normalisierte E-Mail erlaubt einen expliziten Mainserver-Rebind

Das System SHALL einen `local_user_conflict` aus persönlichem Mainserver-Provisioning nur dann über den administrativen Reconcile-Pfad auflösen, wenn Studio und Mainserver dieselbe normalisierte E-Mail-Adresse bestätigen. Die E-Mail-Gleichheit SHALL für diesen begrenzten Pfad als ausreichende Identitätszuordnung gelten. Wiederholtes Provisioning und direkte Datenbankzugriffe SHALL den Konflikt nicht auflösen.

#### Scenario: Historische Identität verwendet dieselbe E-Mail-Adresse

- **GIVEN** der Mainserver meldet `local_user_conflict`
- **WHEN** die Read-only-Prüfung dieselbe normalisierte E-Mail-Adresse bestätigt
- **THEN** kennzeichnet Studio den Konflikt als direkt administrativ auflösbar

#### Scenario: Normalisierte E-Mail-Adressen weichen ab

- **GIVEN** der Mainserver meldet `local_user_conflict`
- **WHEN** die Read-only-Prüfung keine E-Mail-Gleichheit bestätigt
- **THEN** führt Studio keinen Rebind aus
- **AND** persistiert keine neuen persönlichen Credentials

### Requirement: Mainserver-Rebind ist atomar, idempotent und wiederaufnehmbar

Das System SHALL die historische Mainserver-Identität nur über einen dedizierten Rebind-Vertrag an den Ziel-Subject binden. Der Vertrag SHALL die E-Mail-Gleichheit erneut prüfen, Bindung und Credential-Rotation atomar ausführen, eine deterministische Operationsreferenz idempotent behandeln und nach Timeout ein dauerhaftes Ergebnis mit geschütztem Credential-Replay für die serverseitige Wiederherstellung bereitstellen.

#### Scenario: Dedizierter Rebind ist erfolgreich

- **GIVEN** ein berechtigter Reconcile-Aufruf mit bestätigter E-Mail-Gleichheit und deterministischer Operationsreferenz
- **WHEN** Studio den dedizierten Mainserver-Rebind aufruft
- **THEN** bindet der Mainserver die Identität atomar an den Ziel-Subject und invalidiert den alten Credential-Zustand
- **AND** erhält Studio verifizierbare neue persönliche Credentials und den Ziel-DataProvider
- **AND** persistiert Studio die Credentials ausschließlich serverseitig in Keycloak

#### Scenario: Upstream-Ergebnis ist nach Timeout unklar

- **WHEN** der Rebind-Aufruf ohne eindeutige Antwort endet
- **THEN** fragt Studio das Ergebnis mit derselben Operationsreferenz ab
- **AND** startet es keinen unabhängigen zweiten Rebind

#### Scenario: Lokale Persistenz scheitert nach bestätigtem Rebind

- **GIVEN** der Mainserver hat Rebind und Credential-Rotation bestätigt
- **WHEN** Keycloak-Persistenz oder DataProvider-Verifikation fehlschlägt
- **THEN** behandelt Studio den Zustand als `reconciliation_required`
- **AND** kann eine erneute bewusste Reconcile-Aktion das geschützte Ergebnis über dieselbe Operationsreferenz wiederaufnehmen
