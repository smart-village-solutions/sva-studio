## ADDED Requirements

### Requirement: Persönliche MCP-Sitzungen können lokal im Schlüsselbund wiederverwendet werden

Der persönliche Studio-MCP SHALL im ausdrücklich aktivierten macOS-Keychain-Modus nur Refresh-Token, Subject, Account und die Bindung an Kontext-ID, Art, Studio-Origin, Issuer, Client und Tenant dauerhaft im OS-Schlüsselbund speichern. Der Standardmodus SHALL weiterhin nur Prozessspeicher verwenden. Der Keychain-Modus SHALL auf nicht unterstützten Plattformen geschlossen scheitern und SHALL Tokens niemals in Dateien, Prozessargumenten, Environment, Logs oder Tool-Ausgaben speichern.

#### Scenario: Prozess wird neu gestartet

- **WHEN** ein ausdrücklich ausgewählter Kontext einen gespeicherten Refresh-Token verwendet
- **THEN** prüft der MCP den konfigurierten Issuer und bestätigt das gespeicherte Subject über Userinfo
- **AND** speichert er einen rotierten Refresh-Token vor dem API-Zugriff

#### Scenario: Kontext oder Benutzer stimmt nicht überein

- **WHEN** die gespeicherte Kontextbindung oder das bestätigte Subject abweicht
- **THEN** verwirft der MCP den Eintrag und verlangt eine neue Anmeldung ohne Credential-Fallback

#### Scenario: Benutzer meldet sich ab

- **WHEN** Logout mit einer laufenden Wiederherstellung überlappt
- **THEN** serialisiert der bestehende Manager beide Operationen und löscht anschließend die gespeicherte Sitzung
- **AND** widerruft er den Refresh-Token beim Provider; ein Widerrufsfehler macht die lokale Löschung nicht rückgängig

#### Scenario: Eine andere Identität wird interaktiv angemeldet

- **WHEN** ein neuer Browser-Login läuft oder ohne Refresh-Token abschließt
- **THEN** wird währenddessen keine alte Identität restauriert
- **AND** löscht ein erfolgreicher Login ohne Refresh-Token die frühere persistente Sitzung

#### Scenario: Schlüsselbund ist nicht verfügbar

- **WHEN** Lesen, Speichern oder Löschen im Schlüsselbund fehlschlägt
- **THEN** meldet der MCP einen stabilen geheimwertfreien Fehler und behauptet keine erfolgreich gelöschte persistente Sitzung
