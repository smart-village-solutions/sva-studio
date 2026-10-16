## ADDED Requirements

### Requirement: Personenbezogene Zuordnung von Bus-Key-Mutationen

Das System SHALL Bus-Key-Mutationen über den bestehenden Plattform-/Instanz-Auditpfad
mit der serverseitig ermittelten Session-Benutzer-ID, Instanz-ID, Key-ID, Aktion, Ergebnis
und Request-ID korrelieren. Erstellerinitialen SHALL die Audit-Identität nicht ersetzen.

#### Scenario: Plattform-Superadmin verändert einen Key

- **WHEN** ein berechtigter Benutzer einen Bus-Key erstellt, sperrt oder reaktiviert
- **THEN** setzt Studio `x-admin-actor-id` aus seiner Session und übermittelt die Request-ID an den Bus-Server
- **AND** enthalten Auditdetails, operative Logs und Fehlertelemetrie weder Klartext-Key noch Hash, Admin-Token oder Kontakt-E-Mail

#### Scenario: Nachgelagerter Auditfehler nach bestätigtem Bus-Erfolg

- **WHEN** der Bus-Server eine Mutation erfolgreich bestätigt, aber das anschließende Studio-Audit fehlschlägt
- **THEN** bleibt der bestätigte Mutationserfolg vom Auditfehler unterscheidbar und korrelierbar
- **AND** wird insbesondere kein automatischer zweiter Create-Aufruf ausgelöst
