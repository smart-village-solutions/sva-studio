## ADDED Requirements

### Requirement: Instanz-Registry speichert Auth-Metadaten pro Instanz
Die Instanz-Registry SHALL für jede produktive Instanz verpflichtend Realm- und Client-Metadaten für OIDC- und Keycloak-Admin-Auflösung speichern.

#### Scenario: Neue Instanz wird mit Auth-Metadaten angelegt
- **WHEN** eine Instanz über den Provisioning-Vertrag angelegt wird
- **THEN** `authRealm` und `authClientId` werden validiert und persistiert
- **AND** die Instanz wird ohne vollständige Auth-Metadaten nicht als traffic-fähig aktiviert

### Requirement: Provisioning erstellt tenant-spezifische Keycloak-Artefakte
Das Provisioning SHALL Realm- und Standard-Client-Artefakte in Keycloak für neue Instanzen anlegen und den Fortschritt idempotent protokollieren.

#### Scenario: Realm-Provisioning schlägt teilweise fehl
- **WHEN** die Realm-Erzeugung erfolgreich ist, aber die Client-Konfiguration fehlschlägt
- **THEN** der Provisioning-Run speichert den fehlgeschlagenen Step-Key und Fehlerkontext
- **AND** ein späterer Wiederholungslauf kann denselben Vorgang ohne doppelte Realm-Erzeugung fortsetzen
